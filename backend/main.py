import time
from contextlib import asynccontextmanager
from pathlib import Path

from alembic.config import Config
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from alembic import command
from config import CORS_ORIGINS, DATABASE_URL
from database import engine
from routers import auth, favorites, invites, page_shares, pages, workspaces, ws


def wait_for_db(max_retries=10, delay=2):
    """Wait for the database to be ready."""
    for i in range(max_retries):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print("Database is ready.")
            return
        except Exception:
            print(f"Waiting for database... ({i+1}/{max_retries})")
            time.sleep(delay)
    raise RuntimeError("Database not available after retries")


def run_migration():
    """Bring the database up to the latest Alembic revision.

    Previously this was Base.metadata.create_all, which only ever creates missing tables:
    it cannot alter an existing one, so any schema change silently did nothing on a
    database that already had the old shape.

    SQLite is only used by the test suite, which builds the schema from metadata itself;
    running Alembic there would open a second connection and therefore a second, empty
    in-memory database.
    """
    if DATABASE_URL.startswith("sqlite"):
        return

    wait_for_db()

    alembic_cfg = Config(str(Path(__file__).parent / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(Path(__file__).parent / "alembic"))
    command.upgrade(alembic_cfg, "head")
    print("Database migrated to head.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_migration()
    yield


app = FastAPI(title="SecretVault API", version="2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(workspaces.router)
app.include_router(pages.router)
app.include_router(page_shares.router)
app.include_router(favorites.router)
app.include_router(invites.router)
app.include_router(ws.router)


@app.get("/")
def root():
    return {"status": "SecretVault API v2.0"}


@app.get("/health")
def health():
    return {"status": "ok"}
