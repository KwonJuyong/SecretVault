"""Invite links for people who do not have an account yet.

The server stores the workspace key wrapped under a secret it never sees (it lives in the
link's URL fragment), plus a hash of a separate auth token derived from that same secret.
These tests pin down that it cannot be tricked into handing access to anyone else.
"""
import hashlib
from datetime import UTC, datetime, timedelta

from conftest import add_member, auth_headers, make_user, make_workspace

from models.workspace import WorkspaceMember
from models.workspace_invite import WorkspaceInvite


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _create_invite(client, ws_id, headers, *, token="tok-abc", email=None, role="member"):
    return client.post(
        f"/workspaces/{ws_id}/invites",
        json={
            "auth_token_hash": _hash(token),
            "encrypted_workspace_key": "wskey-wrapped-under-link-secret",
            "role": role,
            "email": email,
            "expires_in_days": 7,
        },
        headers=headers,
    )


class TestCreateInvite:
    def test_owner_can_create_an_invite(self, client, db):
        alice = make_user(db, "alice@x.com")
        ws = make_workspace(db, alice)
        h = auth_headers(client, "alice@x.com")

        res = _create_invite(client, ws.id, h)
        assert res.status_code == 200, res.text
        assert res.json()["id"]

    def test_a_plain_member_cannot_create_an_invite(self, client, db):
        alice = make_user(db, "alice@x.com")
        bob = make_user(db, "bob@x.com")
        ws = make_workspace(db, alice)
        add_member(db, ws, bob, role="member")

        h = auth_headers(client, "bob@x.com")
        assert _create_invite(client, ws.id, h).status_code == 403

    def test_an_outsider_cannot_create_an_invite(self, client, db):
        alice = make_user(db, "alice@x.com")
        make_user(db, "mallory@x.com")
        ws = make_workspace(db, alice)

        h = auth_headers(client, "mallory@x.com")
        assert _create_invite(client, ws.id, h).status_code == 403

    def test_the_raw_auth_token_is_never_stored(self, client, db):
        alice = make_user(db, "alice@x.com")
        ws = make_workspace(db, alice)
        h = auth_headers(client, "alice@x.com")
        _create_invite(client, ws.id, h, token="super-secret-token")

        invite = db.query(WorkspaceInvite).first()
        assert invite.auth_token_hash != "super-secret-token"
        assert invite.auth_token_hash == _hash("super-secret-token")


class TestPreviewInvite:
    def test_holding_the_token_returns_the_wrapped_key(self, client, db):
        alice = make_user(db, "alice@x.com")
        ws = make_workspace(db, alice, "Team Vault")
        h = auth_headers(client, "alice@x.com")
        invite_id = _create_invite(client, ws.id, h, token="tok-1").json()["id"]

        # No login needed: the invitee has no account yet.
        res = client.get(f"/invites/{invite_id}?auth_token=tok-1")
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["workspace_name"] == "Team Vault"
        assert body["encrypted_workspace_key"] == "wskey-wrapped-under-link-secret"

    def test_a_wrong_token_reveals_nothing(self, client, db):
        alice = make_user(db, "alice@x.com")
        ws = make_workspace(db, alice)
        h = auth_headers(client, "alice@x.com")
        invite_id = _create_invite(client, ws.id, h, token="tok-1").json()["id"]

        res = client.get(f"/invites/{invite_id}?auth_token=wrong")
        assert res.status_code == 404
        assert "wskey-wrapped" not in res.text

    def test_knowing_the_invite_id_alone_is_not_enough(self, client, db):
        """The id travels in the link too, so it cannot be the only thing guarding access."""
        alice = make_user(db, "alice@x.com")
        ws = make_workspace(db, alice)
        h = auth_headers(client, "alice@x.com")
        invite_id = _create_invite(client, ws.id, h).json()["id"]

        res = client.get(f"/invites/{invite_id}")
        assert res.status_code in (400, 422)

    def test_an_expired_invite_is_refused(self, client, db):
        alice = make_user(db, "alice@x.com")
        ws = make_workspace(db, alice)
        h = auth_headers(client, "alice@x.com")
        invite_id = _create_invite(client, ws.id, h, token="tok-1").json()["id"]

        invite = db.query(WorkspaceInvite).first()
        invite.expires_at = datetime.now(UTC) - timedelta(days=1)
        db.commit()

        res = client.get(f"/invites/{invite_id}?auth_token=tok-1")
        assert res.status_code == 410


