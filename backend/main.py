import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from database import engine, Base, SessionLocal
from models import User, Workspace, WorkspaceMember, Page
from routers import auth, workspaces, pages


def run_migration():
    """Migrate data from old schema (notes table) to new schema (pages table)."""
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    # Create all new tables
    Base.metadata.create_all(bind=engine)

    if "notes" not in existing_tables:
        return

    db = SessionLocal()
    try:
        # Check if notes table has data
        result = db.execute(text("SELECT COUNT(*) FROM notes"))
        count = result.scalar()
        if count == 0:
            db.execute(text("DROP TABLE IF EXISTS notes"))
            db.commit()
            return

        # Migrate each user's notes
        users = db.query(User).all()
        for user in users:
            # Ensure user has a workspace
            membership = (
                db.query(WorkspaceMember)
                .filter(WorkspaceMember.user_id == user.id)
                .first()
            )
            if not membership:
                ws = Workspace(
                    id=uuid.uuid4(),
                    name=f"{user.user_id}'s Workspace",
                    icon="",
                    owner_id=user.id,
                )
                db.add(ws)
                db.flush()
                mem = WorkspaceMember(
                    workspace_id=ws.id,
                    user_id=user.id,
                    role="owner",
                )
                db.add(mem)
                db.flush()
                workspace_id = ws.id
            else:
                workspace_id = membership.workspace_id

            # Get notes for this user
            notes = db.execute(
                text("SELECT id, title, content FROM notes WHERE user_id = :uid ORDER BY id"),
                {"uid": user.user_id},
            ).fetchall()

            for i, note in enumerate(notes):
                page = Page(
                    id=uuid.uuid4(),
                    workspace_id=workspace_id,
                    parent_id=None,
                    created_by=user.id,
                    title=note[1] or "",
                    content=note[2] or "",
                    icon="",
                    position=float(i + 1),
                )
                db.add(page)

        db.commit()
        # Drop old table after successful migration
        db.execute(text("DROP TABLE IF EXISTS notes"))
        db.commit()
        print("Migration complete: notes -> pages")
    except Exception as e:
        db.rollback()
        print(f"Migration error: {e}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_migration()
    yield


app = FastAPI(title="SecretVault API", version="2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(workspaces.router)
app.include_router(pages.router)


@app.get("/")
def root():
    return {"status": "SecretVault API v2.0"}


@app.get("/health")
def health():
    return {"status": "ok"}
