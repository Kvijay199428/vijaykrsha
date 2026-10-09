"""Cloudflare Turnstile server-side validation.

Verifies a Turnstile token against Cloudflare's Siteverify endpoint. This
must run on the backend — a client-side-only check is trivially forgeable.
Tokens are single-use and short-lived (5 minutes), so the frontend must
request a fresh token for every login attempt.

The site runs one widget per form (admin_login, contact_form), and each
widget has its own secret. Siteverify rejects a token verified with a secret
that does not match the widget that minted it, so every call must pass the
`action` it intends to assert — this is what makes a token minted for one
form unplayable against another.
"""

from __future__ import annotations

import httpx

from app.config import get_settings

settings = get_settings()

_SITEVERIFY_URL = (
    "https://challenges.cloudflare.com/turnstile/v0/siteverify"
)


async def verify_turnstile(
    token: str,
    remote_ip: str | None = None,
    *,
    action: str | None = None,
) -> dict:
    """Verify a Turnstile token. Returns the parsed Siteverify response,
    always with a "success" key. Fail-closed: any error => success False.

    `action` selects which widget's secret to verify against. Each widget has
    its own secret and siteverify rejects a token that was minted by a
    different widget, so callers must pass the action they intend to assert in
    `captcha_accepted` — the two sides must agree or every request fails.
    Defaults to the admin_login action when omitted.
    """
    if action is not None:
        secret = settings.turnstile_secret_for(action)
    else:
        secret = settings.turnstile_secret_for(settings.TURNSTILE_EXPECTED_ACTION)
    if not secret:
        # Misconfiguration must never silently allow logins.
        return {"success": False, "error-codes": ["missing-input-secret"]}
    if not token or len(token) > 2048:
        return {"success": False, "error-codes": ["missing-input-response"]}

    payload: dict = {
        "secret": secret,
        "response": token,
    }
    if remote_ip and remote_ip not in ("unknown", "testclient"):
        payload["remoteip"] = remote_ip

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(_SITEVERIFY_URL, data=payload)
        return resp.json()
    except Exception:
        return {"success": False, "error-codes": ["internal-error"]}


def captcha_accepted(
    result: dict,
    remote_ip: str | None = None,
    expected_action: str | None = None,
) -> bool:
    """Full acceptance check: success + action + (prod-only) hostname.

    `expected_action` defaults to the global TURNSTILE_EXPECTED_ACTION so the
    admin login call site is unchanged. Pass it explicitly for endpoints that
    use their own widget/action, so a token minted for one form cannot be
    replayed against another.
    """
    if not isinstance(result, dict) or not result.get("success"):
        return False
    if expected_action is None:
        expected_action = settings.TURNSTILE_EXPECTED_ACTION
    if result.get("action") and result.get("action") != expected_action:
        return False
    # Hostname is only pinned in production; in dev the ngrok domain and
    # localhost change frequently, so we don't hard-fail on it there.
    if settings.PRODUCTION:
        allowed = {
            h.strip() for h in settings.TURNSTILE_EXPECTED_HOSTNAMES.split(",") if h.strip()
        }
        hostname = result.get("hostname", "")
        if allowed and hostname not in allowed:
            return False
    return True
