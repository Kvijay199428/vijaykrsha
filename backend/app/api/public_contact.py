import structlog
import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.models import (
    ContactMessage, WebsiteUser, MessageChannel, MessageStatus,
    MessagePriority,
)
from app.security.rate_limit import otp_limiter

logger = structlog.get_logger()
router = APIRouter(prefix="/vks/api/contact", tags=["public"])


class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    phone: str | None = None
    organization: str | None = None
    subject: str | None = None
    message: str
    country_code: str | None = None
    honeypot: str | None = None


def _generate_reference() -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d")
    rand = secrets.token_hex(4).upper()
    return f"VKS-{ts}-{rand}"


@router.post("")
async def submit_contact(body: ContactRequest, request: Request, db: AsyncSession = Depends(get_db)):
    if body.honeypot:
        return {"status": "accepted"}

    ip = request.client.host if request.client else "unknown"
    allowed, wait = otp_limiter.check(f"contact:{ip}")
    if not allowed:
        from fastapi import HTTPException
        raise HTTPException(429, "rate_limited")

    otp_limiter.record(f"contact:{ip}")

    user = None
    if body.email:
        stmt = select(WebsiteUser).where(WebsiteUser.email == body.email)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        if user:
            user.last_seen_at = datetime.now(timezone.utc)
            user.message_count += 1
            if body.name:
                user.name = body.name
            if body.phone:
                user.phone = body.phone
        else:
            user = WebsiteUser(
                name=body.name,
                email=body.email,
                phone=body.phone,
                organization=body.organization,
                country_code=body.country_code,
            )
            db.add(user)
    await db.flush()

    msg = ContactMessage(
        public_reference=_generate_reference(),
        website_user_id=user.id if user else None,
        channel=MessageChannel.contact_form,
        status=MessageStatus.new,
        priority=MessagePriority.normal,
        subject=body.subject or "Contact Form",
        body=body.message,
        sender_name=body.name,
        sender_email=body.email,
        sender_phone=body.phone,
        source_page=request.headers.get("referer", ""),
        ip_address=ip,
        user_agent=request.headers.get("user-agent", ""),
    )
    db.add(msg)
    await db.commit()

    logger.info("contact_submitted", reference=msg.public_reference, email=body.email)

    return {
        "status": "accepted",
        "reference": msg.public_reference,
    }
