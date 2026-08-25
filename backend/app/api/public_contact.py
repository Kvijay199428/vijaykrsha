import structlog
import secrets
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_db
from app.models import (
    ContactMessage, WebsiteUser, MessageChannel, MessageStatus,
    MessagePriority, MessageAttachment,
)
from app.security.rate_limit import contact_limiter
from app.services.storage_service import StorageError, get_storage

logger = structlog.get_logger()
router = APIRouter(prefix="/vks/api/contact", tags=["public"])

MAX_FILES = 5

# Frontend sends "standard"/"urgent"; enum stores low/normal/high/urgent.
_PRIORITY_MAP = {
    "low": "low",
    "standard": "normal",
    "normal": "normal",
    "high": "high",
    "urgent": "urgent",
}


def _generate_reference() -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d")
    rand = secrets.token_hex(4).upper()
    return f"VKS-{ts}-{rand}"


@router.post("")
async def submit_contact(
    request: Request,
    name: str = Form(...),
    email: EmailStr = Form(...),
    phone: Optional[str] = Form(None),
    subject: Optional[str] = Form(None),
    project_type: Optional[str] = Form(None),
    priority: Optional[str] = Form(None),
    message: str = Form(...),
    honeypot: Optional[str] = Form(None),
    documents: List[UploadFile] = File(default=[]),
    db: AsyncSession = Depends(get_db),
):
    if honeypot:
        return {"status": "accepted"}

    settings = get_settings()
    ip = request.client.host if request.client else "unknown"
    allowed, wait = await contact_limiter.check_and_record(f"contact:{ip}")
    if not allowed:
        raise HTTPException(429, "rate_limited")

    # ── validate attachments before touching the database ──────────
    allowed_ext = settings.allowed_attachment_extensions
    skipped: list[dict] = []
    pending: list[tuple[str, str, bytes]] = []  # (filename, content_type, data)

    for idx, doc in enumerate(documents or []):
        filename = doc.filename or "file"
        if idx >= MAX_FILES:
            skipped.append({"filename": filename, "reason": "too_many_files"})
            continue
        data = await doc.read()
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if not ext or ext not in allowed_ext:
            skipped.append({"filename": filename, "reason": "unsupported_type"})
            continue
        if len(data) > settings.MAX_ATTACHMENT_BYTES:
            skipped.append({"filename": filename, "reason": "too_large"})
            continue
        if len(data) == 0:
            skipped.append({"filename": filename, "reason": "empty_file"})
            continue
        pending.append((filename, doc.content_type or "application/octet-stream", data))

    # ── upsert website user ─────────────────────────────────────────
    user = None
    stmt = select(WebsiteUser).where(WebsiteUser.email == email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if user:
        user.last_seen_at = datetime.now(timezone.utc)
        user.message_count += 1
        if name:
            user.name = name
        if phone:
            user.phone = phone
    else:
        user = WebsiteUser(
            name=name,
            email=email,
            phone=phone,
        )
        db.add(user)
    await db.flush()

    effective_subject = subject or (f"{project_type} inquiry" if project_type else None) or "Contact Form"
    msg_priority = MessagePriority(_PRIORITY_MAP.get((priority or "").lower(), "normal"))

    msg = ContactMessage(
        public_reference=_generate_reference(),
        website_user_id=user.id if user else None,
        channel=MessageChannel.contact_form,
        status=MessageStatus.new,
        priority=msg_priority,
        subject=effective_subject[:240],
        body=message,
        sender_name=name,
        sender_email=email,
        sender_phone=phone,
        source_page=request.headers.get("referer", ""),
        ip_address=ip,
        user_agent=request.headers.get("user-agent", ""),
    )
    db.add(msg)
    await db.flush()

    # ── store attachments in MinIO and index them ──────────────────
    if pending:
        storage = get_storage()
        try:
            await storage.ensure_bucket()
        except StorageError as exc:
            logger.error("storage_bucket_unavailable", error=str(exc))
            raise HTTPException(503, "storage_unavailable")

        for filename, content_type, data in pending:
            try:
                object_key, size_bytes, sha256_hex = await storage.upload_attachment(
                    msg.id, filename, content_type, data
                )
            except StorageError as exc:
                logger.error("attachment_upload_failed",
                             error=str(exc), filename=filename)
                skipped.append({"filename": filename, "reason": "upload_failed"})
                continue
            db.add(MessageAttachment(
                message_id=msg.id,
                object_key=object_key,
                original_filename=filename[:255],
                content_type=content_type[:160] or "application/octet-stream",
                size_bytes=size_bytes,
                sha256_hex=sha256_hex,
            ))

    await db.commit()

    logger.info("contact_submitted",
                reference=msg.public_reference,
                email=str(email),
                attachments=len(pending) - sum(1 for s in skipped if s["reason"] == "upload_failed"))

    return {
        "status": "accepted",
        "reference": msg.public_reference,
        "skipped": skipped,
    }
