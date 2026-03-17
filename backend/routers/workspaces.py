import uuid
from typing import List
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from models.workspace import Workspace, WorkspaceMember
from schemas.workspace import WorkspaceCreate, WorkspaceResponse, WorkspaceMemberResponse, InviteMember
from services.auth import get_current_user

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.get("", response_model=List[WorkspaceResponse])
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


@router.get("/{workspace_id}/members", response_model=List[WorkspaceMemberResponse])
def list_members(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws_uuid = uuid.UUID(workspace_id)
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
    ws_uuid = uuid.UUID(workspace_id)
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

    member = WorkspaceMember(
        workspace_id=ws_uuid,
        user_id=target_user.id,
        role=data.role or "member",
    )
    db.add(member)
    db.commit()
    return {"message": "Member invited successfully"}


@router.post("/{workspace_id}/members/remove")
def remove_member(
    workspace_id: str,
    data: InviteMember,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws_uuid = uuid.UUID(workspace_id)
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
    db.commit()
    return {"message": "Member removed successfully"}


@router.put("/{workspace_id}/members/role")
def update_member_role(
    workspace_id: str,
    data: InviteMember,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws_uuid = uuid.UUID(workspace_id)
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
