from datetime import datetime

from pydantic import BaseModel, Field


class InviteCreate(BaseModel):
    # SHA-256 (hex) of the invite's auth token. The token itself must never reach us.
    auth_token_hash: str = Field(min_length=64, max_length=64)
    # The workspace key, wrapped under a key derived from the link secret. Opaque here.
    encrypted_workspace_key: str
    role: str | None = "member"
    # Optional: pin the invite to one address, so a leaked link is useless to anyone else.
    email: str | None = None
    expires_in_days: int = Field(default=7, ge=1, le=90)


class InviteCreated(BaseModel):
    id: str
    expires_at: datetime


class InvitePreview(BaseModel):
    """What an invitee sees before they have an account. Deliberately thin."""

    id: str
    workspace_id: str
    workspace_name: str
    role: str
    email: str | None = None
    invited_by_email: str | None = None
    encrypted_workspace_key: str
    expires_at: datetime


class InviteAccept(BaseModel):
    auth_token: str
    # The workspace key, now re-wrapped under the accepting user's own RSA public key.
    encrypted_workspace_key: str


class InviteSummary(BaseModel):
    """For the workspace owner's list of outstanding invites. Carries no key material."""

    id: str
    role: str
    email: str | None = None
    created_at: datetime
    expires_at: datetime
    accepted_at: datetime | None = None
