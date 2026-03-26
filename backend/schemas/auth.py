import re
from pydantic import BaseModel, field_validator
from typing import Optional


class UserSignup(BaseModel):
    email: str
    password_hash: str
    username: Optional[str] = None
    public_key: Optional[str] = None
    encrypted_private_key: Optional[str] = None
    private_key_iv: Optional[str] = None
    private_key_salt: Optional[str] = None

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', v):
            raise ValueError('Invalid email format')
        if len(v) > 200:
            raise ValueError('Email too long')
        return v

    @field_validator('password_hash')
    @classmethod
    def validate_password_hash(cls, v: str) -> str:
        if len(v) < 10 or len(v) > 256:
            raise ValueError('Invalid password hash')
        return v

    @field_validator('username')
    @classmethod
    def validate_username(cls, v: Optional[str]) -> Optional[str]:
        if v and len(v) > 100:
            raise ValueError('Display name too long')
        return v


class UserLogin(BaseModel):
    email: str
    password_hash: str


class Token(BaseModel):
    access_token: str
    token_type: str
    email: str
    display_name: Optional[str] = None
    workspace_id: str
    public_key: Optional[str] = None
    encrypted_private_key: Optional[str] = None
    private_key_iv: Optional[str] = None
    private_key_salt: Optional[str] = None


class UserProfile(BaseModel):
    email: str
    display_name: Optional[str] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class UserProfileUpdate(BaseModel):
    display_name: Optional[str] = None
