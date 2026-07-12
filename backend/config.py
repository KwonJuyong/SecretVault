import os

_PLACEHOLDER_SECRETS = {"change-me-in-production", "secret", "changeme", ""}

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@db:5432/cloudvault")

# No default. A fallback SECRET_KEY is worse than no boot: every JWT the app issues would
# be forgeable by anyone who has read the source, and nothing would look wrong at runtime.
SECRET_KEY = os.getenv("SECRET_KEY", "")
if SECRET_KEY.strip().lower() in _PLACEHOLDER_SECRETS:
    raise RuntimeError(
        "SECRET_KEY is unset or still a placeholder. Set it to a random value, e.g.\n"
        "  python -c \"import secrets; print(secrets.token_urlsafe(48))\"\n"
        "and put it in your .env before starting the app."
    )

ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

# The app sends allow_credentials=True, and "*" cannot be combined with credentials:
# browsers reject it outright, so a wildcard fallback is a broken config that only shows
# up at runtime. Require the origins to be named.
_cors_env = os.getenv("CORS_ORIGINS", "")
CORS_ORIGINS: list[str] = [o.strip() for o in _cors_env.split(",") if o.strip()]
if not CORS_ORIGINS:
    CORS_ORIGINS = ["http://localhost:3000"]
if "*" in CORS_ORIGINS:
    raise RuntimeError(
        "CORS_ORIGINS cannot be '*' while the API sends credentials. "
        "List the exact origins instead, e.g. CORS_ORIGINS=https://vault.example.com"
    )
