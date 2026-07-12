"""Page history.

Note there is deliberately no "restore" endpoint. Restoring is a new CRDT edit made in the
browser, which then persists down the normal content path — the server cannot merge
ciphertext it cannot read, and should not pretend to.
"""
import uuid

from conftest import add_member, auth_headers, make_user, make_workspace

from models.page import Page
from models.page_version import MAX_VERSIONS_PER_PAGE, PageVersion


def _page(db, ws, creator) -> Page:
    p = Page(
        id=uuid.uuid4(), workspace_id=ws.id, created_by=creator.id,
        title="ct", content="ct", icon="", position=1.0, encryption_version=4,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


class TestVersions:
    def test_saving_and_listing_a_version(self, client, db):
        alice = make_user(db, "alice@x.com")
        ws = make_workspace(db, alice)
        page = _page(db, ws, alice)
        h = auth_headers(client, "alice@x.com")

        res = client.post(
            f"/workspaces/{ws.id}/pages/{page.id}/versions",
            json={"encrypted_snapshot": "snapshot-ciphertext-1"},
            headers=h,
        )
        assert res.status_code == 200

        listed = client.get(f"/workspaces/{ws.id}/pages/{page.id}/versions", headers=h).json()
        assert len(listed) == 1
        assert listed[0]["created_by_email"] == "alice@x.com"
        # The list must not ship 50 full documents just to draw some timestamps.
        assert "encrypted_snapshot" not in listed[0]

    def test_fetching_one_version_returns_its_snapshot(self, client, db):
        alice = make_user(db, "alice@x.com")
        ws = make_workspace(db, alice)
        page = _page(db, ws, alice)
        h = auth_headers(client, "alice@x.com")

        client.post(
            f"/workspaces/{ws.id}/pages/{page.id}/versions",
            json={"encrypted_snapshot": "snapshot-ciphertext-1"}, headers=h,
        )
        vid = client.get(f"/workspaces/{ws.id}/pages/{page.id}/versions", headers=h).json()[0]["id"]

        res = client.get(f"/workspaces/{ws.id}/pages/{page.id}/versions/{vid}", headers=h)
        assert res.status_code == 200
        assert res.json()["encrypted_snapshot"] == "snapshot-ciphertext-1"

    def test_newest_version_comes_first(self, client, db):
        alice = make_user(db, "alice@x.com")
        ws = make_workspace(db, alice)
        page = _page(db, ws, alice)
        h = auth_headers(client, "alice@x.com")

        for i in range(3):
            client.post(
                f"/workspaces/{ws.id}/pages/{page.id}/versions",
                json={"encrypted_snapshot": f"snap-{i}"}, headers=h,
            )

        listed = client.get(f"/workspaces/{ws.id}/pages/{page.id}/versions", headers=h).json()
        ids = [v["id"] for v in listed]
        assert ids == sorted(ids, reverse=True)

    def test_history_is_capped_and_the_oldest_are_pruned(self, client, db):
        alice = make_user(db, "alice@x.com")
        ws = make_workspace(db, alice)
        page = _page(db, ws, alice)
        h = auth_headers(client, "alice@x.com")

        for i in range(MAX_VERSIONS_PER_PAGE + 5):
            client.post(
                f"/workspaces/{ws.id}/pages/{page.id}/versions",
                json={"encrypted_snapshot": f"snap-{i}"}, headers=h,
            )

        kept = db.query(PageVersion).filter(PageVersion.page_id == page.id).count()
        assert kept == MAX_VERSIONS_PER_PAGE

        # The survivors must be the newest ones, not an arbitrary subset.
        snapshots = {
            v.encrypted_snapshot
            for v in db.query(PageVersion).filter(PageVersion.page_id == page.id).all()
        }
        assert f"snap-{MAX_VERSIONS_PER_PAGE + 4}" in snapshots
        assert "snap-0" not in snapshots

    def test_a_workspace_member_can_read_another_members_history(self, client, db):
        """History follows page access: any member can open the page, so any member can
        see how it got that way."""
        alice = make_user(db, "alice@x.com")
        bob = make_user(db, "bob@x.com")
        ws = make_workspace(db, alice)
        add_member(db, ws, bob)
        page = _page(db, ws, alice)

        client.post(
            f"/workspaces/{ws.id}/pages/{page.id}/versions",
            json={"encrypted_snapshot": "alice-snap"},
            headers=auth_headers(client, "alice@x.com"),
        )

        res = client.get(
            f"/workspaces/{ws.id}/pages/{page.id}/versions",
            headers=auth_headers(client, "bob@x.com"),
        )
        assert res.status_code == 200
        assert len(res.json()) == 1

    def test_an_outsider_cannot_read_history(self, client, db):
        alice = make_user(db, "alice@x.com")
        make_user(db, "mallory@x.com")
        ws = make_workspace(db, alice)
        page = _page(db, ws, alice)

        h = auth_headers(client, "mallory@x.com")
        res = client.get(f"/workspaces/{ws.id}/pages/{page.id}/versions", headers=h)
        assert res.status_code == 403

    def test_an_outsider_cannot_write_history(self, client, db):
        alice = make_user(db, "alice@x.com")
        make_user(db, "mallory@x.com")
        ws = make_workspace(db, alice)
        page = _page(db, ws, alice)

        h = auth_headers(client, "mallory@x.com")
        res = client.post(
            f"/workspaces/{ws.id}/pages/{page.id}/versions",
            json={"encrypted_snapshot": "x"}, headers=h,
        )
        assert res.status_code == 403

    def test_versions_of_another_page_are_not_returned(self, client, db):
        alice = make_user(db, "alice@x.com")
        ws = make_workspace(db, alice)
        page_a = _page(db, ws, alice)
        page_b = _page(db, ws, alice)
        h = auth_headers(client, "alice@x.com")

        client.post(
            f"/workspaces/{ws.id}/pages/{page_a.id}/versions",
            json={"encrypted_snapshot": "a-snap"}, headers=h,
        )

        listed = client.get(f"/workspaces/{ws.id}/pages/{page_b.id}/versions", headers=h).json()
        assert listed == []

    def test_deleting_a_page_takes_its_history_with_it(self, client, db):
        alice = make_user(db, "alice@x.com")
        ws = make_workspace(db, alice)
        page = _page(db, ws, alice)
        h = auth_headers(client, "alice@x.com")

        client.post(
            f"/workspaces/{ws.id}/pages/{page.id}/versions",
            json={"encrypted_snapshot": "snap"}, headers=h,
        )
        client.delete(f"/workspaces/{ws.id}/pages/{page.id}?permanent=true", headers=h)

        left = db.query(PageVersion).filter(PageVersion.page_id == page.id).count()
        assert left == 0, "history outlived the page it belonged to"
