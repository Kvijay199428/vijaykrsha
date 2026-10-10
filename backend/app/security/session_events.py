"""Real-time session event infrastructure.

Two responsibilities:

1. A single-use, short-lived WebSocket ticket store (Redis-backed) so the
   browser can authenticate a WSS handshake without putting a bearer or
   refresh token in the URL.
2. A cross-process event bus (Redis Pub/Sub) plus a per-worker in-process
   registry of live session WebSockets. Redis is only the *notification*
   mechanism — the database remains the source of truth for session validity.

Nothing in an event payload is a credential.
"""

import asyncio
import hashlib
import json
import secrets
from datetime import datetime, timezone
from typing import Any, Optional

import structlog

from app.security.rate_limit import get_redis

logger = structlog.get_logger()

SESSION_EVENTS_CHANNEL = "session:events"
SESSION_WS_TICKET_TTL_SECONDS = 45

# Event types the server may publish. Terminal events tear the socket down.
TERMINAL_EVENTS = frozenset({"session_revoked", "account_disabled", "session_expired"})

# ── In-process registry ─────────────────────────────────────────────
# session_id -> set of live WebSocket objects
_connections: dict[str, set] = {}
# admin_id -> set of session_ids
_admin_index: dict[str, set[str]] = {}


def register_connection(session_id: str, admin_id: str, ws: Any) -> None:
    sid = str(session_id)
    aid = str(admin_id)
    _connections.setdefault(sid, set()).add(ws)
    _admin_index.setdefault(aid, set()).add(sid)


def unregister_connection(session_id: str, admin_id: str, ws: Any) -> None:
    sid = str(session_id)
    aid = str(admin_id)
    sockets = _connections.get(sid)
    if sockets is not None:
        sockets.discard(ws)
        if not sockets:
            _connections.pop(sid, None)
    session_ids = _admin_index.get(aid)
    if session_ids is not None:
        if sid not in _connections:
            session_ids.discard(sid)
        if not session_ids:
            _admin_index.pop(aid, None)


def active_connection_count() -> int:
    return sum(len(s) for s in _connections.values())


# ── Single-use tickets ──────────────────────────────────────────────
def _ticket_key(ticket: str) -> str:
    digest = hashlib.sha256(ticket.encode()).hexdigest()
    return f"sessionws:ticket:{digest}"


async def issue_session_ws_ticket(
    admin_id: str,
    session_id: Optional[str],
    jti: Optional[str],
) -> str:
    """Create a cryptographically random ticket, storing only its hash."""
    r = await get_redis()
    ticket = secrets.token_urlsafe(32)
    key = _ticket_key(ticket)
    mapping = {
        "admin_id": str(admin_id),
        "session_id": str(session_id or ""),
        "jti": str(jti or ""),
    }
    await r.hset(key, mapping=mapping)
    await r.expire(key, SESSION_WS_TICKET_TTL_SECONDS)
    return ticket


_CONSUME_TICKET_LUA = """
local data = redis.call('HGETALL', KEYS[1])
if #data == 0 then
  return {}
end
redis.call('DEL', KEYS[1])
return data
"""


async def consume_session_ws_ticket(ticket: str) -> Optional[dict]:
    """Atomically fetch-and-delete a ticket. Replay returns None."""
    if not ticket:
        return None
    r = await get_redis()
    key = _ticket_key(ticket)
    try:
        raw = await r.eval(_CONSUME_TICKET_LUA, 1, key)
    except Exception:
        logger.warning("session_ws_ticket_consume_failed")
        return None
    if not raw:
        return None
    # eval returns a flat [field, value, field, value, ...] list.
    data = {raw[i]: raw[i + 1] for i in range(0, len(raw) - 1, 2)}
    return data or None


# ── Event bus ───────────────────────────────────────────────────────
async def publish_session_event(
    event_type: str,
    admin_id: Optional[str] = None,
    session_id: Optional[str] = None,
    reason: Optional[str] = None,
    expires_at: Optional[str] = None,
) -> None:
    """Publish a session event to every worker. Never raises."""
    event = {
        "v": 1,
        "type": event_type,
        "reason": reason,
        "server_time": datetime.now(timezone.utc).isoformat(),
        "admin_id": str(admin_id) if admin_id else None,
        "session_id": str(session_id) if session_id else None,
    }
    if expires_at:
        event["expires_at"] = expires_at
    try:
        r = await get_redis()
        await r.publish(SESSION_EVENTS_CHANNEL, json.dumps(event))
    except Exception:
        logger.warning("session_event_publish_failed", event_type=event_type)


def _client_payload(event: dict) -> dict:
    """Strip internal routing fields before sending to a browser."""
    return {
        "v": event.get("v", 1),
        "type": event.get("type"),
        "reason": event.get("reason"),
        "server_time": event.get("server_time"),
        **({"expires_at": event["expires_at"]} if event.get("expires_at") else {}),
    }


async def _dispatch_local(event: dict) -> None:
    event_type = event.get("type")
    terminal = event_type in TERMINAL_EVENTS
    payload = _client_payload(event)

    targets: list = []
    session_id = event.get("session_id")
    admin_id = event.get("admin_id")
    if session_id and str(session_id) in _connections:
        targets.extend(_connections.get(str(session_id), set()))
    elif admin_id:
        for sid in _admin_index.get(str(admin_id), set()):
            targets.extend(_connections.get(sid, set()))

    for ws in list(targets):
        try:
            await ws.send_json(payload)
            if terminal:
                await ws.close(code=4401)
        except Exception:
            pass


async def run_session_event_subscriber(stop_event: asyncio.Event) -> None:
    """Per-worker subscriber. Reconnects with backoff if Redis drops."""
    backoff = 1
    while not stop_event.is_set():
        try:
            r = await get_redis()
            pubsub = r.pubsub()
            await pubsub.subscribe(SESSION_EVENTS_CHANNEL)
            backoff = 1
            async for message in pubsub.listen():
                if stop_event.is_set():
                    break
                if message.get("type") != "message":
                    continue
                try:
                    event = json.loads(message["data"])
                except Exception:
                    continue
                await _dispatch_local(event)
            await pubsub.unsubscribe(SESSION_EVENTS_CHANNEL)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.warning("session_event_subscriber_error")
        if stop_event.is_set():
            break
        await asyncio.sleep(backoff)
        backoff = min(backoff * 2, 30)
