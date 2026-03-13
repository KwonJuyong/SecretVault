from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class PageCreate(BaseModel):
    title: Optional[str] = ""
    content: Optional[str] = ""
    parent_id: Optional[str] = None
    icon: Optional[str] = ""
    position: Optional[float] = None


class PageUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    icon: Optional[str] = None
    position: Optional[float] = None


class PageResponse(BaseModel):
    id: str
    workspace_id: str
    parent_id: Optional[str] = None
    title: str
    content: str
    icon: Optional[str] = ""
    position: float
    is_deleted: bool
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
    updated_at: Optional[datetime] = None


class PageMove(BaseModel):
    parent_id: Optional[str] = None
    position: Optional[float] = None
