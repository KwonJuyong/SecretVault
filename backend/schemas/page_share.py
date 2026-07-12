from datetime import datetime

from pydantic import BaseModel


class PageShareCreate(BaseModel):
    email: str
    permission: str | None = "view"
    encrypted_page_key: str | None = None


class PageShareUpdate(BaseModel):
    permission: str


class PageShareResponse(BaseModel):
    id: int
    page_id: str
    email: str
    display_name: str | None = None
    permission: str
    shared_by_email: str | None = None
    created_at: datetime | None = None


class SharedPageItem(BaseModel):
    id: str
    title: str
    icon: str
    workspace_id: str
    workspace_name: str
    permission: str
    shared_by_email: str | None = None
    updated_at: datetime | None = None
    page_key_grant: str | None = None


class KeyGrantCreate(BaseModel):
    email: str
    encrypted_page_key: str


class SharedPageUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    icon: str | None = None
