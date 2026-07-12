"""Favorites, reordering and the tree operations behind page management."""
import uuid

from conftest import add_member, auth_headers, make_user, make_workspace

from models.page import Page


def _page(db, ws, creator, parent_id=None, position=1.0) -> Page:
    p = Page(
        id=uuid.uuid4(), workspace_id=ws.id, parent_id=parent_id, created_by=creator.id,
        title="ct", content="", icon="", position=position, encryption_version=4,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


class TestFavorites:
    def test_star_then_list(self, client, db):
        alice = make_user(db, "alice@x.com")
        ws = make_workspace(db, alice)
        page = _page(db, ws, alice)
        h = auth_headers(client, "alice@x.com")

        assert client.post(f"/workspaces/{ws.id}/pages/{page.id}/favorite", headers=h).status_code == 200

        res = client.get("/favorites", headers=h)
        assert res.status_code == 200
        assert [f["id"] for f in res.json()] == [str(page.id)]

    def test_starring_twice_is_idempotent(self, client, db):
        alice = make_user(db, "alice@x.com")
        ws = make_workspace(db, alice)
        page = _page(db, ws, alice)
        h = auth_headers(client, "alice@x.com")

        client.post(f"/workspaces/{ws.id}/pages/{page.id}/favorite", headers=h)
        assert client.post(f"/workspaces/{ws.id}/pages/{page.id}/favorite", headers=h).status_code == 200
        assert len(client.get("/favorites", headers=h).json()) == 1

    def test_unstar(self, client, db):
        alice = make_user(db, "alice@x.com")
        ws = make_workspace(db, alice)
        page = _page(db, ws, alice)
        h = auth_headers(client, "alice@x.com")

        client.post(f"/workspaces/{ws.id}/pages/{page.id}/favorite", headers=h)
        assert client.delete(f"/workspaces/{ws.id}/pages/{page.id}/favorite", headers=h).status_code == 200
        assert client.get("/favorites", headers=h).json() == []

    def test_favorites_are_private_to_the_user(self, client, db):
        alice = make_user(db, "alice@x.com")
        bob = make_user(db, "bob@x.com")
        ws = make_workspace(db, alice)
        add_member(db, ws, bob)
        page = _page(db, ws, alice)

        ah = auth_headers(client, "alice@x.com")
        client.post(f"/workspaces/{ws.id}/pages/{page.id}/favorite", headers=ah)

        bh = auth_headers(client, "bob@x.com")
        assert client.get("/favorites", headers=bh).json() == [], "Alice's star leaked to Bob"

    def test_cannot_favorite_a_page_in_a_workspace_you_are_not_in(self, client, db):
        alice = make_user(db, "alice@x.com")
        make_user(db, "mallory@x.com")
        ws = make_workspace(db, alice)
        page = _page(db, ws, alice)

        h = auth_headers(client, "mallory@x.com")
        assert client.post(f"/workspaces/{ws.id}/pages/{page.id}/favorite", headers=h).status_code == 403

    def test_deleting_a_page_drops_it_from_favorites(self, client, db):
        alice = make_user(db, "alice@x.com")
        ws = make_workspace(db, alice)
        page = _page(db, ws, alice)
        h = auth_headers(client, "alice@x.com")

        client.post(f"/workspaces/{ws.id}/pages/{page.id}/favorite", headers=h)
        client.delete(f"/workspaces/{ws.id}/pages/{page.id}?permanent=true", headers=h)

        # A starred page that no longer exists must not come back as a dangling entry.
        assert client.get("/favorites", headers=h).json() == []

    def test_a_trashed_page_is_not_listed_as_a_favorite(self, client, db):
        alice = make_user(db, "alice@x.com")
        ws = make_workspace(db, alice)
        page = _page(db, ws, alice)
        h = auth_headers(client, "alice@x.com")

        client.post(f"/workspaces/{ws.id}/pages/{page.id}/favorite", headers=h)
        client.delete(f"/workspaces/{ws.id}/pages/{page.id}", headers=h)  # soft delete

        assert client.get("/favorites", headers=h).json() == []


class TestReorder:
    def test_move_sets_parent_and_position(self, client, db):
        alice = make_user(db, "alice@x.com")
        ws = make_workspace(db, alice)
        target = _page(db, ws, alice, position=1.0)
        moving = _page(db, ws, alice, position=2.0)
        h = auth_headers(client, "alice@x.com")

        res = client.post(
            f"/workspaces/{ws.id}/pages/{moving.id}/move",
            json={"parent_id": str(target.id), "position": 1.5}, headers=h,
        )
        assert res.status_code == 200

        db.refresh(moving)
        assert moving.parent_id == target.id
        assert moving.position == 1.5

    def test_move_to_root_clears_the_parent(self, client, db):
        alice = make_user(db, "alice@x.com")
        ws = make_workspace(db, alice)
        parent = _page(db, ws, alice)
        child = _page(db, ws, alice, parent_id=parent.id)
        h = auth_headers(client, "alice@x.com")

        res = client.post(
            f"/workspaces/{ws.id}/pages/{child.id}/move",
            json={"parent_id": None, "position": 5.0}, headers=h,
        )
        assert res.status_code == 200
        db.refresh(child)
        assert child.parent_id is None

    def test_fractional_positions_survive_a_round_trip(self, client, db):
        """The sidebar drops a page between two siblings by averaging their positions;
        truncating that to an int would collapse the ordering."""
        alice = make_user(db, "alice@x.com")
        ws = make_workspace(db, alice)
        a = _page(db, ws, alice, position=1.0)
        _page(db, ws, alice, position=2.0)
        h = auth_headers(client, "alice@x.com")

        client.post(
            f"/workspaces/{ws.id}/pages/{a.id}/move",
            json={"position": 1.5}, headers=h,
        )
        listed = client.get(f"/workspaces/{ws.id}/pages", headers=h).json()
        moved = next(p for p in listed if p["id"] == str(a.id))
        assert moved["position"] == 1.5

    def test_pages_come_back_ordered_by_position(self, client, db):
        alice = make_user(db, "alice@x.com")
        ws = make_workspace(db, alice)
        third = _page(db, ws, alice, position=3.0)
        first = _page(db, ws, alice, position=1.0)
        second = _page(db, ws, alice, position=2.0)
        h = auth_headers(client, "alice@x.com")

        listed = client.get(f"/workspaces/{ws.id}/pages", headers=h).json()
        assert [p["id"] for p in listed] == [str(first.id), str(second.id), str(third.id)]
