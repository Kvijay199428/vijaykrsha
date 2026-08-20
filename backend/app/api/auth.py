import structlog
from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.models import (
    AdminUser, AdminStatus, AuthChallenge, OtpPurpose, OtpDelivery,
    AuditEvent, AuditLog,
)
from app.config import get_settings
from app.security.passwords import hash_password, verify_password
from app.security.sessions import create_session, revoke_session
from app.security.rate_limit import login_limiter
from app.services.otp_service import (
    create_challenge, get_challenge, set_otp_on_challenge,
    verify_otp, consume_challenge, generate_otp, can_resend_otp,
)
from app.services.totp_service import verify_totp, generate_secret, encrypt_secret
from app.services.telegram_service import send_otp
from app.api.deps import get_current_admin

settings = get_settings()
logger = structlog.get_logger()
router = APIRouter(prefix="/admin/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str
    remember_me: bool = False


class SetupRequest(BaseModel):
    username: str
    password: str
    email: str | None = None
    display_name: str


class LoginOtpVerifyRequest(BaseModel):
    challenge_id: str
    code: str
    remember_me: bool = False


class LoginTotpRequest(BaseModel):
    challenge_id: str
    code: str
    remember_me: bool = False


class ForgotVerifyRequest(BaseModel):
    username: str
    totp_code: str


class ForgotResetRequest(BaseModel):
    challenge_id: str
    new_password: str


def _audit(db: AsyncSession, event: AuditEvent, admin_id=None, ip=None, ua=None, meta=None):
    db.add(AuditLog(
        event=event,
        actor_admin_id=admin_id,
        ip_address=ip,
        user_agent=ua,
        metadata_=meta or {},
    ))


@router.get("/setup-required")
async def setup_required(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(func.count(AdminUser.id)))
    count = result.scalar()
    return {"required": count == 0}


@router.post("/setup-create")
async def setup_create(body: SetupRequest, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(func.count(AdminUser.id)))
    count = result.scalar()
    if count > 0:
        raise HTTPException(400, "admins_exist")

    admin = AdminUser(
        username=body.username,
        email=body.email,
        display_name=body.display_name,
        password_hash=hash_password(body.password),
        role="owner",
        status=AdminStatus.active,
    )
    db.add(admin)
    await db.flush()

    token = await create_session(
        db, admin.id,
        request.client.host if request.client else None,
        request.headers.get("user-agent"),
    )

    response = {"status": "ok", "admin": {"id": str(admin.id), "username": admin.username}}
    from starlette.responses import JSONResponse
    resp = JSONResponse(content=response)
    resp.set_cookie(
        "vks_session", token,
        httponly=True, secure=True, samesite="lax",
        max_age=12 * 3600,
    )
    return resp


@router.post("/login")
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "")

    allowed, retry_after = login_limiter.check(ip)
    if not allowed:
        raise HTTPException(429, f"rate_limited_retry_{int(retry_after)}s")

    stmt = select(AdminUser).where(AdminUser.username == body.username)
    result = await db.execute(stmt)
    admin = result.scalar_one_or_none()

    if not admin or not verify_password(body.password, admin.password_hash):
        login_limiter.record(ip)
        _audit(db, AuditEvent.login_failure, admin_id=admin.id if admin else None, ip=ip, ua=ua)
        raise HTTPException(401, "invalid_credentials")

    if admin.status != AdminStatus.active:
        raise HTTPException(403, "account_disabled")

    now = datetime.now(timezone.utc)
    if admin.locked_until and admin.locked_until > now:
        raise HTTPException(423, "account_locked")

    challenge = await create_challenge(db, admin.id)
    telegram_otp = settings.TELEGRAM_OTP_ENABLED and admin.telegram_chat_id
    methods = []
    if telegram_otp:
        methods.append("telegram_otp")
    if admin.totp_enabled:
        methods.append("totp")

    if telegram_otp:
        otp_code = generate_otp(settings.TELEGRAM_OTP_LENGTH)
        sent = await send_otp(admin.telegram_chat_id, otp_code)
        if sent:
            await set_otp_on_challenge(db, challenge.id, otp_code, OtpDelivery.telegram)

    _audit(db, AuditEvent.login_success, admin_id=admin.id, ip=ip, ua=ua)
    admin.last_login_at = now
    admin.failed_login_count = 0
    await db.commit()

    login_limiter.record(ip)

    return {
        "status": "second_factor_required",
        "challenge_id": str(challenge.id),
        "methods": methods,
        "remember_me": body.remember_me,
    }


