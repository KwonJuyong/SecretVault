"""Test harness.

The app reads DATABASE_URL and SECRET_KEY at import time (config.py), so those must be
set before anything from the app is imported — hence the os.environ block above the
app imports. pytest loads conftest first, so this runs early enough.
"""
import os

os.environ["DATABASE_URL"] = "sqlite://"  # in-memory, shared via StaticPool
os.environ["SECRET_KEY"] = "test-secret-key-not-used-in-production"
os.environ["CORS_ORIGINS"] = "http://localhost:3000"

import uuid  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from database import Base, SessionLocal, engine, get_db  # noqa: E402
from main import app  # noqa: E402
from models.user import User  # noqa: E402
from models.workspace import Workspace, WorkspaceMember  # noqa: E402
from services.auth import hash_password  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db():
    """Every test gets an empty schema."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    """TestClient with the app's DB dependency pointed at the test session.

    The lifespan runs as normal; against in-memory SQLite its wait_for_db() and
    create_all() both succeed immediately.
    """
    def override_get_db():
        session = SessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# --- factories -------------------------------------------------------------

def make_user(db, email: str, password: str = "pw-hash") -> User:
    user = User(email=email, password_hash=hash_password(password), display_name=email)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def make_workspace(db, owner: User, name: str = "WS") -> Workspace:
    ws = Workspace(id=uuid.uuid4(), name=name, icon="", owner_id=owner.id)
    db.add(ws)
    db.flush()
    db.add(WorkspaceMember(workspace_id=ws.id, user_id=owner.id, role="owner"))
    db.commit()
    db.refresh(ws)
    return ws


def add_member(db, ws: Workspace, user: User, role: str = "member") -> None:
    db.add(WorkspaceMember(workspace_id=ws.id, user_id=user.id, role=role))
    db.commit()


def auth_headers(client, email: str, password: str = "pw-hash") -> dict:
    res = client.post("/login", json={"email": email, "password_hash": password})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}
