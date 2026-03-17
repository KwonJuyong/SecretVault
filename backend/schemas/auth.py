import re
from pydantic import BaseModel, field_validator
from typing import Optional


class UserSignup(BaseModel):
    user_id: str
    password_hash: str
    display_name: Optional[str] = None

    @field_validator('user_id')
    @classmethod
    def validate_user_id(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2 or len(v) > 50:
            raise ValueError('Username must be 2-50 characters')
        if not re.match(r'^[a-zA-Z0-9_.\-]+$', v):
            raise ValueError('Username can only contain letters, numbers, _, ., -')
        return v

    @field_validator('password_hash')
    @classmethod
    def validate_password_hash(cls, v: str) -> str:
        if len(v) < 10 or len(v) > 256:
            raise ValueError('Invalid password hash')
        return v

    @field_validator('display_name')
    @classmethod
    def validate_display_name(cls, v: Optional[str]) -> Optional[str]:
        if v and len(v) > 100:
            raise ValueError('Display name too long')
        return v


class UserLogin(BaseModel):
    user_id: str
    password_hash: str


class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    display_name: Optional[str] = None
    workspace_id: str


class UserProfile(BaseModel):
    user_id: str
    display_name: Optional[str] = None
    email: Optional[str] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class UserProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    email: Optional[str] = None
