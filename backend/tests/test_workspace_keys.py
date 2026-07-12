"""The workspace-key flow (design B).

The bug this replaces: invite_member only inserted a WorkspaceMember row, so an invited
member held no key for anything. They saw every page in the workspace as an unreadable
"Untitled" blank and could not save. These tests pin down the flow that fixes it.

The server only ever moves opaque wrapped blobs around — it must never be able to tell
what a key decrypts to. The strings below stand in for those blobs.
"""
from conftest import add_member, auth_headers, make_user, make_workspace

from models.workspace import WorkspaceKeyGrant


class TestSignupWorkspaceKey:
    def test_signup_stores_a_key_grant_for_the_workspace_it_creates(self, client, db):
        """Signup auto-creates the user's first workspace. Without a key grant they would
        own a workspace they cannot encrypt anything into."""
        res = client.post("/signup", json={
            "email": "new@x.com",
            "password_hash": "client-hash",
            "public_key": "pub",
            "encrypted_private_key": "epk",
            "private_key_iv": "iv",
            "private_key_salt": "salt",
            "encrypted_workspace_key": "wrapped-for-new-user",
        })
        assert res.status_code == 200, res.text

        h = auth_headers(client, "new@x.com", password="client-hash")
        ws_id = client.post("/login", json={
            "email": "new@x.com", "password_hash": "client-hash"
        }).json()["workspace_id"]

        res = client.get(f"/workspaces/{ws_id}/key", headers=h)
        assert res.status_code == 200
        assert res.json()["encrypted_workspace_key"] == "wrapped-for-new-user"


class TestWorkspaceKeyGrant:
    def test_creating_a_workspace_stores_the_owner_key_grant(self, client, db):
        make_user(db, "alice@x.com")
        h = auth_headers(client, "alice@x.com")

        res = client.post(
            "/workspaces",
            json={"name": "Team", "encrypted_workspace_key": "wrapped-for-alice"},
            headers=h,
        )
        assert res.status_code == 200, res.text
        ws_id = res.json()["id"]

        res = client.get(f"/workspaces/{ws_id}/key", headers=h)
        assert res.status_code == 200
        assert res.json()["encrypted_workspace_key"] == "wrapped-for-alice"

    def test_inviting_a_member_with_a_wrapped_key_gives_them_access(self, client, db):
        alice = make_user(db, "alice@x.com")
        make_user(db, "bob@x.com")
        ws = make_workspace(db, alice)
        db.add(WorkspaceKeyGrant(
            workspace_id=ws.id, user_id=alice.id, encrypted_workspace_key="wrapped-for-alice"
        ))
        db.commit()

        ah = auth_headers(client, "alice@x.com")
        res = client.post(
            f"/workspaces/{ws.id}/members",
            json={"email": "bob@x.com", "role": "member",
                  "encrypted_workspace_key": "wrapped-for-bob"},
            headers=ah,
        )
        assert res.status_code == 200, res.text

        # Bob can now fetch his own grant, and it is *his* blob, not Alice's.
        bh = auth_headers(client, "bob@x.com")
        res = client.get(f"/workspaces/{ws.id}/key", headers=bh)
        assert res.status_code == 200
        assert res.json()["encrypted_workspace_key"] == "wrapped-for-bob"

    def test_invite_without_a_wrapped_key_is_rejected(self, client, db):
        """Letting this through is what produced members who could not read anything."""
        alice = make_user(db, "alice@x.com")
        make_user(db, "bob@x.com")
        ws = make_workspace(db, alice)
        h = auth_headers(client, "alice@x.com")

        res = client.post(
            f"/workspaces/{ws.id}/members",
            json={"email": "bob@x.com", "role": "member"},
            headers=h,
        )
        assert res.status_code == 400
        assert "key" in res.json()["detail"].lower()

    def test_a_non_member_cannot_fetch_the_workspace_key(self, client, db):
        alice = make_user(db, "alice@x.com")
        make_user(db, "mallory@x.com")
        ws = make_workspace(db, alice)
        db.add(WorkspaceKeyGrant(
            workspace_id=ws.id, user_id=alice.id, encrypted_workspace_key="wrapped-for-alice"
        ))
        db.commit()

        h = auth_headers(client, "mallory@x.com")
        res = client.get(f"/workspaces/{ws.id}/key", headers=h)
        assert res.status_code == 403

    def test_a_member_with_no_grant_gets_404_not_someone_elses_key(self, client, db):
        alice = make_user(db, "alice@x.com")
        bob = make_user(db, "bob@x.com")
        ws = make_workspace(db, alice)
        add_member(db, ws, bob)  # member row, but deliberately no key grant
        db.add(WorkspaceKeyGrant(
            workspace_id=ws.id, user_id=alice.id, encrypted_workspace_key="wrapped-for-alice"
        ))
        db.commit()

        h = auth_headers(client, "bob@x.com")
        res = client.get(f"/workspaces/{ws.id}/key", headers=h)
        assert res.status_code == 404
        assert "wrapped-for-alice" not in res.text

    def test_removing_a_member_revokes_their_key_grant(self, client, db):
        alice = make_user(db, "alice@x.com")
        bob = make_user(db, "bob@x.com")
        ws = make_workspace(db, alice)
        add_member(db, ws, bob)
        db.add(WorkspaceKeyGrant(
            workspace_id=ws.id, user_id=bob.id, encrypted_workspace_key="wrapped-for-bob"
        ))
        db.commit()

        h = auth_headers(client, "alice@x.com")
        res = client.post(
            f"/workspaces/{ws.id}/members/remove", json={"email": "bob@x.com"}, headers=h
        )
        assert res.status_code == 200

        left = db.query(WorkspaceKeyGrant).filter(
            WorkspaceKeyGrant.workspace_id == ws.id, WorkspaceKeyGrant.user_id == bob.id
        ).first()
        assert left is None, "removed member kept their workspace key grant"


