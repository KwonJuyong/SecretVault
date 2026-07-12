import json
import uuid
from collections import defaultdict

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt

from config import ALGORITHM, SECRET_KEY
from database import SessionLocal
from models.user import User
from models.workspace import WorkspaceMember

router = APIRouter()

# workspace_id -> set of connected WebSockets
active_connections: dict[str, set[WebSocket]] = defaultdict(set)

# Only these are relayed. The yjs_* payloads are ciphertext the server cannot read — it is
# a dumb relay for them, which is what keeps collaborative editing end-to-end encrypted.
RELAYABLE_TYPES = frozenset({
    "page_created",
    "page_updated",
    "page_deleted",
    "yjs_update",
    "yjs_sync_request",
    "yjs_sync_response",
})

MAX_MESSAGE_BYTES = 1_000_000


def verify_ws_token(token: str) -> str | None:
    """Verify JWT token and return email."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        return email
    except JWTError:
        return None


def verify_workspace_membership(email: str, workspace_id: str) -> bool:
    """Check if user is member of workspace."""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return False
        ws_uuid = uuid.UUID(workspace_id)
        membership = (
            db.query(WorkspaceMember)
            .filter(WorkspaceMember.workspace_id == ws_uuid, WorkspaceMember.user_id == user.id)
            .first()
        )
        return membership is not None
    finally:
        db.close()


@router.websocket("/ws/{workspace_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    workspace_id: str,
    token: str = Query(default=""),
):
    # Authenticate
    email = verify_ws_token(token)
    if not email:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    # Verify workspace membership
    if not verify_workspace_membership(email, workspace_id):
        await websocket.close(code=4003, reason="Access denied")
        return

    await websocket.accept()
    active_connections[workspace_id].add(websocket)

    try:
        while True:
            data = await websocket.receive_text()

            if len(data) > MAX_MESSAGE_BYTES:
                # A single peer must not be able to fan a huge payload out to the whole
                # workspace. Yjs updates are small; a snapshot of a large page is the
                # realistic upper bound, and it is well under this.
                continue

            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                continue

            if not isinstance(message, dict) or message.get("type") not in RELAYABLE_TYPES:
                continue

            # The sender's identity is stamped here rather than trusted from the payload,
            # so a client cannot broadcast under someone else's name.
            message["email"] = email
            broadcast_data = json.dumps(message)

            disconnected = set()
            for conn in active_connections[workspace_id]:
                if conn is websocket:
                    continue
                try:
                    await conn.send_text(broadcast_data)
                except Exception:
                    disconnected.add(conn)

            for conn in disconnected:
                active_connections[workspace_id].discard(conn)

    except WebSocketDisconnect:
        pass
    finally:
        active_connections[workspace_id].discard(websocket)
        if not active_connections[workspace_id]:
            active_connections.pop(workspace_id, None)
