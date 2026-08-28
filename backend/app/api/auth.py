import structlog
from datetime import datetime, timedelta, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import JSONResponse
from starlette.websockets import WebSocketDisconnect
from app.security.csrf import issue_csrf_cookie
from app.db import get_db
from app.models import (
    AdminUser, AdminStatus, AuthChallenge, OtpPurpose, OtpDelivery,
    AuditEvent, AuditLog, Device,
)
from app.config import get_settings
from app.models_rbac import AdminRole as AdminRoleModel
from app.security.passwords import hash_password, verify_password
from app.security.password_policy import (
    PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, validate_password_strength,
)
from app.security.sessions import create_session, revoke_session
from app.security.encryption import new_encryption_keypair, decrypt_password
from app.security.tokens import (
    create_access_token, create_refresh_token, rotate_refresh_token,
    revoke_refresh_token, block_access_token_jti, create_ws_ticket,
    verify_ws_ticket, create_exchange_code, verify_exchange_code,
    consume_exchange_code, TokenError, TokenReuseDetected,
)
from app.security.rate_limit import (
    login_ip_limiter, login_user_limiter, otp_send_limiter,
    otp_verify_limiter, totp_verify_limiter, setup_limiter,
    forgot_verify_limiter, forgot_reset_limiter,
    RedisBlocklist,
)
from app.security.devices import (
    identify_or_create_device, create_trust, verify_trust,
    count_active_trusted_devices, log_security_event,
)
from app.security.risk import RiskSignals, calculate_risk
from app.security.bot_detection import analyze_request_signals
from app.services.otp_service import (
    create_challenge, get_challenge, set_otp_on_challenge,
    verify_otp, consume_challenge, generate_otp, can_resend_otp,
)
from app.services.totp_service import verify_totp, generate_secret, encrypt_secret
from app.services.telegram_service import send_otp
from app.api.deps import (
    get_current_admin,
    get_current_admin_with_session,
    get_admin_role_level,
)

settings = get_settings()
logger = structlog.get_logger()
router = APIRouter(prefix="/admin/api/auth", tags=["auth"])
# WebSocket auth channel lives OUTSIDE the /admin/api/* prefix so it is not
# caught by DirectAccessGuard (which requires X-Forwarded-By: pages-proxy —
# a header browsers cannot set on a WebSocket handshake).
ws_router = APIRouter(tags=["auth-ws"])

_DUMMY_PASSWORD_HASH = hash_password("::timing-equalizer::")


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str | None = Field(default=None, min_length=1, max_length=256)
    password_cipher: str | None = None
    key_id: str | None = None
    remember_me: bool = False
    legacy_plaintext: bool = False

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        return v.strip()

    @field_validator("password", "password_cipher", "key_id")
    @classmethod
    def strip_optionals(cls, v):
        if v is None:
            return v
        return v.strip()


class PublicKeyResponse(BaseModel):
    key_id: str
    public_key: str


class ExchangeRequest(BaseModel):
    exchange_code: str = Field(min_length=8, max_length=2048)


class WebSocketAuthMessage(BaseModel):
    action: str
    method: str | None = None
    code: str | None = None


class SetupRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)
    email: str | None = None
    display_name: str = Field(min_length=1, max_length=160)

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        return v.strip()

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return validate_password_strength(v)


class LoginOtpVerifyRequest(BaseModel):
    challenge_id: str
    code: str = Field(min_length=4, max_length=8)
    remember_me: bool = False


