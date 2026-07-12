from datetime import datetime

from pydantic import BaseModel


class PageCreate(BaseModel):
    title: str | None = ""
    content: str | None = ""
    parent_id: str | None = None
    icon: str | None = ""
    position: float | None = None
    encryption_version: int | None = 1
    encrypted_page_key: str | None = None


class PageUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    icon: str | None = None
    position: float | None = None
    encryption_version: int | None = None
    encrypted_page_key: str | None = None


class PageResponse(BaseModel):
    id: str
    workspace_id: str
    parent_id: str | None = None
    title: str
    content: str
    icon: str | None = ""
    position: float
    is_deleted: bool
    encryption_version: int = 1
    # The page key wrapped under the workspace key — how workspace members open the page.
    encrypted_page_key: str | None = None
    # The page key wrapped directly to one user's RSA key — how a per-page share to
    # someone outside the workspace works. Only one of the two is normally needed.
    page_key_grant: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class PageTreeItem(BaseModel):
    id: str
    title: str
    icon: str | None = ""
    parent_id: str | None = None
    position: float
    has_children: bool = False
    encryption_version: int = 1
    encrypted_page_key: str | None = None
    updated_at: datetime | None = None


class PageMove(BaseModel):
    parent_id: str | None = None
    position: float | None = None


class KeyGrantItem(BaseModel):
    user_id: int
    encrypted_page_key: str


class BatchKeyGrantsRequest(BaseModel):
    grants: list[KeyGrantItem] = []
