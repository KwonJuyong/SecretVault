"""Permission and integrity tests for the pages API.

Several of these encode bugs that exist today; they are expected to fail until the
corresponding fix lands. Each one states the damage it is guarding against.
"""
import uuid

from conftest import add_member, auth_headers, make_user, make_workspace

from models.page import Page
from models.page_key_grant import PageKeyGrant


def _make_page(db, ws, creator, title="ct", parent_id=None) -> Page:
    page = Page(
        id=uuid.uuid4(), workspace_id=ws.id, parent_id=parent_id,
        created_by=creator.id, title=title, content="ct", icon="",
        position=1.0, encryption_version=2,
    )
    db.add(page)
    db.commit()
    db.refresh(page)
    return page


class TestMovePageIntegrity:
    def test_cannot_make_a_page_its_own_parent(self, client, db):
        alice = make_user(db, "alice@x.com")
        ws = make_workspace(db, alice)
        page = _make_page(db, ws, alice)
        h = auth_headers(client, "alice@x.com")

        res = client.post(
            f"/workspaces/{ws.id}/pages/{page.id}/move",
            json={"parent_id": str(page.id)}, headers=h,
        )
        assert res.status_code == 400, "a page must not be able to parent itself"

    def test_cannot_create_a_parent_cycle(self, client, db):
        """A <-> B cycle makes _delete_page_tree recurse until the stack blows."""
        alice = make_user(db, "alice@x.com")
        ws = make_workspace(db, alice)
        a = _make_page(db, ws, alice)
        b = _make_page(db, ws, alice, parent_id=a.id)  # b is a child of a
        h = auth_headers(client, "alice@x.com")

        # Now try to make A a child of B, closing the loop.
        res = client.post(
            f"/workspaces/{ws.id}/pages/{a.id}/move",
            json={"parent_id": str(b.id)}, headers=h,
        )
        assert res.status_code == 400, "must reject a move that puts a page under its own descendant"

    def test_cannot_reparent_into_another_workspace(self, client, db):
        alice = make_user(db, "alice@x.com")
        ws1 = make_workspace(db, alice, "one")
        ws2 = make_workspace(db, alice, "two")
        page = _make_page(db, ws1, alice)
        outsider_page = _make_page(db, ws2, alice)
        h = auth_headers(client, "alice@x.com")

        res = client.post(
            f"/workspaces/{ws1.id}/pages/{page.id}/move",
            json={"parent_id": str(outsider_page.id)}, headers=h,
        )
        assert res.status_code == 400, "parent must live in the same workspace"


class TestKeyGrantPermissions:
    def test_member_cannot_overwrite_another_users_key_grant(self, client, db):
        """batch_key_grants only checks workspace membership, so any member can clobber
        anyone's grant on any page — locking the real owner out of their own content."""
        alice = make_user(db, "alice@x.com")
        mallory = make_user(db, "mallory@x.com")
        ws = make_workspace(db, alice)
        add_member(db, ws, mallory, role="member")
        page = _make_page(db, ws, alice)

        db.add(PageKeyGrant(page_id=page.id, user_id=alice.id, encrypted_page_key="alice-real-key"))
        db.commit()

        h = auth_headers(client, "mallory@x.com")
        res = client.post(
            f"/workspaces/{ws.id}/pages/{page.id}/key-grants",
            json={"grants": [{"user_id": alice.id, "encrypted_page_key": "garbage"}]},
            headers=h,
        )
        assert res.status_code == 403, "a plain member must not rewrite grants on someone else's page"

        grant = db.query(PageKeyGrant).filter(
            PageKeyGrant.page_id == page.id, PageKeyGrant.user_id == alice.id
        ).first()
        assert grant.encrypted_page_key == "alice-real-key", "alice's key was destroyed"


class TestDeletePermissions:
    def test_plain_member_cannot_permanently_delete_someone_elses_page(self, client, db):
        alice = make_user(db, "alice@x.com")
        mallory = make_user(db, "mallory@x.com")
        ws = make_workspace(db, alice)
        add_member(db, ws, mallory, role="member")
        page = _make_page(db, ws, alice)

        h = auth_headers(client, "mallory@x.com")
        res = client.delete(f"/workspaces/{ws.id}/pages/{page.id}?permanent=true", headers=h)

        assert res.status_code == 403
        assert db.query(Page).filter(Page.id == page.id).first() is not None, "page was hard-deleted"


class TestInputValidation:
    def test_malformed_page_id_is_a_400_not_a_500(self, client, db):
        alice = make_user(db, "alice@x.com")
        ws = make_workspace(db, alice)
        h = auth_headers(client, "alice@x.com")

        res = client.get(f"/workspaces/{ws.id}/pages/not-a-uuid/shares", headers=h)
        assert res.status_code == 400
