import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from models.workspace import Workspace, WorkspaceKeyGrant, WorkspaceMember
from schemas.workspace import (
    InviteMember,
    WorkspaceCreate,
    WorkspaceKeyResponse,
    WorkspaceMemberResponse,
    WorkspaceResponse,
)
from services.auth import get_current_user
from services.permissions import parse_uuid, verify_workspace_access

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.get("", response_model=list[WorkspaceResponse])
def list_workspaces(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    memberships = (
        db.query(WorkspaceMember, Workspace)
        .join(Workspace, WorkspaceMember.workspace_id == Workspace.id)
        .filter(WorkspaceMember.user_id == current_user.id)
        .all()
    )
    return [
        WorkspaceResponse(
            id=str(ws.id),
            name=ws.name,
            description=ws.description,
            icon=ws.icon,
            owner_id=ws.owner_id,
            role=mem.role,
            created_at=ws.created_at,
        )
        for mem, ws in memberships
    ]


@router.post("", response_model=WorkspaceResponse)
def create_workspace(
    data: WorkspaceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspace = Workspace(
        id=uuid.uuid4(),
        name=data.name,
        description=data.description,
        icon=data.icon or "",
        owner_id=current_user.id,
    )
    db.add(workspace)
    db.flush()

    member = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=current_user.id,
        role="owner",
    )
    db.add(member)

    # The creator's own copy of the workspace key. Everything in the workspace will be
    # encrypted under it, so without this row the owner locks themselves out.
    if data.encrypted_workspace_key:
        db.add(WorkspaceKeyGrant(
            workspace_id=workspace.id,
            user_id=current_user.id,
            encrypted_workspace_key=data.encrypted_workspace_key,
            granted_by=current_user.id,
        ))

    db.commit()
    db.refresh(workspace)

    return WorkspaceResponse(
        id=str(workspace.id),
        name=workspace.name,
        description=workspace.description,
        icon=workspace.icon,
        owner_id=workspace.owner_id,
        role="owner",
        created_at=workspace.created_at,
    )


@router.get("/{workspace_id}/members", response_model=list[WorkspaceMemberResponse])
def list_members(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws_uuid = parse_uuid(workspace_id, "workspace ID")
    # Verify access
    membership = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.workspace_id == ws_uuid, WorkspaceMember.user_id == current_user.id)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Access denied")

    members = (
        db.query(WorkspaceMember, User)
        .join(User, WorkspaceMember.user_id == User.id)
        .filter(WorkspaceMember.workspace_id == ws_uuid)
        .all()
    )
    return [
        WorkspaceMemberResponse(
            email=user.email,
            display_name=user.display_name,
            role=mem.role,
            joined_at=mem.joined_at,
        )
        for mem, user in members
    ]


@router.post("/{workspace_id}/members")
def invite_member(
    workspace_id: str,
    data: InviteMember,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws_uuid = parse_uuid(workspace_id, "workspace ID")
    # Verify owner/admin
    membership = (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.workspace_id == ws_uuid,
            WorkspaceMember.user_id == current_user.id,
            WorkspaceMember.role.in_(["owner", "admin"]),
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Only owners and admins can invite members")

    target_user = db.query(User).filter(User.email == data.email).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.workspace_id == ws_uuid, WorkspaceMember.user_id == target_user.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="User is already a member")

    # A member without a workspace key grant is a member who can read nothing: every page
    # in the workspace is encrypted under a key they do not hold. Refuse the half-state
    # rather than create an account that silently sees a list of blank pages.
    if not data.encrypted_workspace_key:
        raise HTTPException(
            status_code=400,
            detail="encrypted_workspace_key is required: the invitee cannot decrypt any page without it",
        )

    member = WorkspaceMember(
        workspace_id=ws_uuid,
        user_id=target_user.id,
        role=data.role or "member",
    )
    db.add(member)
    db.add(WorkspaceKeyGrant(
        workspace_id=ws_uuid,
        user_id=target_user.id,
        encrypted_workspace_key=data.encrypted_workspace_key,
        granted_by=current_user.id,
    ))
    db.commit()
    return {"message": "Member invited successfully"}


@router.get("/{workspace_id}/key", response_model=WorkspaceKeyResponse)
def get_my_workspace_key(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the caller's own wrapped copy of the workspace key.

    Only ever the caller's row: handing back somebody else's blob would be useless (it is
    wrapped to their public key) but it would still leak who holds what.
    """
    ws_uuid = verify_workspace_access(workspace_id, current_user, db)

    grant = (
        db.query(WorkspaceKeyGrant)
        .filter(
            WorkspaceKeyGrant.workspace_id == ws_uuid,
            WorkspaceKeyGrant.user_id == current_user.id,
        )
        .first()
    )
    if not grant:
        raise HTTPException(status_code=404, detail="No workspace key grant for this user")

    return WorkspaceKeyResponse(
        workspace_id=str(ws_uuid),
        encrypted_workspace_key=grant.encrypted_workspace_key,
    )


@router.post("/{workspace_id}/members/remove")
def remove_member(
    workspace_id: str,
    data: InviteMember,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws_uuid = parse_uuid(workspace_id, "workspace ID")
    # Verify owner/admin
    membership = (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.workspace_id == ws_uuid,
            WorkspaceMember.user_id == current_user.id,
            WorkspaceMember.role.in_(["owner", "admin"]),
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Only owners and admins can remove members")

    target_user = db.query(User).filter(User.email == data.email).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Cannot remove owner
    target_membership = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.workspace_id == ws_uuid, WorkspaceMember.user_id == target_user.id)
        .first()
    )
    if not target_membership:
        raise HTTPException(status_code=404, detail="Member not found")
    if target_membership.role == "owner":
        raise HTTPException(status_code=400, detail="Cannot remove the workspace owner")

    db.delete(target_membership)
    # Drop their key grant too. Leaving it behind would let a removed member keep
    # decrypting anything they had already fetched, and re-reading it on any re-add.
    db.query(WorkspaceKeyGrant).filter(
        WorkspaceKeyGrant.workspace_id == ws_uuid,
        WorkspaceKeyGrant.user_id == target_user.id,
    ).delete()
    db.commit()
    return {"message": "Member removed successfully"}


@router.put("/{workspace_id}/members/role")
def update_member_role(
    workspace_id: str,
    data: InviteMember,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws_uuid = parse_uuid(workspace_id, "workspace ID")
    # Only owner can change roles
    membership = (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.workspace_id == ws_uuid,
            WorkspaceMember.user_id == current_user.id,
            WorkspaceMember.role == "owner",
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Only the workspace owner can change roles")

    target_user = db.query(User).filter(User.email == data.email).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    target_membership = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.workspace_id == ws_uuid, WorkspaceMember.user_id == target_user.id)
        .first()
    )
    if not target_membership:
        raise HTTPException(status_code=404, detail="Member not found")
    if target_membership.role == "owner":
        raise HTTPException(status_code=400, detail="Cannot change the owner's role")

    target_membership.role = data.role or "member"
    db.commit()
    return {"message": "Role updated successfully"}
