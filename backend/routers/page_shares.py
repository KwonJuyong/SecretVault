import uuid
from typing import List
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from models.workspace import Workspace, WorkspaceMember
from models.page import Page
from models.page_share import PageShare
from schemas.page_share import PageShareCreate, PageShareUpdate, PageShareResponse, SharedPageItem
from services.auth import get_current_user

router = APIRouter(tags=["page-shares"])


def _verify_page_owner(workspace_id: str, page_id: str, user: User, db: Session):
    """Verify user has access to the workspace and the page exists."""
    ws_uuid = uuid.UUID(workspace_id)
    membership = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.workspace_id == ws_uuid, WorkspaceMember.user_id == user.id)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Access denied")

    page = (
        db.query(Page)
        .filter(Page.id == uuid.UUID(page_id), Page.workspace_id == ws_uuid, Page.is_deleted == False)
        .first()
    )
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    return ws_uuid, page


@router.get("/workspaces/{workspace_id}/pages/{page_id}/shares", response_model=List[PageShareResponse])
def list_page_shares(
    workspace_id: str,
    page_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws_uuid, page = _verify_page_owner(workspace_id, page_id, current_user, db)

    shares = (
        db.query(PageShare, User)
        .join(User, PageShare.user_id == User.id)
        .filter(PageShare.page_id == page.id)
        .all()
    )

    result = []
    for share, user in shares:
        shared_by = db.query(User).filter(User.id == share.shared_by).first()
        result.append(PageShareResponse(
            id=share.id,
            page_id=str(share.page_id),
            email=user.email,
            display_name=user.display_name,
            permission=share.permission,
            shared_by_email=shared_by.email if shared_by else None,
            created_at=share.created_at,
        ))
    return result


@router.post("/workspaces/{workspace_id}/pages/{page_id}/shares")
def share_page(
    workspace_id: str,
    page_id: str,
    data: PageShareCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws_uuid, page = _verify_page_owner(workspace_id, page_id, current_user, db)

    target_user = db.query(User).filter(User.email == data.email).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    if target_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot share with yourself")

    existing = (
        db.query(PageShare)
        .filter(PageShare.page_id == page.id, PageShare.user_id == target_user.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Page already shared with this user")

    share = PageShare(
        page_id=page.id,
        user_id=target_user.id,
        permission=data.permission or "view",
        shared_by=current_user.id,
    )
    db.add(share)
    db.commit()
    return {"message": "Page shared successfully"}


@router.put("/workspaces/{workspace_id}/pages/{page_id}/shares/{share_id}")
def update_page_share(
    workspace_id: str,
    page_id: str,
    share_id: int,
    data: PageShareUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws_uuid, page = _verify_page_owner(workspace_id, page_id, current_user, db)

    share = (
        db.query(PageShare)
        .filter(PageShare.id == share_id, PageShare.page_id == page.id)
        .first()
    )
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    share.permission = data.permission
    db.commit()
    return {"message": "Permission updated"}


@router.delete("/workspaces/{workspace_id}/pages/{page_id}/shares/{share_id}")
def remove_page_share(
    workspace_id: str,
    page_id: str,
    share_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws_uuid, page = _verify_page_owner(workspace_id, page_id, current_user, db)

    share = (
        db.query(PageShare)
        .filter(PageShare.id == share_id, PageShare.page_id == page.id)
        .first()
    )
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    db.delete(share)
    db.commit()
    return {"message": "Share removed"}


@router.get("/shared-pages", response_model=List[SharedPageItem])
def list_shared_pages(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all pages shared with the current user."""
    shares = (
        db.query(PageShare, Page, Workspace)
        .join(Page, PageShare.page_id == Page.id)
        .join(Workspace, Page.workspace_id == Workspace.id)
        .filter(PageShare.user_id == current_user.id, Page.is_deleted == False)
        .all()
    )

    result = []
    for share, page, ws in shares:
        shared_by = db.query(User).filter(User.id == share.shared_by).first()
        result.append(SharedPageItem(
            id=str(page.id),
            title=page.title,
            icon=page.icon or "",
            workspace_id=str(page.workspace_id),
            workspace_name=ws.name,
            permission=share.permission,
            shared_by_email=shared_by.email if shared_by else None,
            updated_at=page.updated_at,
        ))
    return result


@router.get("/shared-pages/{page_id}")
def get_shared_page(
    page_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Load a page that has been shared with the current user."""
    page_uuid = uuid.UUID(page_id)
    share = (
        db.query(PageShare)
        .filter(PageShare.page_id == page_uuid, PageShare.user_id == current_user.id)
        .first()
    )
    if not share:
        raise HTTPException(status_code=403, detail="This page has not been shared with you")

    page = db.query(Page).filter(Page.id == page_uuid, Page.is_deleted == False).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    return {
        "id": str(page.id),
        "workspace_id": str(page.workspace_id),
        "parent_id": str(page.parent_id) if page.parent_id else None,
        "title": page.title,
        "content": page.content or "",
        "icon": page.icon or "",
        "position": page.position,
        "is_deleted": page.is_deleted,
        "permission": share.permission,
        "created_at": page.created_at,
        "updated_at": page.updated_at,
    }


@router.put("/shared-pages/{page_id}")
def update_shared_page(
    page_id: str,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a page that has been shared with edit permission."""
    page_uuid = uuid.UUID(page_id)
    share = (
        db.query(PageShare)
        .filter(PageShare.page_id == page_uuid, PageShare.user_id == current_user.id)
        .first()
    )
    if not share:
        raise HTTPException(status_code=403, detail="This page has not been shared with you")
    if share.permission != "edit":
        raise HTTPException(status_code=403, detail="You only have view permission")

    page = db.query(Page).filter(Page.id == page_uuid, Page.is_deleted == False).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    if "title" in data:
        page.title = data["title"]
    if "content" in data:
        page.content = data["content"]
    if "icon" in data:
        page.icon = data["icon"]

    db.commit()
    db.refresh(page)
    return {"status": "updated"}