class LoginTotpRequest(BaseModel):
    challenge_id: str
    code: str = Field(min_length=6, max_length=6)
    remember_me: bool = False

    @field_validator("code")
    @classmethod
    def validate_totp_code(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("TOTP code must be 6 digits")
        return v


class ForgotVerifyRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    totp_code: str = Field(min_length=6, max_length=6)

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        return v.strip()


class ForgotResetRequest(BaseModel):
    challenge_id: str
    new_password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return validate_password_strength(v)


class TrustDeviceRequest(BaseModel):
    trust: bool = True


def _audit(db: AsyncSession, event: AuditEvent, admin_id=None, ip=None, ua=None, meta=None):
    db.add(AuditLog(
        event=event,
        actor_admin_id=admin_id,
        ip_address=ip,
        user_agent=ua,
        metadata_=meta or {},
    ))


def _get_lockout_duration(failed_count: int) -> timedelta:
    if failed_count >= settings.MAX_LOGIN_ATTEMPTS:
        return timedelta(minutes=settings.LOCKOUT_MINUTES)
    elif failed_count >= settings.LOCKOUT_SHORT_THRESHOLD:
        return timedelta(seconds=settings.LOCKOUT_SHORT_SECONDS)
    return timedelta(seconds=0)


@router.get("/setup-required")
async def setup_required(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(func.count(AdminUser.id)))
    count = result.scalar()
    return {"required": count == 0}


@router.post("/setup-create")
async def setup_create(body: SetupRequest, request: Request, db: AsyncSession = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"

    allowed, retry_after = await setup_limiter.check_and_record(ip)
    if not allowed:
        raise HTTPException(429, detail={
            "detail": "Too many setup attempts. Please wait before trying again.",
            "type": "rate_limited",
            "retry_after": int(retry_after),
        })

    result = await db.execute(select(func.count(AdminUser.id)))
    count = result.scalar()
    if count > 0:
        raise HTTPException(400, "admins_exist")

    # admin_users.role_id is NOT NULL (002_rbac): resolve or bootstrap the
    # owner role so first-run setup works on a freshly migrated database.
    role_result = await db.execute(
        select(AdminRoleModel).where(AdminRoleModel.name == "owner")
    )
    owner_role = role_result.scalar_one_or_none()
    if not owner_role:
        owner_role = AdminRoleModel(
            name="owner",
            description="Full system access",
            is_system=True,
            level=100,
        )
        db.add(owner_role)
        await db.flush()

    admin = AdminUser(
        username=body.username,
        email=body.email,
        display_name=body.display_name,
        password_hash=hash_password(body.password),
        role="owner",
        role_id=owner_role.id,
        status=AdminStatus.active,
    )
    db.add(admin)
    await db.flush()

    device_token = request.cookies.get(settings.device_cookie_name)
    device, is_new, new_device_token = await identify_or_create_device(
        db, device_token, admin.id,
        ip, request.headers.get("user-agent"),
    )

    token = await create_session(
        db, admin.id, ip,
        request.headers.get("user-agent"),
        device_id=device.id,
    )

    resp = JSONResponse(content={
        "status": "ok",
        "admin": {"id": str(admin.id), "username": admin.username},
    })
    resp.set_cookie(
        "vks_session", token,
        httponly=True, secure=settings.cookie_secure, samesite="lax",
        max_age=12 * 3600,
        path="/",
    )
    issue_csrf_cookie(resp)
    resp.set_cookie(
        settings.device_cookie_name, new_device_token,
        httponly=True, secure=settings.cookie_secure, samesite="lax",
        max_age=365 * 24 * 3600,
        path="/",
    )
    return resp


@router.post("/login")
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "")
    path = request.url.path

    if await RedisBlocklist.is_blocked(f"ip:{ip}"):
        raise HTTPException(429, detail={
            "detail": "Your IP has been temporarily blocked due to suspicious activity.",
            "type": "ip_blocked",
            "retry_after": await RedisBlocklist.get_block_ttl(f"ip:{ip}"),
        })

    allowed, retry_after = await login_ip_limiter.check_and_record(ip)
    if not allowed:
        await log_security_event(
            db, "rate_limited", "medium",
            ip_address=ip, user_agent=ua, path=path, method="POST",
            reason=f"Login IP rate limited: {ip}",
        )
        raise HTTPException(429, detail={
            "detail": "Too many login attempts from this IP. Please wait before trying again.",
            "type": "rate_limited",
            "retry_after": int(retry_after),
        })

    allowed_user, retry_user = await login_user_limiter.check_and_record(body.username)
    if not allowed_user:
        raise HTTPException(429, detail={
            "detail": "Too many failed attempts for this account. Please wait before trying again.",
            "type": "rate_limited",
            "retry_after": int(retry_user),
        })

    stmt = select(AdminUser).where(AdminUser.username == body.username)
    result = await db.execute(stmt)
    admin = result.scalar_one_or_none()

    # Resolve the plaintext password. New clients encrypt it with the
    # ephemeral RSA key (password_cipher + key_id). Legacy clients send
    # it as plaintext (password + legacy_plaintext) to preserve
    # backward compatibility during migration.
    plain_password: str | None = None
    if body.password_cipher and body.key_id:
        try:
            plain_password = await decrypt_password(body.key_id, body.password_cipher)
        except ValueError:
            plain_password = None
    elif body.legacy_plaintext and body.password:
        plain_password = body.password

    if not admin or not plain_password or not verify_password(plain_password, admin.password_hash):
        if not admin:
            verify_password(plain_password or body.password or "", _DUMMY_PASSWORD_HASH)
        if admin:
            admin.failed_login_count += 1
            lockout_dur = _get_lockout_duration(admin.failed_login_count)
            if lockout_dur > timedelta(seconds=0):
                admin.locked_until = datetime.now(timezone.utc) + lockout_dur
                await log_security_event(
                    db, "login_lockout", "high",
                    admin_id=admin.id, ip_address=ip, user_agent=ua,
                    path=path, method="POST",
                    reason=f"Account locked after {admin.failed_login_count} failures",
                    metadata={"failed_count": admin.failed_login_count, "lockout_seconds": int(lockout_dur.total_seconds())},
                )
            await db.commit()
        _audit(db, AuditEvent.login_failure, admin_id=admin.id if admin else None, ip=ip, ua=ua)
        await log_security_event(
            db, "login_failure", "medium",
            admin_id=admin.id if admin else None,
            ip_address=ip, user_agent=ua, path=path, method="POST",
            reason=f"Failed login for {body.username}",
        )
        raise HTTPException(401, "invalid_credentials")

    if admin.status != AdminStatus.active:
        raise HTTPException(403, "account_disabled")

    now = datetime.now(timezone.utc)
    if admin.locked_until and admin.locked_until > now:
        remaining = int((admin.locked_until - now).total_seconds())
        await log_security_event(
            db, "login_lockout", "high",
            admin_id=admin.id, ip_address=ip, user_agent=ua,
            path=path, method="POST",
            reason="Login attempt on locked account",
            metadata={"remaining_seconds": remaining},
        )
        raise HTTPException(423, detail={
            "detail": (
                f"Account temporarily suspended due to repeated failed password attempts. "
                f"Try again in {max(remaining // 60, 1)} minute(s), or contact an administrator "
                f"to restore access sooner."
            ),
            "type": "account_locked",
            "retry_after": remaining,
        })

    admin.failed_login_count = 0
    admin.locked_until = None
    await db.commit()

    device_token = request.cookies.get(settings.device_cookie_name)
    device, is_new, new_device_token = await identify_or_create_device(
        db, device_token, admin.id,
        ip, ua,
    )

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
    await log_security_event(
        db, "login_success", "low",
        admin_id=admin.id, device_id=device.id,
        ip_address=ip, user_agent=ua, path=path, method="POST",
        reason="Password verified, awaiting second factor",
    )

    admin.last_login_at = now
    await db.commit()

    return {
        "status": "second_factor_required",
        "challenge_id": str(challenge.id),
        "methods": methods,
        "remember_me": body.remember_me,
        "ws_ticket": create_ws_ticket(str(challenge.id)),
    }


@router.post("/login-otp-send")
async def login_otp_send(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.json()
    challenge_id = body.get("challenge_id")
    if not challenge_id:
        raise HTTPException(400, "challenge_id_required")

    ip = request.client.host if request.client else "unknown"

    allowed, retry_after = await otp_send_limiter.check_and_record(f"otp:{challenge_id}")
    if not allowed:
        raise HTTPException(429, detail={
            "detail": "Please wait before requesting a new code.",
            "type": "resend_cooldown",
            "retry_after": int(retry_after),
        })

    challenge = await get_challenge(db, UUID(challenge_id))
    if not challenge:
        raise HTTPException(400, "invalid_challenge")

    admin = (await db.execute(select(AdminUser).where(AdminUser.id == challenge.admin_id))).scalar_one_or_none()
    if not admin or not admin.telegram_chat_id:
        raise HTTPException(400, "telegram_not_configured")

    can_send, wait = await can_resend_otp(db, challenge.id, settings.TELEGRAM_OTP_RESEND_SECONDS)
    if not can_send:
        raise HTTPException(429, detail={
            "detail": "Please wait before requesting a new code.",
            "type": "resend_cooldown",
            "retry_after": int(wait),
        })

    otp_code = generate_otp(settings.TELEGRAM_OTP_LENGTH)
    sent = await send_otp(admin.telegram_chat_id, otp_code)
    if not sent:
        raise HTTPException(502, "telegram_send_failed")

    await set_otp_on_challenge(db, challenge.id, otp_code, OtpDelivery.telegram)
    _audit(db, AuditEvent.otp_sent, admin_id=admin.id, ip=ip)
    await db.commit()

    return {"status": "sent", "cooldown_seconds": settings.TELEGRAM_OTP_RESEND_SECONDS}


@router.post("/login-otp-verify")
async def login_otp_verify(body: LoginOtpVerifyRequest, request: Request, db: AsyncSession = Depends(get_db)):
    challenge = await get_challenge(db, UUID(body.challenge_id))
    if not challenge:
        raise HTTPException(400, "invalid_challenge")

    ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "")

    allowed, retry_after = await otp_verify_limiter.check_and_record(f"otp_verify:{body.challenge_id}")
    if not allowed:
        raise HTTPException(429, detail={
            "detail": "Too many verification attempts. Please wait before trying again.",
            "type": "verify_cooldown",
            "retry_after": int(retry_after),
        })

    valid = await verify_otp(db, challenge.id, body.code)
    if not valid:
        await log_security_event(
            db, "otp_failure", "medium",
            admin_id=challenge.admin_id, ip_address=ip, user_agent=ua,
            reason="Invalid OTP code",
        )
        raise HTTPException(401, "invalid_otp")

    admin = (await db.execute(select(AdminUser).where(AdminUser.id == challenge.admin_id))).scalar_one_or_none()

    device_token = request.cookies.get(settings.device_cookie_name)
    device, is_new, new_device_token = await identify_or_create_device(
        db, device_token, admin.id, ip, ua,
    )

    if admin.totp_enabled:
        return {"status": "totp_required", "challenge_id": str(challenge.id)}

    await consume_challenge(db, challenge.id)
    token = await create_session(
        db, admin.id, ip, ua, body.remember_me, device_id=device.id,
    )
    _audit(db, AuditEvent.otp_verified, admin_id=admin.id, ip=ip)
    await log_security_event(
        db, "session_created", "low",
        admin_id=admin.id, device_id=device.id,
        ip_address=ip, user_agent=ua,
        reason="Session created after OTP verification",
    )

    resp = JSONResponse(content={
        "status": "ok",
        "admin": {"id": str(admin.id), "username": admin.username, "role": admin.role},
    })
    resp.set_cookie(
        "vks_session", token,
        httponly=True, secure=settings.cookie_secure, samesite="lax",
        max_age=12 * 3600 if body.remember_me else 2 * 3600,
        path="/",
    )
    issue_csrf_cookie(resp)
    resp.set_cookie(
        settings.device_cookie_name, new_device_token,
        httponly=True, secure=settings.cookie_secure, samesite="lax",
        max_age=365 * 24 * 3600,
        path="/",
    )
    return resp


@router.post("/login-totp")
async def login_totp(body: LoginTotpRequest, request: Request, db: AsyncSession = Depends(get_db)):
    challenge = await get_challenge(db, UUID(body.challenge_id))
    if not challenge:
        raise HTTPException(400, "invalid_challenge")
    if not challenge.otp_verified_at:
        raise HTTPException(400, "otp_not_verified")

    ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "")

    allowed, retry_after = await totp_verify_limiter.check_and_record(f"totp:{challenge.admin_id}")
    if not allowed:
        raise HTTPException(429, detail={
            "detail": "Too many verification attempts. Please wait before trying again.",
            "type": "verify_cooldown",
            "retry_after": int(retry_after),
        })

    admin = (await db.execute(select(AdminUser).where(AdminUser.id == challenge.admin_id))).scalar_one_or_none()
    if not admin or not admin.totp_enabled or not admin.totp_secret_ciphertext:
        raise HTTPException(400, "totp_not_enabled")

    from app.services.totp_service import decrypt_secret
    secret = decrypt_secret(admin.totp_secret_ciphertext)
    if not verify_totp(secret, body.code):
        challenge.totp_attempts += 1
        await db.commit()
        await log_security_event(
            db, "totp_failure", "medium",
            admin_id=admin.id, ip_address=ip, user_agent=ua,
            reason="Invalid TOTP code",
        )
        raise HTTPException(401, "invalid_totp")

    device_token = request.cookies.get(settings.device_cookie_name)
    device, is_new, new_device_token = await identify_or_create_device(
        db, device_token, admin.id, ip, ua,
    )

    await consume_challenge(db, challenge.id)
    token = await create_session(
        db, admin.id, ip, ua, body.remember_me, device_id=device.id,
    )
    _audit(db, AuditEvent.totp_verified, admin_id=admin.id, ip=ip)
    await log_security_event(
        db, "session_created", "low",
        admin_id=admin.id, device_id=device.id,
        ip_address=ip, user_agent=ua,
        reason="Session created after TOTP verification",
    )

    resp = JSONResponse(content={
        "status": "ok",
        "admin": {"id": str(admin.id), "username": admin.username, "role": admin.role},
    })
    resp.set_cookie(
        "vks_session", token,
        httponly=True, secure=settings.cookie_secure, samesite="lax",
        max_age=12 * 3600 if body.remember_me else 2 * 3600,
        path="/",
    )
    issue_csrf_cookie(resp)
    resp.set_cookie(
        settings.device_cookie_name, new_device_token,
        httponly=True, secure=settings.cookie_secure, samesite="lax",
        max_age=365 * 24 * 3600,
        path="/",
    )
    return resp


