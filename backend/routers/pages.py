import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc

from database import get_db
from models.user import User
from models.workspace import WorkspaceMember
from models.page import Page
from models.page_key_grant import PageKeyGrant
from schemas.page import PageCreate, PageUpdate, PageResponse, PageTreeItem, PageMove, KeyGrantItem, BatchKeyGrantsRequest
from services.auth import get_current_user

router = APIRouter(tags=["pages"])


def _parse_uuid(value: str, label: str = "ID") -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail=f"Invalid {label}")


def verify_workspace_access(workspace_id: str, user: User, db: Session) -> uuid.UUID:
    ws_uuid = _parse_uuid(workspace_id, "workspace ID")
    membership = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.workspace_id == ws_uuid, WorkspaceMember.user_id == user.id)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Access denied")
    return ws_uuid


@router.get("/workspaces/{workspace_id}/pages", response_model=List[PageTreeItem])
def list_pages(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws_uuid = verify_workspace_access(workspace_id, current_user, db)
    pages = (
        db.query(Page)
        .filter(Page.workspace_id == ws_uuid, Page.is_deleted == False)
        .order_by(Page.position)
        .all()
    )

    parent_ids = set()
    for p in pages:
        if p.parent_id:
            parent_ids.add(p.parent_id)

    # Batch load key grants for current user
    page_ids = [p.id for p in pages]
    grants = {}
    if page_ids:
        grant_rows = (
            db.query(PageKeyGrant)
            .filter(PageKeyGrant.page_id.in_(page_ids), PageKeyGrant.user_id == current_user.id)
            .all()
        )
        for g in grant_rows:
            grants[g.page_id] = g.encrypted_page_key

    return [
        PageTreeItem(
            id=str(p.id),
            title=p.title,
            icon=p.icon or "",
            parent_id=str(p.parent_id) if p.parent_id else None,
            position=p.position,
            has_children=p.id in parent_ids,
            encryption_version=p.encryption_version or 1,
            encrypted_page_key=grants.get(p.id),
            updated_at=p.updated_at,
        )
        for p in pages
    ]


@router.post("/workspaces/{workspace_id}/pages", response_model=PageResponse)
def create_page(
    workspace_id: str,
    data: PageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws_uuid = verify_workspace_access(workspace_id, current_user, db)

    if data.position is not None:
        position = data.position
    else:
        max_pos = (
            db.query(sqlfunc.max(Page.position))
            .filter(
                Page.workspace_id == ws_uuid,
                Page.parent_id == (uuid.UUID(data.parent_id) if data.parent_id else None),
                Page.is_deleted == False,
            )
            .scalar()
        )
        position = (max_pos or 0) + 1.0

    parent_uuid = uuid.UUID(data.parent_id) if data.parent_id else None

    page = Page(
        id=uuid.uuid4(),
        workspace_id=ws_uuid,
        parent_id=parent_uuid,
        created_by=current_user.id,
        title=data.title or "",
        content=data.content or "",
        icon=data.icon or "",
        position=position,
        encryption_version=data.encryption_version or 1,
    )
    db.add(page)
    db.flush()

    # Store page key grant if provided
    if data.encrypted_page_key:
        grant = PageKeyGrant(
            page_id=page.id,
            user_id=current_user.id,
            encrypted_page_key=data.encrypted_page_key,
        )
        db.add(grant)

    db.commit()
    db.refresh(page)

    return _page_to_response(page, data.encrypted_page_key)


@router.get("/workspaces/{workspace_id}/pages/{page_id}", response_model=PageResponse)
def get_page(
    workspace_id: str,
    page_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws_uuid = verify_workspace_access(workspace_id, current_user, db)
    page_uuid = _parse_uuid(page_id, "page ID")
    page = (
        db.query(Page)
        .filter(Page.id == page_uuid, Page.workspace_id == ws_uuid)
        .first()
    )
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    grant = (
        db.query(PageKeyGrant)
        .filter(PageKeyGrant.page_id == page.id, PageKeyGrant.user_id == current_user.id)
        .first()
    )

    return _page_to_response(page, grant.encrypted_page_key if grant else None)


@router.put("/workspaces/{workspace_id}/pages/{page_id}", response_model=PageResponse)
def update_page(
    workspace_id: str,
    page_id: str,
    data: PageUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws_uuid = verify_workspace_access(workspace_id, current_user, db)
    page_uuid = _parse_uuid(page_id, "page ID")
    page = (
        db.query(Page)
        .filter(Page.id == page_uuid, Page.workspace_id == ws_uuid, Page.is_deleted == False)
        .first()
    )
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    if data.title is not None:
        page.title = data.title
    if data.content is not None:
        page.content = data.content
    if data.icon is not None:
        page.icon = data.icon
    if data.position is not None:
        page.position = data.position
    if data.encryption_version is not None:
        page.encryption_version = data.encryption_version

    # Update or create key grant during migration
    if data.encrypted_page_key:
        grant = (
            db.query(PageKeyGrant)
            .filter(PageKeyGrant.page_id == page.id, PageKeyGrant.user_id == current_user.id)
            .first()
        )
        if grant:
            grant.encrypted_page_key = data.encrypted_page_key
        else:
            db.add(PageKeyGrant(
                page_id=page.id,
                user_id=current_user.id,
                encrypted_page_key=data.encrypted_page_key,
            ))

    db.commit()
    db.refresh(page)

    grant = (
        db.query(PageKeyGrant)
        .filter(PageKeyGrant.page_id == page.id, PageKeyGrant.user_id == current_user.id)
        .first()
    )
    return _page_to_response(page, grant.encrypted_page_key if grant else None)


@router.delete("/workspaces/{workspace_id}/pages/{page_id}")
def delete_page(
    workspace_id: str,
    page_id: str,
    permanent: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws_uuid = verify_workspace_access(workspace_id, current_user, db)
    page_uuid = _parse_uuid(page_id, "page ID")
    page = (
        db.query(Page)
        .filter(Page.id == page_uuid, Page.workspace_id == ws_uuid)
        .first()
    )
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    if permanent:
        _delete_page_tree(db, page.id, ws_uuid)
        db.commit()
    else:
        page.is_deleted = True
        page.deleted_at = datetime.now(timezone.utc)
        _soft_delete_children(db, page.id, ws_uuid)
        db.commit()

    return {"status": "deleted"}


@router.post("/workspaces/{workspace_id}/pages/{page_id}/restore")
def restore_page(
    workspace_id: str,
    page_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws_uuid = verify_workspace_access(workspace_id, current_user, db)
    page_uuid = _parse_uuid(page_id, "page ID")
    page = (
        db.query(Page)
        .filter(Page.id == page_uuid, Page.workspace_id == ws_uuid, Page.is_deleted == True)
        .first()
    )
    if not page:
        raise HTTPException(status_code=404, detail="Page not found in trash")

    page.is_deleted = False
    page.deleted_at = None
    if page.parent_id:
        parent = db.query(Page).filter(Page.id == page.parent_id).first()
        if parent and parent.is_deleted:
            page.parent_id = None
    db.commit()
    return {"status": "restored"}


@router.get("/workspaces/{workspace_id}/trash", response_model=List[PageTreeItem])
def list_trash(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws_uuid = verify_workspace_access(workspace_id, current_user, db)
    pages = (
        db.query(Page)
        .filter(Page.workspace_id == ws_uuid, Page.is_deleted == True)
        .order_by(Page.deleted_at.desc())
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
            updated_at=p.updated_at,
        )
        for p in pages
    ]


@router.post("/workspaces/{workspace_id}/pages/{page_id}/move")
def move_page(
    workspace_id: str,
    page_id: str,
    data: PageMove,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws_uuid = verify_workspace_access(workspace_id, current_user, db)
    page_uuid = _parse_uuid(page_id, "page ID")
    page = (
        db.query(Page)
        .filter(Page.id == page_uuid, Page.workspace_id == ws_uuid, Page.is_deleted == False)
        .first()
    )
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    if data.parent_id is not None:
        page.parent_id = _parse_uuid(data.parent_id, "parent ID") if data.parent_id else None
    if data.position is not None:
        page.position = data.position

    db.commit()
    return {"status": "moved"}


# Batch key grant endpoint for migration
@router.post("/workspaces/{workspace_id}/pages/{page_id}/key-grants")
def batch_key_grants(
    workspace_id: str,
    page_id: str,
    data: BatchKeyGrantsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws_uuid = verify_workspace_access(workspace_id, current_user, db)
    page_uuid = _parse_uuid(page_id, "page ID")
    page = (
        db.query(Page)
        .filter(Page.id == page_uuid, Page.workspace_id == ws_uuid)
        .first()
    )
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    for g in data.grants:
        existing = (
            db.query(PageKeyGrant)
            .filter(PageKeyGrant.page_id == page.id, PageKeyGrant.user_id == g.user_id)
            .first()
        )
        if existing:
            existing.encrypted_page_key = g.encrypted_page_key
        else:
            db.add(PageKeyGrant(
                page_id=page.id,
                user_id=g.user_id,
                encrypted_page_key=g.encrypted_page_key,
            ))
    db.commit()
    return {"message": f"{len(data.grants)} key grants stored"}


def _page_to_response(page: Page, page_key_grant: Optional[str] = None) -> PageResponse:
    return PageResponse(
        id=str(page.id),
        workspace_id=str(page.workspace_id),
        parent_id=str(page.parent_id) if page.parent_id else None,
        title=page.title,
        content=page.content or "",
        icon=page.icon or "",
        position=page.position,
        is_deleted=page.is_deleted,
        encryption_version=page.encryption_version or 1,
        page_key_grant=page_key_grant,
        created_at=page.created_at,
        updated_at=page.updated_at,
    )


def _soft_delete_children(db: Session, parent_id: uuid.UUID, workspace_id: uuid.UUID) -> None:
    """Recursively mark child pages as deleted. Caller is responsible for db.commit()."""
    children = db.query(Page).filter(
        Page.parent_id == parent_id, Page.workspace_id == workspace_id
    ).all()
    now = datetime.now(timezone.utc)
    for child in children:
        child.is_deleted = True
        child.deleted_at = now
        _soft_delete_children(db, child.id, workspace_id)


def _delete_page_tree(db: Session, page_id: uuid.UUID, workspace_id: uuid.UUID) -> None:
    """Recursively hard-delete a page and all its descendants. Caller is responsible for db.commit()."""
    children = db.query(Page).filter(
        Page.parent_id == page_id, Page.workspace_id == workspace_id
    ).all()
    for child in children:
        _delete_page_tree(db, child.id, workspace_id)
    db.query(PageKeyGrant).filter(PageKeyGrant.page_id == page_id).delete()
    db.query(Page).filter(Page.id == page_id).delete()
