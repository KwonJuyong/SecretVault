from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class PageCreate(BaseModel):
    title: Optional[str] = ""
    content: Optional[str] = ""
    parent_id: Optional[str] = None
    icon: Optional[str] = ""
    position: Optional[float] = None
    encryption_version: Optional[int] = 1
    encrypted_page_key: Optional[str] = None


class PageUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    icon: Optional[str] = None
    position: Optional[float] = None
    encryption_version: Optional[int] = None
    encrypted_page_key: Optional[str] = None


class PageResponse(BaseModel):
    id: str
    workspace_id: str
    parent_id: Optional[str] = None
    title: str
    content: str
    icon: Optional[str] = ""
    position: float
    is_deleted: bool
    encryption_version: int = 1
    page_key_grant: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PageTreeItem(BaseModel):
    id: str
    title: str
    icon: Optional[str] = ""
    parent_id: Optional[str] = None
    position: float
    has_children: bool = False
    encryption_version: int = 1
    encrypted_page_key: Optional[str] = None
    updated_at: Optional[datetime] = None


class PageMove(BaseModel):
    parent_id: Optional[str] = None
    position: Optional[float] = None


class KeyGrantItem(BaseModel):
    user_id: int
    encrypted_page_key: str


class BatchKeyGrantsRequest(BaseModel):
    grants: List[KeyGrantItem] = []
