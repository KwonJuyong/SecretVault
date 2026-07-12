from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models.page import Page
from models.page_favorite import PageFavorite
from models.user import User
from schemas.page import PageTreeItem
from services.auth import get_current_user
from services.permissions import get_page_in_workspace, verify_workspace_access

router = APIRouter(tags=["favorites"])


@router.get("/favorites", response_model=list[PageTreeItem])
def list_favorites(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The caller's starred pages, across every workspace they belong to.

    Joined against pages rather than read straight off the favorites table, so a page that
    has since been trashed or hard-deleted cannot come back as a dangling entry.
    """
    rows = (
        db.query(Page)
        .join(PageFavorite, PageFavorite.page_id == Page.id)
        .filter(
            PageFavorite.user_id == current_user.id,
            Page.is_deleted == False,  # noqa: E712
        )
        .order_by(PageFavorite.created_at.desc())
        .all()
    )
    return [
        PageTreeItem(
            id=str(p.id),
            title=p.title,
            icon=p.icon or "",
            parent_id=str(p.parent_id) if p.parent_id else None,
            position=p.position,
            has_children=False,
            encryption_version=p.encryption_version or 1,
            encrypted_page_key=p.encrypted_page_key,
            updated_at=p.updated_at,
        )
        for p in rows
    ]


@router.post("/workspaces/{workspace_id}/pages/{page_id}/favorite")
def add_favorite(
    workspace_id: str,
    page_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws_uuid = verify_workspace_access(workspace_id, current_user, db)
    page = get_page_in_workspace(db, page_id, ws_uuid)

    existing = (
        db.query(PageFavorite)
        .filter(PageFavorite.page_id == page.id, PageFavorite.user_id == current_user.id)
        .first()
    )
    if not existing:  # starring twice is a no-op, not an error
        db.add(PageFavorite(page_id=page.id, user_id=current_user.id))
        db.commit()

    return {"status": "favorited"}


@router.delete("/workspaces/{workspace_id}/pages/{page_id}/favorite")
def remove_favorite(
    workspace_id: str,
    page_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws_uuid = verify_workspace_access(workspace_id, current_user, db)
    page = get_page_in_workspace(db, page_id, ws_uuid, include_deleted=True)

    db.query(PageFavorite).filter(
        PageFavorite.page_id == page.id,
        PageFavorite.user_id == current_user.id,
    ).delete()
    db.commit()

    return {"status": "unfavorited"}
