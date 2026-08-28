import secrets
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from app.config import get_settings

settings = get_settings()

CSRF_COOKIE_NAME = "vks_csrf"
CSRF_HEADER_NAME = "x-csrf-token"
CSRF_ORIGINAL_ORIGIN_HEADER = "x-original-origin"

_UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})

# Pre-auth endpoints: no authenticated session exists yet, so cross-site
# forgery of these requests grants nothing without valid credentials.
_CSRF_EXEMPT_PATHS = frozenset({
    "/admin/api/auth/login",
    "/admin/api/auth/login-otp-send",
    "/admin/api/auth/login-otp-verify",
    "/admin/api/auth/login-totp",
    "/admin/api/auth/setup-required",
    "/admin/api/auth/setup-create",
    "/admin/api/auth/password/forgot-verify",
    "/admin/api/auth/password/forgot-reset",
    "/admin/api/auth/public-key",
    "/admin/api/auth/exchange",
    "/admin/api/auth/refresh",
})


def issue_csrf_cookie(response, token: str | None = None) -> str:
    token = token or secrets.token_urlsafe(32)
    response.set_cookie(
        CSRF_COOKIE_NAME, token,
        httponly=False,  # JS must read it to echo into X-CSRF-Token
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=12 * 3600,
        path="/",
    )
    return token


class CSRFMiddleware(BaseHTTPMiddleware):
    """Defense-in-depth for cookie-authenticated admin APIs.

    Two layers on every unsafe /admin/api/* request:
      1. Double-submit: X-CSRF-Token header must match the vks_csrf cookie.
      2. Origin validation: X-Original-Origin (set by the trusted Pages
         proxy) or a direct browser Origin header must be allowlisted.
    """

    async def dispatch(self, request, call_next):
        method = request.method.upper()
        path = request.url.path

        if method in _UNSAFE_METHODS and path.startswith("/admin/api/") \
                and path not in _CSRF_EXEMPT_PATHS:
            cookie_token = request.cookies.get(CSRF_COOKIE_NAME)
            header_token = request.headers.get(CSRF_HEADER_NAME)
            if not cookie_token or not header_token \
                    or not secrets.compare_digest(cookie_token, header_token):
                return JSONResponse(
                    {"detail": "csrf_validation_failed"},
                    status_code=403,
                )

            origin = (
                request.headers.get(CSRF_ORIGINAL_ORIGIN_HEADER)
                or request.headers.get("origin")
            )
            if origin and origin not in settings.cors_origin_list:
                return JSONResponse(
                    {"detail": "origin_not_allowed"},
                    status_code=403,
                )

        response = await call_next(request)

        if method in ("GET", "HEAD") and path.startswith("/admin/api/") \
                and not request.cookies.get(CSRF_COOKIE_NAME):
            issue_csrf_cookie(response)

        return response
