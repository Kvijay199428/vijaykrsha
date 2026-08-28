from fastapi.routing import APIRoute

from app.api.admin_messages import router as messages_router
from app.api.admin_trash import router as trash_router


def _first_route(router, path: str, method: str):
    for r in router.routes:
        if isinstance(r, APIRoute) and r.path == path and method in r.methods:
            return r
    return None


def _assert_resolves_to(router, path: str, method: str, expected: str):
    route = _first_route(router, path, method)
    assert route is not None, f"no route registered for {method} {path}"
    assert (
        route.endpoint.__name__ == expected
    ), f"{method} {path} resolved to {route.endpoint.__name__!r}, expected {expected!r}"


def test_bulk_trash_not_shadowed_by_single_trash():
    _assert_resolves_to(messages_router, "/admin/api/messages/bulk/trash", "POST", "bulk_trash")


def test_bulk_pin_flag_not_shadowed_by_single_message_patch():
    _assert_resolves_to(messages_router, "/admin/api/messages/bulk", "PATCH", "bulk_pin_flag")


def test_bulk_restore_not_shadowed_by_single_restore():
    _assert_resolves_to(trash_router, "/admin/api/trash/bulk/restore", "POST", "bulk_restore")