from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.models import AdminSetting, AuditEvent, AuditLog, AdminUser
from app.api.deps import get_current_admin, require_owner, require_permission
from app.models_rbac import Permission
from app.security.password_policy import (
    PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, validate_password_strength,
)
from app.services.totp_service import (
    generate_secret, encrypt_secret, decrypt_secret, verify_totp,
    get_provisioning_uri, store_pending_secret, get_pending_secret,
    clear_pending_secret,
)
from app.security.sessions import revoke_other_sessions

router = APIRouter(prefix="/admin/api", tags=["settings"])


def _audit_setting(db: AsyncSession, event: AuditEvent, admin_id, meta=None):
    db.add(AuditLog(
        event=event,
        actor_admin_id=admin_id,
        metadata_=meta or {},
    ))


class TotpEnableRequest(BaseModel):
    code: str = Field(min_length=6, max_length=8)


class TotpDisableRequest(BaseModel):
    totp_code: str


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)
    new_password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return validate_password_strength(v)


class SettingsUpdate(BaseModel):
    trash_retention_days: int | None = None


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
        "trash_retention_days": setting.trash_retention_days,
    }


@router.patch("/settings")
async def update_settings(
    body: SettingsUpdate,
    admin: AdminUser = Depends(require_permission(Permission.SETTINGS_UPDATE)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AdminSetting).where(AdminSetting.id == 1))
    setting = result.scalar_one_or_none()
    if not setting:
        setting = AdminSetting()
        db.add(setting)
        await db.flush()

    if body.trash_retention_days is not None:
        if body.trash_retention_days < 1 or body.trash_retention_days > 3650:
            raise HTTPException(400, "retention_days_out_of_range")
        old_days = setting.trash_retention_days
        setting.trash_retention_days = body.trash_retention_days
        _audit_setting(db, AuditEvent.trash_retention_changed, admin.id, {
            "old_days": old_days,
            "new_days": body.trash_retention_days,
        })

    setting.updated_by = admin.id
    setting.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"status": "ok"}


@router.get("/settings/totp/setup")
async def totp_setup(admin: AdminUser = Depends(get_current_admin)):
    secret = generate_secret()
    await store_pending_secret(str(admin.id), secret)
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
    pending = await get_pending_secret(str(admin.id))
    if not pending:
        raise HTTPException(400, "totp_setup_expired")

    if not verify_totp(pending, body.code):
        raise HTTPException(400, "invalid_totp")

    admin.totp_secret_ciphertext = encrypt_secret(pending)
    admin.totp_enabled = True
    admin.totp_enabled_at = datetime.now(timezone.utc)
    admin.updated_at = datetime.now(timezone.utc)

    db.add(AuditLog(
        event=AuditEvent.totp_enabled,
        actor_admin_id=admin.id,
    ))
    await db.commit()
    await clear_pending_secret(str(admin.id))
    return {"status": "ok"}


@router.post("/settings/totp/disable")
async def totp_disable(
    body: TotpDisableRequest,
    request: Request,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    if not admin.totp_secret_ciphertext:
        raise HTTPException(400, "totp_not_enabled")

    secret = decrypt_secret(admin.totp_secret_ciphertext)
    if not verify_totp(secret, body.totp_code):
        raise HTTPException(400, "invalid_totp")

    admin.totp_secret_ciphertext = None
    admin.totp_enabled = False
    admin.totp_enabled_at = None
    admin.updated_at = datetime.now(timezone.utc)

    current_token = request.cookies.get("vks_session")
    if current_token:
        await revoke_other_sessions(db, str(admin.id), current_token)

    db.add(AuditLog(
        event=AuditEvent.totp_disabled,
        actor_admin_id=admin.id,
    ))
    await db.commit()
    return {"status": "ok"}


@router.post("/settings/change-password")
async def change_password(
    body: PasswordChangeRequest,
    request: Request,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.security.passwords import hash_password, verify_password
    if not verify_password(body.current_password, admin.password_hash):
        raise HTTPException(400, "invalid_password")

    admin.password_hash = hash_password(body.new_password)
    admin.password_changed_at = datetime.now(timezone.utc)
    admin.updated_at = datetime.now(timezone.utc)

    current_token = request.cookies.get("vks_session")
    if current_token:
        await revoke_other_sessions(db, str(admin.id), current_token)

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

    total = (await db.execute(select(func.count(ContactMessage.id)).where(ContactMessage.deleted_at.isnot(None) == False))).scalar()  # noqa: E712
    new_count = (await db.execute(
        select(func.count(ContactMessage.id)).where(ContactMessage.status == MessageStatus.new, ContactMessage.deleted_at.isnot(None) == False)  # noqa: E712
    )).scalar()
    in_progress = (await db.execute(
        select(func.count(ContactMessage.id)).where(ContactMessage.status == MessageStatus.in_progress, ContactMessage.deleted_at.isnot(None) == False)  # noqa: E712
    )).scalar()
    resolved = (await db.execute(
        select(func.count(ContactMessage.id)).where(ContactMessage.status == MessageStatus.resolved, ContactMessage.deleted_at.isnot(None) == False)  # noqa: E712
    )).scalar()
    trashed = (await db.execute(
        select(func.count(ContactMessage.id)).where(ContactMessage.deleted_at.isnot(None))
    )).scalar()

    return {
        "total_messages": total,
        "new_messages": new_count,
        "in_progress": in_progress,
        "resolved": resolved,
        "trashed_count": trashed,
    }
