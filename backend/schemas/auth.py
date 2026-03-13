from pydantic import BaseModel
from typing import Optional


class UserSignup(BaseModel):
    user_id: str
    password_hash: str
    display_name: Optional[str] = None


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
