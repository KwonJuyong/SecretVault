"""Shared access checks for workspaces and pages.

These used to be duplicated across routers, and the copies drifted: pages.py guarded the
key-grant endpoint with a plain membership check while page_shares.py guarded the
equivalent one with an ownership check. Keeping them in one place is what stops that.
"""
import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.page import Page
from models.user import User
from models.workspace import WorkspaceMember

MANAGE_ROLES = ("owner", "admin")


def parse_uuid(value: str, label: str = "ID") -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(status_code=400, detail=f"Invalid {label}") from None


def get_membership(db: Session, workspace_id: uuid.UUID, user: User) -> WorkspaceMember:
    membership = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.user_id == user.id)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Access denied")
    return membership


def verify_workspace_access(workspace_id: str, user: User, db: Session) -> uuid.UUID:
    """Caller is a member of the workspace. Returns the parsed workspace id."""
    ws_uuid = parse_uuid(workspace_id, "workspace ID")
    get_membership(db, ws_uuid, user)
    return ws_uuid


def get_page_in_workspace(
    db: Session, page_id: str, workspace_id: uuid.UUID, *, include_deleted: bool = False
) -> Page:
    page_uuid = parse_uuid(page_id, "page ID")
    q = db.query(Page).filter(Page.id == page_uuid, Page.workspace_id == workspace_id)
    if not include_deleted:
        q = q.filter(Page.is_deleted == False)  # noqa: E712
    page = q.first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return page


def verify_page_manage(
    workspace_id: str, page_id: str, user: User, db: Session, *, include_deleted: bool = False
) -> tuple[uuid.UUID, Page]:
    """Caller may administer this page: they created it, or they run the workspace.

    Use for anything destructive or authority-granting — sharing, key grants, hard delete.
    """
    ws_uuid = parse_uuid(workspace_id, "workspace ID")
    membership = get_membership(db, ws_uuid, user)
    page = get_page_in_workspace(db, page_id, ws_uuid, include_deleted=include_deleted)

    if page.created_by != user.id and membership.role not in MANAGE_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Only the page creator or a workspace admin can do this",
        )
    return ws_uuid, page


def is_self_or_descendant(
    db: Session, candidate_id: uuid.UUID, page_id: uuid.UUID, workspace_id: uuid.UUID
) -> bool:
    """True if `candidate_id` is `page_id` itself or sits underneath it.

    Reparenting a page onto its own descendant closes a loop in the tree, and the
    recursive delete/soft-delete walks would then recurse until the stack blows.
    """
    if candidate_id == page_id:
        return True

    seen: set[uuid.UUID] = set()
    current: uuid.UUID | None = candidate_id
    while current is not None and current not in seen:
        seen.add(current)
        row = (
            db.query(Page.parent_id)
            .filter(Page.id == current, Page.workspace_id == workspace_id)
            .first()
        )
        if row is None:
            return False
        current = row[0]
        if current == page_id:
            return True
    return False
