import hashlib
import hmac
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from models.workspace import Workspace, WorkspaceKeyGrant, WorkspaceMember
from models.workspace_invite import WorkspaceInvite
from schemas.invite import (
    InviteAccept,
    InviteCreate,
    InviteCreated,
    InvitePreview,
    InviteSummary,
)
from services.auth import get_current_user
from services.permissions import MANAGE_ROLES, get_membership, parse_uuid

router = APIRouter(tags=["invites"])


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _require_manager(workspace_id: str, user: User, db: Session) -> uuid.UUID:
    ws_uuid = parse_uuid(workspace_id, "workspace ID")
    membership = get_membership(db, ws_uuid, user)
    if membership.role not in MANAGE_ROLES:
        raise HTTPException(status_code=403, detail="Only owners and admins can manage invites")
    return ws_uuid


def _lookup(invite_id: str, auth_token: str, db: Session) -> WorkspaceInvite:
    """Find an invite by id *and* proof of the link secret.

    The id is not a secret — it travels in the same link. Possession of the auth token is
    what actually authorises anything here, so a bad token is indistinguishable from a
    missing invite: both are a flat 404, revealing nothing about which ids exist.
    """
    invite_uuid = parse_uuid(invite_id, "invite ID")
    invite = db.query(WorkspaceInvite).filter(WorkspaceInvite.id == invite_uuid).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    # Constant-time: a timing signal here would let someone recover the hash byte by byte.
    if not hmac.compare_digest(invite.auth_token_hash, _hash_token(auth_token)):
        raise HTTPException(status_code=404, detail="Invite not found")

    return invite


def _assert_usable(invite: WorkspaceInvite) -> None:
    if invite.accepted_at is not None:
        raise HTTPException(status_code=410, detail="This invite has already been used")

    expires_at = invite.expires_at
    if expires_at.tzinfo is None:  # SQLite hands back naive datetimes
        expires_at = expires_at.replace(tzinfo=UTC)
    if expires_at < datetime.now(UTC):
        raise HTTPException(status_code=410, detail="This invite has expired")


@router.post("/workspaces/{workspace_id}/invites", response_model=InviteCreated)
def create_invite(
    workspace_id: str,
    data: InviteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mint an invite link for someone who may not have an account yet.

    The caller's browser has already generated the link secret, derived the auth token and
    the wrapping key from it, and wrapped the workspace key. All we ever see is a hash of
    the token and an opaque blob.
    """
    ws_uuid = _require_manager(workspace_id, current_user, db)

    invite = WorkspaceInvite(
        id=uuid.uuid4(),
        workspace_id=ws_uuid,
        auth_token_hash=data.auth_token_hash,
        encrypted_workspace_key=data.encrypted_workspace_key,
        role=data.role or "member",
        email=data.email.strip().lower() if data.email else None,
        created_by=current_user.id,
        expires_at=datetime.now(UTC) + timedelta(days=data.expires_in_days),
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)

    return InviteCreated(id=str(invite.id), expires_at=invite.expires_at)


@router.get("/invites/{invite_id}", response_model=InvitePreview)
def preview_invite(
    invite_id: str,
    auth_token: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
):
    """Show an invite to someone who does not have an account yet — so, no auth required.

    Holding the link is the credential. It returns the wrapped workspace key, which is
    useless without the secret in the link's fragment.
    """
    invite = _lookup(invite_id, auth_token, db)
    _assert_usable(invite)

    workspace = db.query(Workspace).filter(Workspace.id == invite.workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Invite not found")

    inviter = db.query(User).filter(User.id == invite.created_by).first()

    return InvitePreview(
        id=str(invite.id),
        workspace_id=str(invite.workspace_id),
        workspace_name=workspace.name,
        role=invite.role,
        email=invite.email,
        invited_by_email=inviter.email if inviter else None,
        encrypted_workspace_key=invite.encrypted_workspace_key,
        expires_at=invite.expires_at,
    )


@router.post("/invites/{invite_id}/accept")
def accept_invite(
    invite_id: str,
    data: InviteAccept,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Join the workspace.

    By now the invitee's browser has unwrapped the workspace key with the link secret and
    re-wrapped it under their own RSA public key. That grant is what persists; the invite
    is burnt, so the link cannot be reused or passed on.
    """
    invite = _lookup(invite_id, data.auth_token, db)
    _assert_usable(invite)

    if invite.email and invite.email != current_user.email.strip().lower():
        raise HTTPException(
            status_code=403,
            detail="This invite was issued for a different email address",
        )

    existing = (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.workspace_id == invite.workspace_id,
            WorkspaceMember.user_id == current_user.id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="You are already a member of this workspace")

    db.add(WorkspaceMember(
        workspace_id=invite.workspace_id,
        user_id=current_user.id,
        role=invite.role,
    ))
    db.add(WorkspaceKeyGrant(
        workspace_id=invite.workspace_id,
        user_id=current_user.id,
        encrypted_workspace_key=data.encrypted_workspace_key,
        granted_by=invite.created_by,
    ))

    invite.accepted_at = datetime.now(UTC)
    invite.accepted_by = current_user.id
    db.commit()

    return {"workspace_id": str(invite.workspace_id), "role": invite.role}


@router.get("/workspaces/{workspace_id}/invites", response_model=list[InviteSummary])
def list_invites(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws_uuid = _require_manager(workspace_id, current_user, db)

    invites = (
        db.query(WorkspaceInvite)
        .filter(
            WorkspaceInvite.workspace_id == ws_uuid,
            WorkspaceInvite.accepted_at.is_(None),
        )
        .order_by(WorkspaceInvite.created_at.desc())
        .all()
    )
    # Note: no key material and no token hash — an admin listing invites has no need for
    # either, and the wrapped key would be one more copy of it lying around.
    return [
        InviteSummary(
            id=str(i.id),
            role=i.role,
            email=i.email,
            created_at=i.created_at,
            expires_at=i.expires_at,
            accepted_at=i.accepted_at,
        )
        for i in invites
    ]


@router.delete("/workspaces/{workspace_id}/invites/{invite_id}")
def revoke_invite(
    workspace_id: str,
    invite_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws_uuid = _require_manager(workspace_id, current_user, db)
    invite_uuid = parse_uuid(invite_id, "invite ID")

    invite = (
        db.query(WorkspaceInvite)
        .filter(WorkspaceInvite.id == invite_uuid, WorkspaceInvite.workspace_id == ws_uuid)
        .first()
    )
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    db.delete(invite)
    db.commit()
    return {"status": "revoked"}
