from datetime import datetime

from pydantic import BaseModel


class WorkspaceCreate(BaseModel):
    name: str
    description: str | None = None
    icon: str | None = ""
    # The workspace key, wrapped with the creator's own RSA public key by their browser.
    encrypted_workspace_key: str | None = None


class WorkspaceResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    icon: str | None = ""
    owner_id: int
    role: str | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class WorkspaceMemberResponse(BaseModel):
    email: str
    display_name: str | None = None
    role: str
    joined_at: datetime | None = None


class InviteMember(BaseModel):
    email: str
    role: str | None = "member"
    # The workspace key re-wrapped for the invitee, produced by the inviter's browser.
    # Required on invite: a member without this cannot decrypt a single page.
    encrypted_workspace_key: str | None = None


class WorkspaceKeyResponse(BaseModel):
    workspace_id: str
    encrypted_workspace_key: str
