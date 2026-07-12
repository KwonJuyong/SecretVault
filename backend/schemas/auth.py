import re

from pydantic import BaseModel, field_validator


class UserSignup(BaseModel):
    email: str
    password_hash: str
    username: str | None = None
    public_key: str | None = None
    encrypted_private_key: str | None = None
    private_key_iv: str | None = None
    private_key_salt: str | None = None
    # Signup creates the user's first workspace, so the browser generates that workspace's
    # key up front and sends it wrapped to its own public key. Without it the new user
    # would own a workspace they cannot encrypt anything into.
    encrypted_workspace_key: str | None = None

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
    def validate_username(cls, v: str | None) -> str | None:
        if v and len(v) > 100:
            raise ValueError('Display name too long')
        return v


class UserLogin(BaseModel):
    email: str
    password_hash: str

    @field_validator('email')
    @classmethod
    def normalise_email(cls, v: str) -> str:
        return v.strip().lower()


class Token(BaseModel):
    access_token: str
    token_type: str
    email: str
    display_name: str | None = None
    workspace_id: str
    public_key: str | None = None
    encrypted_private_key: str | None = None
    private_key_iv: str | None = None
    private_key_salt: str | None = None


class UserProfile(BaseModel):
    email: str
    display_name: str | None = None
    created_at: str | None = None

    class Config:
        from_attributes = True


class UserProfileUpdate(BaseModel):
    display_name: str | None = None
