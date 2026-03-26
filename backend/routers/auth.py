import uuid
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from models.workspace import Workspace, WorkspaceMember
from models.user_keypair import UserKeyPair
from schemas.auth import UserSignup, UserLogin, Token, UserProfile, UserProfileUpdate
from schemas.crypto import UserKeyPairCreate, UserKeyPairResponse, UserPublicKeyResponse
from services.auth import hash_password, verify_password, needs_rehash, create_access_token, get_current_user

router = APIRouter(tags=["auth"])


@router.post("/signup")
def signup(data: UserSignup, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already exists")

    user = User(
        email=data.email,
        password_hash=hash_password(data.password_hash),
        display_name=data.username or data.email,
    )
    db.add(user)
    db.flush()

    # Store key pair if provided
    if data.public_key and data.encrypted_private_key:
        keypair = UserKeyPair(
            user_id=user.id,
            public_key=data.public_key,
            encrypted_private_key=data.encrypted_private_key,
            private_key_iv=data.private_key_iv or "",
            private_key_salt=data.private_key_salt or "",
        )
        db.add(keypair)

    workspace = Workspace(
        id=uuid.uuid4(),
        name=f"{data.username or data.email}'s Workspace",
        icon="",
        owner_id=user.id,
    )
    db.add(workspace)
    db.flush()

    member = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=user.id,
        role="owner",
    )
    db.add(member)
    db.commit()

    return {"message": "Account created successfully"}


@router.post("/login", response_model=Token)
def login(data: UserLogin, db: Session = Depends(get_db)):
    result = (
        db.query(User, WorkspaceMember.workspace_id)
        .outerjoin(WorkspaceMember, WorkspaceMember.user_id == User.id)
        .filter(User.email == data.email)
        .first()
    )

    if not result:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user, workspace_id = result

    if not verify_password(data.password_hash, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(data.password_hash)
        db.commit()

    # Fetch key pair
    keypair = db.query(UserKeyPair).filter(UserKeyPair.user_id == user.id).first()

    token = create_access_token(data={"sub": user.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "email": user.email,
        "display_name": user.display_name,
        "workspace_id": str(workspace_id) if workspace_id else "",
        "public_key": keypair.public_key if keypair else None,
        "encrypted_private_key": keypair.encrypted_private_key if keypair else None,
        "private_key_iv": keypair.private_key_iv if keypair else None,
        "private_key_salt": keypair.private_key_salt if keypair else None,
    }


@router.post("/me/keypair")
def store_keypair(
    data: UserKeyPairCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Store or update key pair for legacy users migrating to new encryption."""
    existing = db.query(UserKeyPair).filter(UserKeyPair.user_id == current_user.id).first()
    if existing:
        existing.public_key = data.public_key
        existing.encrypted_private_key = data.encrypted_private_key
        existing.private_key_iv = data.private_key_iv
        existing.private_key_salt = data.private_key_salt
    else:
        keypair = UserKeyPair(
            user_id=current_user.id,
            public_key=data.public_key,
            encrypted_private_key=data.encrypted_private_key,
            private_key_iv=data.private_key_iv,
            private_key_salt=data.private_key_salt,
        )
        db.add(keypair)
    db.commit()
    return {"message": "Key pair stored"}


@router.get("/users/{email}/public-key", response_model=UserPublicKeyResponse)
def get_user_public_key(
    email: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a user's public key by email (for sharing)."""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    keypair = db.query(UserKeyPair).filter(UserKeyPair.user_id == user.id).first()
    if not keypair:
        raise HTTPException(status_code=404, detail="User has no encryption keys")
    return UserPublicKeyResponse(
        user_id=user.id,
        email=user.email,
        public_key=keypair.public_key,
    )


@router.get("/me", response_model=UserProfile)
def get_profile(current_user: User = Depends(get_current_user)):
    return UserProfile(
        email=current_user.email,
        display_name=current_user.display_name,
        created_at=str(current_user.created_at) if current_user.created_at else None,
    )


@router.put("/me", response_model=UserProfile)
def update_profile(
    data: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if data.display_name is not None:
        current_user.display_name = data.display_name
    db.commit()
    db.refresh(current_user)
    return UserProfile(
        email=current_user.email,
        display_name=current_user.display_name,
        created_at=str(current_user.created_at) if current_user.created_at else None,
    )
