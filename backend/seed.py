"""
Seed script: Creates 2 test accounts with a shared team workspace.

Usage (inside Docker container):
  docker-compose exec backend python seed.py

Accounts created:
  - researcher1 / 1234 (Display: Kim Juyong)
  - researcher2 / 1234 (Display: Lee Minho)

Both are added to a shared "Research Lab" workspace.
"""

import uuid
import hashlib
from database import engine, Base, SessionLocal
from models.user import User
from models.workspace import Workspace, WorkspaceMember
from services.auth import hash_password


def derive_auth_hash(password: str) -> str:
    """Replicate frontend key derivation: SHA256(password + 'AUTH_SALT')"""
    return hashlib.sha256((password + "AUTH_SALT").encode()).hexdigest()


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        accounts = [
            {"user_id": "researcher1", "password": "1234", "display_name": "Kim Juyong"},
            {"user_id": "researcher2", "password": "1234", "display_name": "Lee Minho"},
        ]

        created_users = []

        for acct in accounts:
            # Skip if user already exists
            existing = db.query(User).filter(User.user_id == acct["user_id"]).first()
            if existing:
                print(f"  User '{acct['user_id']}' already exists, skipping.")
                created_users.append(existing)
                continue

            # Create user (replicating frontend + backend password flow)
            auth_hash = derive_auth_hash(acct["password"])
            user = User(
                user_id=acct["user_id"],
                password_hash=hash_password(auth_hash),
                display_name=acct["display_name"],
            )
            db.add(user)
            db.flush()

            # Create personal workspace
            personal_ws = Workspace(
                id=uuid.uuid4(),
                name=f"{acct['user_id']}'s Workspace",
                icon="\U0001F4BC",
                owner_id=user.id,
            )
            db.add(personal_ws)
            db.flush()

            personal_member = WorkspaceMember(
                workspace_id=personal_ws.id,
                user_id=user.id,
                role="owner",
            )
            db.add(personal_member)
            db.flush()

            created_users.append(user)
            print(f"  Created user: {acct['user_id']} ({acct['display_name']})")

        # Create shared team workspace (if not exists)
        team_ws_name = "Research Lab"
        existing_ws = db.query(Workspace).filter(Workspace.name == team_ws_name).first()

        if existing_ws:
            print(f"  Team workspace '{team_ws_name}' already exists, skipping.")
        else:
            team_ws = Workspace(
                id=uuid.uuid4(),
                name=team_ws_name,
                description="Shared workspace for the research team",
                icon="\U0001F52C",
                owner_id=created_users[0].id,
            )
            db.add(team_ws)
            db.flush()

            # Add both users to team workspace
            for i, user in enumerate(created_users):
                role = "owner" if i == 0 else "member"
                member = WorkspaceMember(
                    workspace_id=team_ws.id,
                    user_id=user.id,
                    role=role,
                )
                db.add(member)

            print(f"  Created team workspace: {team_ws_name}")
            print(f"  Added {len(created_users)} members to team workspace")

        db.commit()
        print("\nSeed completed successfully!")
        print("\nTest accounts:")
        for acct in accounts:
            print(f"  Username: {acct['user_id']}  Password: {acct['password']}  Name: {acct['display_name']}")

    except Exception as e:
        db.rollback()
        print(f"Seed error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("Seeding database...")
    seed()