@router.post("/trust-device")
async def trust_device_endpoint(
    body: TrustDeviceRequest,
    request: Request,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "")

    device_token = request.cookies.get(settings.device_cookie_name)
    if not device_token:
        raise HTTPException(400, "no_device_cookie")

    from app.security.devices import get_device_by_token
    device = await get_device_by_token(db, device_token)
    if not device or device.admin_id != admin.id:
        raise HTTPException(404, "device_not_found")

    if body.trust:
        count = await count_active_trusted_devices(db, admin.id)
        if count >= settings.MAX_TRUSTED_DEVICES:
            raise HTTPException(400, "max_trusted_devices_reached")

        trust_secret, trust = await create_trust(db, device.id, admin.id, ip, ua)
        await log_security_event(
            db, "device_trusted", "low",
            admin_id=admin.id, device_id=device.id,
            ip_address=ip, user_agent=ua,
            reason="Device trusted by user",
        )

        resp = JSONResponse(content={"status": "trusted", "device_id": str(device.id)})
        resp.set_cookie(
            settings.trusted_device_cookie_name, trust_secret,
            httponly=True, secure=settings.cookie_secure, samesite="lax",
            max_age=settings.TRUST_EXPIRY_DAYS * 24 * 3600,
            path="/",
        )
        return resp
    else:
        from app.security.devices import revoke_all_trust_for_device
        await revoke_all_trust_for_device(db, device.id)
        resp = JSONResponse(content={"status": "trust_removed"})
        resp.delete_cookie(settings.trusted_device_cookie_name, path="/")
        return resp


