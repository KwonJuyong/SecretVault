import uuid
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from models.workspace import Workspace, WorkspaceMember
from schemas.auth import UserSignup, UserLogin, Token, UserProfile, UserProfileUpdate
from services.auth import hash_password, verify_password, needs_rehash, create_access_token, get_current_user

router = APIRouter(tags=["auth"])


@router.post("/signup")
def signup(data: UserSignup, db: Session = Depends(get_db)):
    if db.query(User).filter(User.user_id == data.user_id).first():
        raise HTTPException(status_code=400, detail="User ID already exists")

    user = User(
        user_id=data.user_id,
        password_hash=hash_password(data.password_hash),
        display_name=data.display_name or data.user_id,
    )
    db.add(user)
    db.flush()

    # Create default personal workspace
    workspace = Workspace(
        id=uuid.uuid4(),
        name=f"{data.user_id}'s Workspace",
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
    user = db.query(User).filter(User.user_id == data.user_id).first()
    if not user or not verify_password(data.password_hash, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Upgrade legacy hash to bcrypt
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(data.password_hash)
        db.commit()

    # Get user's default workspace
    member = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user.id).first()
    workspace_id = str(member.workspace_id) if member else ""

    token = create_access_token(data={"sub": user.user_id})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.user_id,
        "display_name": user.display_name,
        "workspace_id": workspace_id,
    }


@router.get("/me", response_model=UserProfile)
def get_profile(current_user: User = Depends(get_current_user)):
    return UserProfile(
        user_id=current_user.user_id,
        display_name=current_user.display_name,
        email=current_user.email,
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
    if data.email is not None:
        current_user.email = data.email
    db.commit()
    db.refresh(current_user)
    return UserProfile(
        user_id=current_user.user_id,
        display_name=current_user.display_name,
        email=current_user.email,
        created_at=str(current_user.created_at) if current_user.created_at else None,
    )
