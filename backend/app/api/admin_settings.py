from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.models import AdminSetting, AuditEvent, AuditLog, AdminUser
from app.api.deps import get_current_admin, require_owner
from app.services.totp_service import generate_secret, encrypt_secret, decrypt_secret, verify_totp, get_provisioning_uri
from app.security.sessions import revoke_all_sessions

router = APIRouter(prefix="/admin/api", tags=["settings"])


class TotpEnableRequest(BaseModel):
    code: str
    secret: str


class TotpDisableRequest(BaseModel):
    totp_code: str


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


@router.get("/settings")
async def get_settings(admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AdminSetting).where(AdminSetting.id == 1))
    setting = result.scalar_one_or_none()
    if not setting:
        setting = AdminSetting()
        db.add(setting)
        await db.commit()

    return {
        "telegram_otp_required": setting.telegram_otp_required,
        "totp_enabled": admin.totp_enabled,
        "otp_length": setting.otp_length,
        "otp_ttl_seconds": setting.otp_ttl_seconds,
        "session_idle_minutes": setting.session_idle_minutes,
    }


@router.get("/settings/totp/setup")
async def totp_setup(admin: AdminUser = Depends(get_current_admin)):
    secret = generate_secret()
    uri = get_provisioning_uri(secret, admin.username)
    return {
        "secret": secret,
        "provisioning_uri": uri,
    }


@router.post("/settings/totp/enable")
async def totp_enable(
    body: TotpEnableRequest,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    if not verify_totp(body.secret, body.code):
        from fastapi import HTTPException
        raise HTTPException(400, "invalid_totp")

    admin.totp_secret_ciphertext = encrypt_secret(body.secret)
    admin.totp_enabled = True
    admin.totp_enabled_at = datetime.now(timezone.utc)
    admin.updated_at = datetime.now(timezone.utc)

    db.add(AuditLog(
        event=AuditEvent.totp_enabled,
        actor_admin_id=admin.id,
    ))
    await db.commit()
    return {"status": "ok"}


@router.post("/settings/totp/disable")
async def totp_disable(
    body: TotpDisableRequest,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    if not admin.totp_secret_ciphertext:
        from fastapi import HTTPException
        raise HTTPException(400, "totp_not_enabled")

    secret = decrypt_secret(admin.totp_secret_ciphertext)
    if not verify_totp(secret, body.totp_code):
        from fastapi import HTTPException
        raise HTTPException(400, "invalid_totp")

    admin.totp_secret_ciphertext = None
    admin.totp_enabled = False
    admin.totp_enabled_at = None
    admin.updated_at = datetime.now(timezone.utc)

    db.add(AuditLog(
        event=AuditEvent.totp_disabled,
        actor_admin_id=admin.id,
    ))
    await db.commit()
    return {"status": "ok"}


@router.post("/settings/change-password")
async def change_password(
    body: PasswordChangeRequest,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.security.passwords import hash_password, verify_password
    if not verify_password(body.current_password, admin.password_hash):
        from fastapi import HTTPException
        raise HTTPException(400, "invalid_password")

    admin.password_hash = hash_password(body.new_password)
    admin.password_changed_at = datetime.now(timezone.utc)
    admin.updated_at = datetime.now(timezone.utc)

    db.add(AuditLog(
        event=AuditEvent.password_changed,
        actor_admin_id=admin.id,
    ))
    await db.commit()
    return {"status": "ok"}


@router.get("/audit-logs")
async def get_audit_logs(
    page: int = 1,
    limit: int = 50,
    admin: AdminUser = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import func, desc
    total = (await db.execute(select(func.count(AuditLog.id)))).scalar()
    offset = (page - 1) * limit
    result = await db.execute(
        select(AuditLog).order_by(desc(AuditLog.created_at)).offset(offset).limit(limit)
    )
    logs = result.scalars().all()
    return {
        "items": [
            {
                "id": l.id,
                "event": l.event,
                "actor_admin_id": str(l.actor_admin_id) if l.actor_admin_id else None,
                "ip_address": l.ip_address,
                "metadata": l.metadata_,
                "created_at": l.created_at.isoformat() if l.created_at else None,
            }
            for l in logs
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/admin-users")
async def list_admin_users(
    admin: AdminUser = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AdminUser).order_by(AdminUser.created_at))
    users = result.scalars().all()
    return {
        "items": [
            {
                "id": str(u.id),
                "username": u.username,
                "email": u.email,
                "display_name": u.display_name,
                "role": u.role,
                "status": u.status,
                "totp_enabled": u.totp_enabled,
                "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ],
    }


@router.get("/stats")
async def get_stats(
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.models import ContactMessage, MessageStatus
    from sqlalchemy import func

    total = (await db.execute(select(func.count(ContactMessage.id)))).scalar()
    new_count = (await db.execute(
        select(func.count(ContactMessage.id)).where(ContactMessage.status == MessageStatus.new)
    )).scalar()
    in_progress = (await db.execute(
        select(func.count(ContactMessage.id)).where(ContactMessage.status == MessageStatus.in_progress)
    )).scalar()
    resolved = (await db.execute(
        select(func.count(ContactMessage.id)).where(ContactMessage.status == MessageStatus.resolved)
    )).scalar()

    return {
        "total_messages": total,
        "new_messages": new_count,
        "in_progress": in_progress,
        "resolved": resolved,
    }
