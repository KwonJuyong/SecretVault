import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from database import engine, Base
from models import User, Workspace, WorkspaceMember, Page
from routers import auth, workspaces, pages, ws


def wait_for_db(max_retries=10, delay=2):
    """Wait for the database to be ready."""
    for i in range(max_retries):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print("Database is ready.")
            return
        except Exception as e:
            print(f"Waiting for database... ({i+1}/{max_retries})")
            time.sleep(delay)
    raise RuntimeError("Database not available after retries")


def run_migration():
    """Create tables if they don't exist."""
    wait_for_db()
    Base.metadata.create_all(bind=engine)
    print("Database ready.")


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
app.include_router(ws.router)


@app.get("/")
def root():
    return {"status": "SecretVault API v2.0"}


@app.get("/health")
def health():
    return {"status": "ok"}
