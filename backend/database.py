from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import StaticPool

from config import DATABASE_URL


def _is_memory_sqlite(url: str) -> bool:
    """An in-memory SQLite DB lives inside its connection: open a second one and you get a
    second, empty database."""
    return url.startswith("sqlite") and (":memory:" in url or url in ("sqlite://", "sqlite:///:memory:"))


def _engine_kwargs(url: str) -> dict:
    """Pooling options Postgres wants but SQLite rejects."""
    if _is_memory_sqlite(url):
        # StaticPool pins every session to one connection, which is the only way the test
        # fixtures and the app can see the same in-memory database.
        return {
            "connect_args": {"check_same_thread": False},
            "poolclass": StaticPool,
        }
    if url.startswith("sqlite"):
        # File-backed SQLite (local dev without Docker). It must NOT use StaticPool: sharing
        # one connection across concurrent requests lets their transactions tread on each
        # other, and a commit in one session makes another's refresh fail outright.
        return {"connect_args": {"check_same_thread": False}}
    return {
        "pool_pre_ping": True,
        "pool_size": 10,
        "max_overflow": 20,
        "pool_recycle": 300,
    }


engine = create_engine(DATABASE_URL, **_engine_kwargs(DATABASE_URL))
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
