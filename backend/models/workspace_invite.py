import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class WorkspaceInvite(Base):
    """A pending invite to a workspace, usable by someone who has no account yet.

    The workspace key is stored here wrapped under a key derived from a secret that exists
    only in the invite link's URL fragment. Browsers never transmit a fragment, so the
    server cannot unwrap what it is holding.

    It stores only a SHA-256 of the invite's auth token — a separate HKDF output from the
    same secret. That proves a caller holds the link without giving the server anything it
    could work back to the wrapping key with. Without it, anyone who guessed an invite id
    could join the workspace.
    """

    __tablename__ = "workspace_invites"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Hex SHA-256 of the invite's auth token. Never the token itself.
    auth_token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    # The workspace key, AES-KW-wrapped under the link secret. Opaque to the server.
    encrypted_workspace_key: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="member")
    # Optional: pin the invite to one address, so a leaked link is still useless to others.
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)

    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    accepted_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
