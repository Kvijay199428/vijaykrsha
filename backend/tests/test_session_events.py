import asyncio

from app.security import session_events as se
from app.security.sessions import get_session_by_id


class FakeWS:
    def __init__(self):
        self.sent = []
        self.closed = None

    async def send_json(self, payload):
        self.sent.append(payload)

    async def close(self, code=1000):
        self.closed = code


def test_client_payload_strips_internal_routing_fields():
    payload = se._client_payload({
        "v": 1,
        "type": "session_validated",
        "reason": "ok",
        "server_time": "t",
        "admin_id": "a",
        "session_id": "s",
    })
    assert payload["type"] == "session_validated"
    assert "admin_id" not in payload
    assert "session_id" not in payload


def test_client_payload_includes_expires_at_only_when_present():
    assert "expires_at" not in se._client_payload({"type": "session_validated"})
    payload = se._client_payload({"type": "session_expiring", "expires_at": "X"})
    assert payload["expires_at"] == "X"


def test_register_then_unregister_clears_indexes():
    ws = FakeWS()
    se.register_connection("sess-1", "admin-1", ws)
    assert ws in se._connections["sess-1"]
    assert "sess-1" in se._admin_index["admin-1"]

    se.unregister_connection("sess-1", "admin-1", ws)
    assert "sess-1" not in se._connections
    assert "admin-1" not in se._admin_index


def test_dispatch_routes_by_session_and_closes_on_terminal_event():
    async def run():
        ws = FakeWS()
        se.register_connection("sess-2", "admin-2", ws)
        try:
            await se._dispatch_local({
                "v": 1,
                "type": "session_revoked",
                "reason": "logout",
                "server_time": "t",
                "admin_id": "admin-2",
                "session_id": "sess-2",
            })
            assert len(ws.sent) == 1
            assert ws.sent[0]["type"] == "session_revoked"
            assert ws.closed == 4401
        finally:
            se.unregister_connection("sess-2", "admin-2", ws)

    asyncio.run(run())


def test_dispatch_routes_by_admin_id_when_session_unknown():
    async def run():
        ws = FakeWS()
        se.register_connection("sess-3", "admin-3", ws)
        try:
            # No session_id: fan out to every live session for the admin.
            await se._dispatch_local({"type": "account_disabled", "admin_id": "admin-3"})
            assert len(ws.sent) == 1
            assert ws.closed == 4401  # account_disabled is terminal
        finally:
            se.unregister_connection("sess-3", "admin-3", ws)

    asyncio.run(run())


def test_dispatch_ignores_unrelated_admins():
    async def run():
        ws = FakeWS()
        se.register_connection("sess-4", "admin-4", ws)
        try:
            await se._dispatch_local({"type": "session_revoked", "admin_id": "someone-else"})
            assert ws.sent == []
            assert ws.closed is None
        finally:
            se.unregister_connection("sess-4", "admin-4", ws)

    asyncio.run(run())


def test_get_session_by_id_invalid_uuid_returns_none():
    # Must short-circuit before touching the database session.
    assert asyncio.run(get_session_by_id(None, "not-a-uuid")) is None


def test_consume_empty_ticket_returns_none():
    assert asyncio.run(se.consume_session_ws_ticket("")) is None