class TestAcceptInvite:
    def test_accepting_makes_you_a_member_with_a_key_grant(self, client, db):
        alice = make_user(db, "alice@x.com")
        ws = make_workspace(db, alice)
        h = auth_headers(client, "alice@x.com")
        invite_id = _create_invite(client, ws.id, h, token="tok-1").json()["id"]

        # Bob signs up (the link brought him here) and accepts.
        make_user(db, "bob@x.com")
        bh = auth_headers(client, "bob@x.com")
        res = client.post(
            f"/invites/{invite_id}/accept",
            json={"auth_token": "tok-1", "encrypted_workspace_key": "wskey-wrapped-for-bob-rsa"},
            headers=bh,
        )
        assert res.status_code == 200, res.text

        assert db.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == ws.id
        ).count() == 2  # Alice and Bob

        # Bob can now read the workspace key back as himself — the invite link is spent,
        # and his access rides on his own RSA-wrapped grant from here on.
        res = client.get(f"/workspaces/{ws.id}/key", headers=bh)
        assert res.status_code == 200
        assert res.json()["encrypted_workspace_key"] == "wskey-wrapped-for-bob-rsa"

    def test_a_wrong_token_cannot_accept(self, client, db):
        alice = make_user(db, "alice@x.com")
        ws = make_workspace(db, alice)
        h = auth_headers(client, "alice@x.com")
        invite_id = _create_invite(client, ws.id, h, token="tok-1").json()["id"]

        make_user(db, "mallory@x.com")
        mh = auth_headers(client, "mallory@x.com")
        res = client.post(
            f"/invites/{invite_id}/accept",
            json={"auth_token": "guessed", "encrypted_workspace_key": "x"},
            headers=mh,
        )
        assert res.status_code == 404
        assert db.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == ws.id
        ).count() == 1  # only Alice

    def test_an_invite_cannot_be_used_twice(self, client, db):
        alice = make_user(db, "alice@x.com")
        ws = make_workspace(db, alice)
        h = auth_headers(client, "alice@x.com")
        invite_id = _create_invite(client, ws.id, h, token="tok-1").json()["id"]

        make_user(db, "bob@x.com")
        make_user(db, "carol@x.com")

        first = client.post(
            f"/invites/{invite_id}/accept",
            json={"auth_token": "tok-1", "encrypted_workspace_key": "for-bob"},
            headers=auth_headers(client, "bob@x.com"),
        )
        assert first.status_code == 200

        second = client.post(
            f"/invites/{invite_id}/accept",
            json={"auth_token": "tok-1", "encrypted_workspace_key": "for-carol"},
            headers=auth_headers(client, "carol@x.com"),
        )
        assert second.status_code == 410, "a used invite link must not let a second person in"

    def test_an_email_pinned_invite_only_works_for_that_address(self, client, db):
        alice = make_user(db, "alice@x.com")
        ws = make_workspace(db, alice)
        h = auth_headers(client, "alice@x.com")
        invite_id = _create_invite(client, ws.id, h, token="tok-1", email="bob@x.com").json()["id"]

        make_user(db, "mallory@x.com")
        res = client.post(
            f"/invites/{invite_id}/accept",
            json={"auth_token": "tok-1", "encrypted_workspace_key": "x"},
            headers=auth_headers(client, "mallory@x.com"),
        )
        assert res.status_code == 403

    def test_an_expired_invite_cannot_be_accepted(self, client, db):
        alice = make_user(db, "alice@x.com")
        ws = make_workspace(db, alice)
        h = auth_headers(client, "alice@x.com")
        invite_id = _create_invite(client, ws.id, h, token="tok-1").json()["id"]

        invite = db.query(WorkspaceInvite).first()
        invite.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        db.commit()

        make_user(db, "bob@x.com")
        res = client.post(
            f"/invites/{invite_id}/accept",
            json={"auth_token": "tok-1", "encrypted_workspace_key": "x"},
            headers=auth_headers(client, "bob@x.com"),
        )
        assert res.status_code == 410


class TestRevokeInvite:
    def test_owner_can_revoke_an_unused_invite(self, client, db):
        alice = make_user(db, "alice@x.com")
        ws = make_workspace(db, alice)
        h = auth_headers(client, "alice@x.com")
        invite_id = _create_invite(client, ws.id, h, token="tok-1").json()["id"]

        assert client.delete(f"/workspaces/{ws.id}/invites/{invite_id}", headers=h).status_code == 200
        assert client.get(f"/invites/{invite_id}?auth_token=tok-1").status_code == 404

    def test_a_plain_member_cannot_revoke(self, client, db):
        alice = make_user(db, "alice@x.com")
        bob = make_user(db, "bob@x.com")
        ws = make_workspace(db, alice)
        add_member(db, ws, bob)
        h = auth_headers(client, "alice@x.com")
        invite_id = _create_invite(client, ws.id, h).json()["id"]

        bh = auth_headers(client, "bob@x.com")
        assert client.delete(f"/workspaces/{ws.id}/invites/{invite_id}", headers=bh).status_code == 403
