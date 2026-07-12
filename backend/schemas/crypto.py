
from pydantic import BaseModel


class UserKeyPairCreate(BaseModel):
    public_key: str
    encrypted_private_key: str
    private_key_iv: str
    private_key_salt: str


class UserKeyPairResponse(BaseModel):
    public_key: str
    encrypted_private_key: str
    private_key_iv: str
    private_key_salt: str


class UserPublicKeyResponse(BaseModel):
    user_id: int
    email: str
    public_key: str


class PageKeyGrantCreate(BaseModel):
    user_id: int
    encrypted_page_key: str


class PageKeyGrantBatch(BaseModel):
    grants: list[PageKeyGrantCreate]
