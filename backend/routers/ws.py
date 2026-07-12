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
            # Broadcast to all other connections in the same workspace
            try:
                message = json.loads(data)
                message["email"] = email
                broadcast_data = json.dumps(message)
            except json.JSONDecodeError:
                continue

            disconnected = set()
            for conn in active_connections[workspace_id]:
                if conn != websocket:
                    try:
                        await conn.send_text(broadcast_data)
                    except Exception:
                        disconnected.add(conn)

            # Clean up disconnected
            for conn in disconnected:
                active_connections[workspace_id].discard(conn)

    except WebSocketDisconnect:
        active_connections[workspace_id].discard(websocket)
        if not active_connections[workspace_id]:
            del active_connections[workspace_id]
