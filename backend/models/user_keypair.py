from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class UserKeyPair(Base):
    __tablename__ = "user_keypairs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    public_key: Mapped[str] = mapped_column(Text, nullable=False)
    encrypted_private_key: Mapped[str] = mapped_column(Text, nullable=False)
    private_key_iv: Mapped[str] = mapped_column(String(64), nullable=False)
    private_key_salt: Mapped[str] = mapped_column(String(64), nullable=False)
    key_algorithm: Mapped[str] = mapped_column(String(20), default="RSA-OAEP")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
