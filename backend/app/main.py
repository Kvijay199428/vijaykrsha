from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.config import get_settings
from app.api import (
    auth, public_contact, admin_messages, admin_settings, admin_trash,
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
app.include_router(admin_trash.router)
app.include_router(admin_users.router)
app.include_router(admin_totp.router)
app.include_router(admin_devices.router)
app.include_router(admin_security.router)


@app.get("/admin/api/health")
async def health():
    return {"status": "ok"}


# ── Trash cleanup worker ─────────────────────────────────────────
import asyncio
import structlog

logger = structlog.get_logger()


async def _trash_cleanup_loop():
    """Periodically delete expired trash items."""
    while True:
        await asyncio.sleep(900)  # 15 minutes
        try:
            from app.db import async_session
            from app.models import ContactMessage, MessageAttachment, MessageNote, ContactMessageTag
            from sqlalchemy import select
            from datetime import datetime, timezone

            async with async_session() as db:
                expired = (await db.execute(
                    select(ContactMessage).where(
                        ContactMessage.deleted_at.isnot(None),
                        ContactMessage.trash_expires_at <= datetime.now(timezone.utc),
                    ).limit(100)
                )).scalars().all()

                if not expired:
                    continue

                from app.services.storage_service import get_storage
                storage = get_storage()
                deleted = 0
                for msg in expired:
                    try:
                        attachments = (await db.execute(
                            select(MessageAttachment).where(MessageAttachment.message_id == msg.id)
                        )).scalars().all()
                        for att in attachments:
                            try:
                                await storage.delete_attachment(att.object_key)
                            except Exception:
                                logger.warning("cleanup_attachment_delete_failed", attachment_id=str(att.id))
                        for att in attachments:
                            await db.delete(att)
                        notes = (await db.execute(
                            select(MessageNote).where(MessageNote.message_id == msg.id)
                        )).scalars().all()
                        for note in notes:
                            await db.delete(note)
                        await db.delete(msg)
                        deleted += 1
                    except Exception:
                        logger.error("cleanup_message_failed", message_id=str(msg.id))

                if deleted:
                    await db.commit()
                    logger.info("trash_cleanup_completed", deleted=deleted)
        except Exception:
            logger.error("trash_cleanup_cycle_failed")


@app.on_event("startup")
async def start_trash_cleanup():
    asyncio.create_task(_trash_cleanup_loop())


@app.on_event("shutdown")
async def shutdown_event():
    await close_redis()
