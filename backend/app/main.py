from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.config import get_settings
from app.api import (
    auth, public_contact, admin_messages, admin_settings,
    admin_users, admin_totp, admin_devices, admin_security,
)
from app.security.middleware import RequestValidationMiddleware
from app.security.csrf import CSRFMiddleware
from app.security.rate_limit import close_redis

settings = get_settings()

app = FastAPI(
    title="vijaykrsha.online API",
    version="0.2.0",
    docs_url="/admin/api/docs" if not settings.PRODUCTION else None,
    redoc_url=None,
    openapi_url="/admin/api/openapi.json" if not settings.PRODUCTION else None,
)


class DirectAccessGuard(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path.startswith("/admin/api/") or path.startswith("/vks/"):
            if request.headers.get("X-Forwarded-By") != "pages-proxy":
                return JSONResponse({"detail": "Not Found"}, status_code=404)
        response = await call_next(request)
        if path.startswith("/admin/api/"):
            # Admin API responses must never be cached by browsers or shared
            # proxies: a cached /me or dashboard payload could otherwise be
            # resurrected via Back/BFCache after logout.
            response.headers["Cache-Control"] = (
                "no-store, no-cache, must-revalidate, max-age=0"
            )
            response.headers["Pragma"] = "no-cache"
        return response


app.add_middleware(DirectAccessGuard)
app.add_middleware(RequestValidationMiddleware)
app.add_middleware(CSRFMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-RateLimit-RetryAfter"],
)

app.include_router(auth.router)
app.include_router(public_contact.router)
app.include_router(admin_messages.router)
app.include_router(admin_settings.router)
app.include_router(admin_users.router)
app.include_router(admin_totp.router)
app.include_router(admin_devices.router)
app.include_router(admin_security.router)


@app.get("/admin/api/health")
async def health():
    return {"status": "ok"}


@app.on_event("shutdown")
async def shutdown_event():
    await close_redis()
