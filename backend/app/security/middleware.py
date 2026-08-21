import re
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from app.config import get_settings

settings = get_settings()

_BODY_LIMITS: dict[str, int] = {
    "/admin/api/auth/login": 16 * 1024,
    "/admin/api/auth/login-otp-send": 16 * 1024,
    "/admin/api/auth/login-otp-verify": 16 * 1024,
    "/admin/api/auth/login-totp": 16 * 1024,
    "/admin/api/auth/setup-create": 16 * 1024,
    "/admin/api/auth/password/forgot-verify": 16 * 1024,
    "/admin/api/auth/password/forgot-reset": 16 * 1024,
    "/admin/api/contact": 32 * 1024,
}

_DEFAULT_BODY_LIMIT = settings.MAX_JSON_BODY_KB * 1024

_NULL_BYTE_RE = re.compile(r"[\x00]")


class RequestValidationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        method = request.method

        if _NULL_BYTE_RE.search(path):
            return JSONResponse({"detail": "Bad Request"}, status_code=400)

        if method in {"POST", "PUT", "PATCH"}:
            content_type = request.headers.get("content-type", "")
            if not content_type.startswith("application/json"):
                return JSONResponse(
                    {"detail": "Content-Type must be application/json"},
                    status_code=415,
                )

            content_length = request.headers.get("content-length")
            if content_length:
                try:
                    size = int(content_length)
                except ValueError:
                    return JSONResponse({"detail": "Bad Request"}, status_code=400)

                limit = _BODY_LIMITS.get(path, _DEFAULT_BODY_LIMIT)
                if size > limit:
                    return JSONResponse(
                        {"detail": f"Request body too large (max {limit // 1024}KB)"},
                        status_code=413,
                    )

        response: Response = await call_next(request)
        return response