@router.get("/me")
async def get_me(
    deps: tuple = Depends(get_current_admin_with_session),
    db: AsyncSession = Depends(get_db),
):
    admin, session = deps
    now = datetime.now(timezone.utc)

    if session is not None and session.absolute_expires_at is not None and session.created_at is not None:
        remember_me = (session.absolute_expires_at - session.created_at) > timedelta(hours=6)
    else:
        remember_me = True

    return {
        "id": str(admin.id),
        "username": admin.username,
        "email": admin.email,
        "display_name": admin.display_name,
        "role": admin.role,
        "role_level": await get_admin_role_level(db, admin),
        "totp_enabled": admin.totp_enabled,
        "telegram_chat_id": admin.telegram_chat_id,
        "session": {
            "created_at": session.created_at.isoformat() if session and session.created_at else None,
            "expires_at": session.expires_at.isoformat() if session and session.expires_at else None,
            "absolute_expires_at": (
                session.absolute_expires_at.isoformat()
                if session and session.absolute_expires_at else None
            ),
            "remember_me": remember_me,
            "server_time": now.isoformat(),
        },
    }


@router.post("/logout")
async def logout(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("vks_session")
    refresh_token = request.cookies.get("refresh_token")
    ip = request.client.host if request.client else "unknown"

    if token:
        await revoke_session(db, token)

    if refresh_token:
        await revoke_refresh_token(refresh_token)

    # Block the current access token so it cannot be reused until expiry.
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            claims = verify_access_token(auth_header[7:])
            await block_access_token_jti(claims["jti"])
        except TokenError:
            pass

    _audit(db, AuditEvent.logout, ip=ip)
    await log_security_event(
        db, "session_revoked", "low",
        ip_address=ip, reason="User logout",
    )

    resp = JSONResponse(content={"status": "ok"})
    resp.delete_cookie("vks_session")
    resp.delete_cookie("refresh_token")
    resp.delete_cookie("refresh_token", path="/api/admin/api/auth/refresh")
    resp.delete_cookie(settings.trusted_device_cookie_name, path="/")
    return resp


@router.get("/public-key")
async def public_key():
    key_id, public_pem = await new_encryption_keypair()
    return PublicKeyResponse(key_id=key_id, public_key=public_pem)


@router.post("/exchange")
async def exchange(body: ExchangeRequest, request: Request, db: AsyncSession = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "")

    try:
        claims = verify_exchange_code(body.exchange_code)
        admin_id = claims["sub"]
        await consume_exchange_code(body.exchange_code)
    except TokenError:
        raise HTTPException(401, "invalid_exchange_code")

    stmt = select(AdminUser).where(AdminUser.id == admin_id)
    admin = (await db.execute(stmt)).scalar_one_or_none()
    if not admin or admin.status != AdminStatus.active:
        raise HTTPException(401, "invalid_exchange_code")

    role_level = await get_admin_role_level(db, admin)

    access_token = create_access_token(
        str(admin.id), admin.username, admin.role, role_level,
    )
    refresh_token, _ = await create_refresh_token(
        str(admin.id), remember_me=True,
    )

    await log_security_event(
        db, "session_created", "low",
        admin_id=admin.id, ip_address=ip, user_agent=ua,
        reason="Session created after WebSocket 2FA verification",
    )

    resp = JSONResponse(content={
        "access_token": access_token,
        "expires_in": settings.JWT_ACCESS_TTL_MINUTES * 60,
        "token_type": "Bearer",
        "admin": {"id": str(admin.id), "username": admin.username, "role": admin.role},
    })
    resp.set_cookie(
        "refresh_token", refresh_token,
        httponly=True, secure=settings.cookie_secure, samesite="strict",
        max_age=settings.JWT_REFRESH_TTL_DAYS * 24 * 3600,
        path="/api/admin/api/auth/refresh",
    )
    return resp


@router.post("/refresh")
async def refresh(request: Request):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(401, "refresh_token_required")

    try:
        new_refresh_token, user_id = await rotate_refresh_token(refresh_token)
    except TokenReuseDetected:
        raise HTTPException(401, "refresh_token_reused")
    except TokenError:
        raise HTTPException(401, "refresh_token_invalid")

    from app.db import async_session as _async_session
    async with _async_session() as db:
        stmt = select(AdminUser).where(AdminUser.id == user_id)
        admin = (await db.execute(stmt)).scalar_one_or_none()
        if not admin or admin.status != AdminStatus.active:
            raise HTTPException(401, "admin_disabled")

        role_level = await get_admin_role_level(db, admin)
        access_token = create_access_token(
            str(admin.id), admin.username, admin.role, role_level,
        )

    resp = JSONResponse(content={
        "access_token": access_token,
        "expires_in": settings.JWT_ACCESS_TTL_MINUTES * 60,
        "token_type": "Bearer",
    })
    resp.set_cookie(
        "refresh_token", new_refresh_token,
        httponly=True, secure=settings.cookie_secure, samesite="strict",
        max_age=settings.JWT_REFRESH_TTL_DAYS * 24 * 3600,
        path="/api/admin/api/auth/refresh",
    )
    return resp


@ws_router.websocket("/ws/auth")
async def websocket_auth(websocket: WebSocket):
    ticket = websocket.query_params.get("ticket")
    if not ticket:
        await websocket.close(code=4401)
        return

    try:
        claims = verify_ws_ticket(ticket)
    except TokenError:
        await websocket.close(code=4403)
        return

    challenge_id = claims["sub"]
    await websocket.accept()
    await websocket.send_json({"event": "connected", "challenge_id": challenge_id})

    ip = websocket.client.host if websocket.client else "unknown"

    from app.db import async_session as session_factory
    from app.models import AdminUser as AdminUserModel
    from sqlalchemy import select as sselect
    from app.services.otp_service import get_challenge as _get_challenge
    from app.services.totp_service import decrypt_secret as _decrypt_secret

    try:
        while True:
            raw = await websocket.receive()
            if raw.get("type") == "websocket.disconnect":
                break
            if raw.get("type") != "websocket.receive":
                continue
            text = raw.get("text")
            if not text:
                continue
            try:
                import json
                msg = json.loads(text)
            except Exception:
                continue

            action = msg.get("action")
            method = msg.get("method")
            code = msg.get("code")

            if action == "verify" and method and code:
                allowed, _ = await otp_verify_limiter.check_and_record(f"otp_verify:{challenge_id}")
                if not allowed:
                    await websocket.send_json({
                        "event": "error", "code": "rate_limited",
                        "retry_after": 30,
                    })
                    continue

                async with session_factory() as db:
                    challenge = await _get_challenge(db, UUID(challenge_id))
                    if not challenge:
                        await websocket.send_json({"event": "error", "code": "challenge_expired"})
                        continue
                    admin_row = (await db.execute(
                        sselect(AdminUserModel).where(AdminUserModel.id == challenge.admin_id)
                    )).scalar_one_or_none()
                    if not admin_row:
                        await websocket.send_json({"event": "error", "code": "invalid_challenge"})
                        continue

                    if method == "telegram_otp":
                        valid = await verify_otp(db, challenge.id, code)
                        if not valid:
                            await log_security_event(
                                db, "otp_failure", "medium",
                                admin_id=challenge.admin_id, ip_address=ip,
                                reason="Invalid OTP code (WebSocket)",
                            )
                            await websocket.send_json({"event": "error", "code": "invalid_code"})
                            continue
                        if admin_row.totp_enabled:
                            await websocket.send_json({"event": "state", "state": "awaiting_totp"})
                        else:
                            await consume_challenge(db, challenge.id)
                            exchange_code = create_exchange_code(str(admin_row.id))
                            await websocket.send_json({
                                "event": "auth_success",
                                "exchange_code": exchange_code,
                                "admin": {
                                    "id": str(admin_row.id),
                                    "username": admin_row.username,
                                    "role": admin_row.role,
                                },
                            })
                            await websocket.close()
                            break

                    elif method == "totp":
                        if not challenge.otp_verified_at:
                            await websocket.send_json({"event": "error", "code": "otp_not_verified"})
                            continue
                        if not admin_row.totp_enabled or not admin_row.totp_secret_ciphertext:
                            await websocket.send_json({"event": "error", "code": "totp_not_enabled"})
                            continue
                        secret = _decrypt_secret(admin_row.totp_secret_ciphertext)
                        if not verify_totp(secret, code):
                            await log_security_event(
                                db, "totp_failure", "medium",
                                admin_id=admin_row.id, ip_address=ip,
                                reason="Invalid TOTP code (WebSocket)",
                            )
                            await websocket.send_json({"event": "error", "code": "invalid_code"})
                            continue
                        await consume_challenge(db, challenge.id)
                        exchange_code = create_exchange_code(str(admin_row.id))
                        await websocket.send_json({
                            "event": "auth_success",
                            "exchange_code": exchange_code,
                            "admin": {
                                "id": str(admin_row.id),
                                "username": admin_row.username,
                                "role": admin_row.role,
                            },
                        })
                        await websocket.close()
                        break

    except WebSocketDisconnect:
        pass
    except Exception:
        try:
            await websocket.close(code=1011)
        except Exception:
            pass


@router.post("/password/forgot-verify")
async def forgot_verify(body: ForgotVerifyRequest, request: Request, db: AsyncSession = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"

    allowed, retry_after = await forgot_verify_limiter.check_and_record(ip)
    if not allowed:
        raise HTTPException(429, detail={
            "detail": "Too many attempts. Please wait before trying again.",
            "type": "rate_limited",
            "retry_after": int(retry_after),
        })

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
async def forgot_reset(body: ForgotResetRequest, request: Request, db: AsyncSession = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"

    allowed, retry_after = await forgot_reset_limiter.check_and_record(ip)
    if not allowed:
        raise HTTPException(429, detail={
            "detail": "Too many attempts. Please wait before trying again.",
            "type": "rate_limited",
            "retry_after": int(retry_after),
        })

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

    from app.security.sessions import revoke_all_sessions
    await revoke_all_sessions(db, admin.id)

    return {"status": "ok"}
