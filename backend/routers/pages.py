import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func as sqlfunc
from sqlalchemy.orm import Session

from database import get_db
from models.page import Page
from models.page_favorite import PageFavorite
from models.page_key_grant import PageKeyGrant
from models.user import User
from schemas.page import (
    BatchKeyGrantsRequest,
    PageCreate,
    PageMove,
    PageResponse,
    PageTreeItem,
    PageUpdate,
)
from services.auth import get_current_user
from services.permissions import (
    get_page_in_workspace,
    is_self_or_descendant,
    verify_page_manage,
    verify_workspace_access,
)
from services.permissions import (
    parse_uuid as _parse_uuid,
)

router = APIRouter(tags=["pages"])


def _resolve_parent(
    db: Session, parent_id: str | None, workspace_id: uuid.UUID
) -> uuid.UUID | None:
    """Validate a requested parent: it must be a live page in this same workspace.

    Without the workspace check a page could be parented into a workspace the caller
    cannot even see, stranding it outside every tree that would render it.
    """
    if not parent_id:
        return None
    parent_uuid = _parse_uuid(parent_id, "parent ID")
    parent = (
        db.query(Page)
        .filter(
            Page.id == parent_uuid,
            Page.workspace_id == workspace_id,
            Page.is_deleted == False,  # noqa: E712
        )
        .first()
    )
    if not parent:
        raise HTTPException(status_code=400, detail="Parent page not found in this workspace")
    return parent_uuid


@router.get("/workspaces/{workspace_id}/pages", response_model=list[PageTreeItem])
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

    return [
        PageTreeItem(
            id=str(p.id),
            title=p.title,
            icon=p.icon or "",
            parent_id=str(p.parent_id) if p.parent_id else None,
            position=p.position,
            has_children=p.id in parent_ids,
            encryption_version=p.encryption_version or 1,
            # Wrapped under the workspace key, so it is the same blob for every member —
            # no per-user lookup, and nobody is left without a key.
            encrypted_page_key=p.encrypted_page_key,
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
    parent_uuid = _resolve_parent(db, data.parent_id, ws_uuid)

    if data.position is not None:
        position = data.position
    else:
        max_pos = (
            db.query(sqlfunc.max(Page.position))
            .filter(
                Page.workspace_id == ws_uuid,
                Page.parent_id == parent_uuid,
                Page.is_deleted == False,
            )
            .scalar()
        )
        position = (max_pos or 0) + 1.0

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
        # Wrapped under the workspace key by the creator's browser. Stored on the page
        # itself rather than granted per-user, which is what lets every member — present
        # and future — open it without anyone re-wrapping anything.
        encrypted_page_key=data.encrypted_page_key,
    )
    db.add(page)
    db.commit()
    db.refresh(page)

    return _page_to_response(page)


@router.get("/workspaces/{workspace_id}/pages/{page_id}", response_model=PageResponse)
def get_page(
    workspace_id: str,
    page_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws_uuid = verify_workspace_access(workspace_id, current_user, db)
    page = get_page_in_workspace(db, page_id, ws_uuid, include_deleted=True)

    # A direct per-user grant only exists for pages shared outside the workspace; members
    # normally read via page.encrypted_page_key. Return whichever is present.
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
    page = get_page_in_workspace(db, page_id, ws_uuid)

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
    if data.encrypted_page_key:
        page.encrypted_page_key = data.encrypted_page_key

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
    if permanent:
        # Unrecoverable, and it takes the whole subtree with it: restrict to the page's
        # creator or a workspace admin rather than any member who can see the page.
        ws_uuid, page = verify_page_manage(
            workspace_id, page_id, current_user, db, include_deleted=True
        )
        _delete_page_tree(db, page.id, ws_uuid)
        db.commit()
    else:
        # Soft delete is reversible from the trash, so any member may do it.
        ws_uuid = verify_workspace_access(workspace_id, current_user, db)
        page = get_page_in_workspace(db, page_id, ws_uuid, include_deleted=True)

        page.is_deleted = True
        page.deleted_at = datetime.now(UTC)
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


@router.get("/workspaces/{workspace_id}/trash", response_model=list[PageTreeItem])
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
    page = get_page_in_workspace(db, page_id, ws_uuid)

    # `parent_id: null` means "move to the top level" and must be told apart from an
    # omitted field, which means "leave the parent alone". Checking `is not None` conflates
    # the two and made it impossible to drag a page back out to the root.
    if "parent_id" in data.model_fields_set:
        new_parent = _resolve_parent(db, data.parent_id, ws_uuid)
        if new_parent is not None and is_self_or_descendant(db, new_parent, page.id, ws_uuid):
            raise HTTPException(
                status_code=400,
                detail="Cannot move a page into itself or one of its own subpages",
            )
        page.parent_id = new_parent
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
    # Writing key grants hands out access to a page, so it needs the same authority as
    # sharing it. A plain membership check let any member overwrite anyone's grant.
    ws_uuid, page = verify_page_manage(workspace_id, page_id, current_user, db)

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


def _page_to_response(page: Page, page_key_grant: str | None = None) -> PageResponse:
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
        encrypted_page_key=page.encrypted_page_key,
        page_key_grant=page_key_grant,
        created_at=page.created_at,
        updated_at=page.updated_at,
    )


def _soft_delete_children(db: Session, parent_id: uuid.UUID, workspace_id: uuid.UUID) -> None:
    """Recursively mark child pages as deleted. Caller is responsible for db.commit()."""
    children = db.query(Page).filter(
        Page.parent_id == parent_id, Page.workspace_id == workspace_id
    ).all()
    now = datetime.now(UTC)
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
    db.query(PageFavorite).filter(PageFavorite.page_id == page_id).delete()
    db.query(PageKeyGrant).filter(PageKeyGrant.page_id == page_id).delete()
    db.query(Page).filter(Page.id == page_id).delete()