@router.post("/login-otp-send")
async def login_otp_send(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.json()
    challenge_id = body.get("challenge_id")
    if not challenge_id:
        raise HTTPException(400, "challenge_id_required")

    challenge = await get_challenge(db, UUID(challenge_id))
    if not challenge:
        raise HTTPException(400, "invalid_challenge")

    admin = (await db.execute(select(AdminUser).where(AdminUser.id == challenge.admin_id))).scalar_one_or_none()
    if not admin or not admin.telegram_chat_id:
        raise HTTPException(400, "telegram_not_configured")

    can_send, wait = await can_resend_otp(db, challenge.id, settings.TELEGRAM_OTP_RESEND_SECONDS)
    if not can_send:
        raise HTTPException(429, f"resend_cooldown_{int(wait)}s")

    otp_code = generate_otp(settings.TELEGRAM_OTP_LENGTH)
    sent = await send_otp(admin.telegram_chat_id, otp_code)
    if not sent:
        raise HTTPException(502, "telegram_send_failed")

    await set_otp_on_challenge(db, challenge.id, otp_code, OtpDelivery.telegram)
    _audit(db, AuditEvent.otp_sent, admin_id=admin.id, ip=request.client.host if request.client else None)

    return {"status": "sent", "cooldown_seconds": settings.TELEGRAM_OTP_RESEND_SECONDS}


@router.post("/login-otp-verify")
async def login_otp_verify(body: LoginOtpVerifyRequest, request: Request, db: AsyncSession = Depends(get_db)):
    challenge = await get_challenge(db, UUID(body.challenge_id))
    if not challenge:
        raise HTTPException(400, "invalid_challenge")

    valid = await verify_otp(db, challenge.id, body.code)
    if not valid:
        raise HTTPException(401, "invalid_otp")

    admin = (await db.execute(select(AdminUser).where(AdminUser.id == challenge.admin_id))).scalar_one_or_none()
    if admin.totp_enabled:
        return {"status": "totp_required", "challenge_id": str(challenge.id)}

    await consume_challenge(db, challenge.id)
    token = await create_session(
        db, admin.id,
        request.client.host if request.client else None,
        request.headers.get("user-agent"),
        body.remember_me,
    )
    _audit(db, AuditEvent.otp_verified, admin_id=admin.id, ip=request.client.host if request.client else None)

    from starlette.responses import JSONResponse
    resp = JSONResponse(content={
        "status": "ok",
        "admin": {"id": str(admin.id), "username": admin.username, "role": admin.role},
    })
    resp.set_cookie(
        "vks_session", token,
        httponly=True, secure=True, samesite="lax",
        max_age=12 * 3600 if body.remember_me else 2 * 3600,
    )
    return resp


@router.post("/login-totp")
async def login_totp(body: LoginTotpRequest, request: Request, db: AsyncSession = Depends(get_db)):
    challenge = await get_challenge(db, UUID(body.challenge_id))
    if not challenge:
        raise HTTPException(400, "invalid_challenge")
    if not challenge.otp_verified_at:
        raise HTTPException(400, "otp_not_verified")

    admin = (await db.execute(select(AdminUser).where(AdminUser.id == challenge.admin_id))).scalar_one_or_none()
    if not admin or not admin.totp_enabled or not admin.totp_secret_ciphertext:
        raise HTTPException(400, "totp_not_enabled")

    from app.services.totp_service import decrypt_secret
    secret = decrypt_secret(admin.totp_secret_ciphertext)
    if not verify_totp(secret, body.code):
        challenge.totp_attempts += 1
        await db.commit()
        raise HTTPException(401, "invalid_totp")

    await consume_challenge(db, challenge.id)
    token = await create_session(
        db, admin.id,
        request.client.host if request.client else None,
        request.headers.get("user-agent"),
        body.remember_me,
    )
    _audit(db, AuditEvent.totp_verified, admin_id=admin.id, ip=request.client.host if request.client else None)

    from starlette.responses import JSONResponse
    resp = JSONResponse(content={
        "status": "ok",
        "admin": {"id": str(admin.id), "username": admin.username, "role": admin.role},
    })
    resp.set_cookie(
        "vks_session", token,
        httponly=True, secure=True, samesite="lax",
        max_age=12 * 3600 if body.remember_me else 2 * 3600,
    )
    return resp


@router.get("/me")
async def get_me(admin: AdminUser = Depends(get_current_admin)):
    return {
        "id": str(admin.id),
        "username": admin.username,
        "email": admin.email,
        "display_name": admin.display_name,
        "role": admin.role,
        "totp_enabled": admin.totp_enabled,
        "telegram_chat_id": admin.telegram_chat_id,
    }


@router.post("/logout")
async def logout(request: Request, db: AsyncSession = Depends(get_db)):
    from starlette.responses import JSONResponse
    token = request.cookies.get("vks_session")
    if token:
        await revoke_session(db, token)
        _audit(db, AuditEvent.logout, ip=request.client.host if request.client else None)
    resp = JSONResponse(content={"status": "ok"})
    resp.delete_cookie("vks_session")
    return resp


@router.post("/password/forgot-verify")
async def forgot_verify(body: ForgotVerifyRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(AdminUser).where(AdminUser.username == body.username)
    admin = (await db.execute(stmt)).scalar_one_or_none()
    if not admin:
        raise HTTPException(400, "invalid_credentials")
    if not admin.totp_enabled or not admin.totp_secret_ciphertext:
        raise HTTPException(400, "totp_not_configured")

    from app.services.totp_service import decrypt_secret
    secret = decrypt_secret(admin.totp_secret_ciphertext)
    if not verify_totp(secret, body.totp_code):
        raise HTTPException(401, "invalid_totp")

    challenge = await create_challenge(db, admin.id, OtpPurpose.password_reset, ttl_seconds=300)
    return {"status": "verified", "challenge_id": str(challenge.id)}


@router.post("/password/forgot-reset")
async def forgot_reset(body: ForgotResetRequest, db: AsyncSession = Depends(get_db)):
    challenge = await get_challenge(db, UUID(body.challenge_id))
    if not challenge or challenge.otp_purpose != OtpPurpose.password_reset:
        raise HTTPException(400, "invalid_challenge")

    admin = (await db.execute(select(AdminUser).where(AdminUser.id == challenge.admin_id))).scalar_one_or_none()
    if not admin:
        raise HTTPException(400, "admin_not_found")

    admin.password_hash = hash_password(body.new_password)
    admin.password_changed_at = datetime.now(timezone.utc)
    await consume_challenge(db, challenge.id)
    _audit(db, AuditEvent.password_changed, admin_id=admin.id)

    return {"status": "ok"}
