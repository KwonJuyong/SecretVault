from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class WorkspaceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = ""


class WorkspaceResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    icon: Optional[str] = ""
    owner_id: int
    role: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WorkspaceMemberResponse(BaseModel):
    email: str
    display_name: Optional[str] = None
    role: str
    joined_at: Optional[datetime] = None


class InviteMember(BaseModel):
    email: str
    role: Optional[str] = "member"
