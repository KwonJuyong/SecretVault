from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class PageShareCreate(BaseModel):
    email: str
    permission: Optional[str] = "view"
    encrypted_page_key: Optional[str] = None


class PageShareUpdate(BaseModel):
    permission: str


class PageShareResponse(BaseModel):
    id: int
    page_id: str
    email: str
    display_name: Optional[str] = None
    permission: str
    shared_by_email: Optional[str] = None
    created_at: Optional[datetime] = None


class SharedPageItem(BaseModel):
    id: str
    title: str
    icon: str
    workspace_id: str
    workspace_name: str
    permission: str
    shared_by_email: Optional[str] = None
    updated_at: Optional[datetime] = None