class TestPageKeyUnderWorkspaceKey:
    def test_a_page_created_by_one_member_is_readable_by_another(self, client, db):
        """The end-to-end shape of the fix: the page key rides on the page row, wrapped
        under the workspace key, so every member's list request carries it back."""
        alice = make_user(db, "alice@x.com")
        bob = make_user(db, "bob@x.com")
        ws = make_workspace(db, alice)
        add_member(db, ws, bob)
        for user, blob in ((alice, "wrapped-for-alice"), (bob, "wrapped-for-bob")):
            db.add(WorkspaceKeyGrant(
                workspace_id=ws.id, user_id=user.id, encrypted_workspace_key=blob
            ))
        db.commit()

        ah = auth_headers(client, "alice@x.com")
        res = client.post(
            f"/workspaces/{ws.id}/pages",
            json={"title": "ct-title", "content": "ct-body", "encryption_version": 3,
                  "encrypted_page_key": "pagekey-wrapped-under-workspace-key"},
            headers=ah,
        )
        assert res.status_code == 200, res.text
        page_id = res.json()["id"]

        bh = auth_headers(client, "bob@x.com")
        res = client.get(f"/workspaces/{ws.id}/pages/{page_id}", headers=bh)
        assert res.status_code == 200
        body = res.json()
        assert body["encrypted_page_key"] == "pagekey-wrapped-under-workspace-key", (
            "Bob did not receive the page key — this is the original bug"
        )
        assert body["title"] == "ct-title"

        # And it shows up in the tree listing too, which is what renders the sidebar.
        res = client.get(f"/workspaces/{ws.id}/pages", headers=bh)
        assert res.status_code == 200
        item = next(p for p in res.json() if p["id"] == page_id)
        assert item["encrypted_page_key"] == "pagekey-wrapped-under-workspace-key"
