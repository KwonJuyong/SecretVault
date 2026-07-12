import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base

# How many versions to keep per page. Older ones are pruned as new ones arrive: history is
# a safety net, not an archive, and every snapshot is a full copy of the document.
MAX_VERSIONS_PER_PAGE = 50


class PageVersion(Base):
    """A point-in-time snapshot of a page, encrypted with that page's key.

    Stored as a Yjs snapshot, exactly like pages.content — so restoring is a CRDT merge
    rather than a clobber, and the server still cannot read any of it.
    """

    __tablename__ = "page_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    page_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("pages.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Encrypted Yjs snapshot. Opaque to the server.
    encrypted_snapshot: Mapped[str] = mapped_column(Text, nullable=False)
    created_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
