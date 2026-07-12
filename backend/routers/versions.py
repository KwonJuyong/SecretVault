from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.page_version import MAX_VERSIONS_PER_PAGE, PageVersion
from models.user import User
from services.auth import get_current_user
from services.permissions import get_page_in_workspace, verify_workspace_access

router = APIRouter(tags=["versions"])


class VersionCreate(BaseModel):
    # Encrypted Yjs snapshot of the whole document, produced by the browser.
    encrypted_snapshot: str


class VersionSummary(BaseModel):
    """The history list. Carries no content — a list of 50 full snapshots would be a lot
    of ciphertext to ship just to draw some timestamps."""

    id: int
    created_at: datetime
    created_by_email: str | None = None


class VersionDetail(BaseModel):
    id: int
    created_at: datetime
    created_by_email: str | None = None
    encrypted_snapshot: str


@router.post("/workspaces/{workspace_id}/pages/{page_id}/versions")
def create_version(
    workspace_id: str,
    page_id: str,
    data: VersionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws_uuid = verify_workspace_access(workspace_id, current_user, db)
    page = get_page_in_workspace(db, page_id, ws_uuid)

    db.add(PageVersion(
        page_id=page.id,
        encrypted_snapshot=data.encrypted_snapshot,
        created_by=current_user.id,
    ))
    db.flush()

    # Prune. Done here rather than on a schedule so the cap actually holds without a
    # background job to forget about.
    stale = (
        db.query(PageVersion.id)
        .filter(PageVersion.page_id == page.id)
        .order_by(PageVersion.created_at.desc(), PageVersion.id.desc())
        .offset(MAX_VERSIONS_PER_PAGE)
        .all()
    )
    if stale:
        db.query(PageVersion).filter(
            PageVersion.id.in_([row[0] for row in stale])
        ).delete(synchronize_session=False)

    db.commit()
    return {"status": "saved"}


@router.get(
    "/workspaces/{workspace_id}/pages/{page_id}/versions",
    response_model=list[VersionSummary],
)
def list_versions(
    workspace_id: str,
    page_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws_uuid = verify_workspace_access(workspace_id, current_user, db)
    page = get_page_in_workspace(db, page_id, ws_uuid, include_deleted=True)

    rows = (
        db.query(PageVersion, User)
        .outerjoin(User, PageVersion.created_by == User.id)
        .filter(PageVersion.page_id == page.id)
        .order_by(PageVersion.created_at.desc(), PageVersion.id.desc())
        .all()
    )
    return [
        VersionSummary(
            id=v.id,
            created_at=v.created_at,
            created_by_email=u.email if u else None,
        )
        for v, u in rows
    ]


@router.get(
    "/workspaces/{workspace_id}/pages/{page_id}/versions/{version_id}",
    response_model=VersionDetail,
)
def get_version(
    workspace_id: str,
    page_id: str,
    version_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws_uuid = verify_workspace_access(workspace_id, current_user, db)
    page = get_page_in_workspace(db, page_id, ws_uuid, include_deleted=True)

    row = (
        db.query(PageVersion, User)
        .outerjoin(User, PageVersion.created_by == User.id)
        .filter(PageVersion.id == version_id, PageVersion.page_id == page.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Version not found")

    version, user = row
    return VersionDetail(
        id=version.id,
        created_at=version.created_at,
        created_by_email=user.email if user else None,
        encrypted_snapshot=version.encrypted_snapshot,
    )
