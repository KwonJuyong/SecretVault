"""Security invariants that must not regress."""
import importlib
import subprocess
import sys
import textwrap

import pytest
from conftest import make_user

from services.auth import hash_password, verify_password


class TestSecretKey:
    def _boot(self, env_line: str) -> subprocess.CompletedProcess:
        """Import config in a fresh interpreter with a given SECRET_KEY."""
        code = textwrap.dedent(f"""
            import os
            {env_line}
            os.environ["DATABASE_URL"] = "sqlite://"
            import config
            print("IMPORTED", config.SECRET_KEY)
        """)
        return subprocess.run(
            [sys.executable, "-c", code], capture_output=True, text=True, cwd="."
        )

    def test_refuses_to_boot_without_a_secret_key(self):
        res = self._boot('os.environ.pop("SECRET_KEY", None)')
        assert res.returncode != 0, "app booted with no SECRET_KEY — JWTs would be forgeable"
        assert "SECRET_KEY" in res.stderr

    def test_refuses_to_boot_with_the_placeholder_secret_key(self):
        res = self._boot('os.environ["SECRET_KEY"] = "change-me-in-production"')
        assert res.returncode != 0, "app booted with the placeholder key"
        assert "SECRET_KEY" in res.stderr

    def test_boots_with_a_real_secret_key(self):
        res = self._boot('os.environ["SECRET_KEY"] = "a-genuinely-configured-secret"')
        assert res.returncode == 0, res.stderr
        assert "IMPORTED" in res.stdout


class TestPasswordStorage:
    def test_passwords_are_bcrypt_hashed_not_stored_raw(self, db):
        user = make_user(db, "alice@x.com", password="client-side-hash")
        assert user.password_hash != "client-side-hash"
        assert user.password_hash.startswith("$2")

    def test_verify_accepts_the_right_password(self):
        assert verify_password("secret", hash_password("secret"))

    def test_verify_rejects_the_wrong_password(self):
        assert not verify_password("wrong", hash_password("secret"))

    def test_a_raw_unhashed_value_in_the_db_is_never_accepted(self):
        """The old code fell back to comparing the submitted value against the stored
        one verbatim, which makes a plaintext row a valid credential."""
        assert not verify_password("plaintext-password", "plaintext-password")

    def test_login_rejects_a_user_whose_stored_hash_is_not_bcrypt(self, client, db):
        from models.user import User
        db.add(User(email="legacy@x.com", password_hash="deadbeef", display_name="legacy"))
        db.commit()

        res = client.post("/login", json={"email": "legacy@x.com", "password_hash": "deadbeef"})
        assert res.status_code == 401, "a non-bcrypt stored hash was accepted as a password"


class TestCors:
    def test_wildcard_origin_is_never_paired_with_credentials(self):
        import config
        importlib.reload(config)
        if "*" in config.CORS_ORIGINS:
            pytest.fail(
                "CORS_ORIGINS falls back to '*' while the app sends allow_credentials=True; "
                "browsers reject that combination and it is unsafe if they did not"
            )


class TestAuthRequired:
    def test_pages_require_a_token(self, client):
        res = client.get("/workspaces/00000000-0000-0000-0000-000000000000/pages")
        assert res.status_code == 401

    def test_a_forged_token_is_rejected(self, client, db):
        make_user(db, "alice@x.com")
        res = client.get(
            "/workspaces/00000000-0000-0000-0000-000000000000/pages",
            headers={"Authorization": "Bearer not-a-real-jwt"},
        )
        assert res.status_code == 401
