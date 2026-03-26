from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from database import Base


class UserKeyPair(Base):
    __tablename__ = "user_keypairs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    public_key = Column(Text, nullable=False)
    encrypted_private_key = Column(Text, nullable=False)
    private_key_iv = Column(String(64), nullable=False)
    private_key_salt = Column(String(64), nullable=False)
    key_algorithm = Column(String(20), default="RSA-OAEP")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
