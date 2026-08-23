import structlog
from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.models import AdminUser, AdminSession, AuditEvent, AuditLog
from app.models_rbac import Permission
from app.api.deps import require_permission, assert_can_manage
from app.services.totp_service import (
    generate_secret, encrypt_secret, verify_totp,
    get_provisioning_uri, store_pending_secret, get_pending_secret,
    clear_pending_secret,
)

logger = structlog.get_logger()
router = APIRouter(prefix="/admin/api/users", tags=["user-totp"])


class TotpEnableRequest(BaseModel):
    code: str = Field(min_length=6, max_length=8)


def _audit(db: AsyncSession, event: AuditEvent, actor_id=None, target_id=None, ip=None, meta=None):
    db.add(AuditLog(
        event=event,
        actor_admin_id=actor_id,
        target_admin_id=target_id,
        ip_address=ip,
        metadata_=meta or {},
    ))


@router.get("/{user_id}/totp/setup")
async def totp_setup(
    user_id: str,
    admin: AdminUser = Depends(require_permission(Permission.USERS_MANAGE_2FA)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AdminUser).where(AdminUser.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "user_not_found")

    if user.id != admin.id:
        await assert_can_manage(db, admin, user)

    secret = generate_secret()
    await store_pending_secret(str(user.id), secret)
    provisioning_uri = get_provisioning_uri(secret, user.username)

    return {
        "user_id": str(user.id),
        "username": user.username,
        "secret": secret,
        "otpauth_uri": provisioning_uri,
    }


@router.post("/{user_id}/totp/enable")
async def totp_enable(
    user_id: str,
    body: TotpEnableRequest,
    request: Request,
    admin: AdminUser = Depends(require_permission(Permission.USERS_MANAGE_2FA)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AdminUser).where(AdminUser.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "user_not_found")

    if user.totp_enabled:
        raise HTTPException(400, "totp_already_enabled")

    pending = await get_pending_secret(str(user.id))
    if not pending:
        raise HTTPException(400, "totp_setup_expired")

    if not verify_totp(pending, body.code):
        raise HTTPException(401, "invalid_totp_code")

    if user.id != admin.id:
        await assert_can_manage(db, admin, user)

    user.totp_secret_ciphertext = encrypt_secret(pending)
    user.totp_enabled = True
    user.totp_enabled_at = datetime.now(timezone.utc)

    _audit(db, AuditEvent.totp_enabled, actor_id=admin.id, target_id=user.id,
           ip=request.client.host if request.client else None,
           meta={"target_username": user.username})

    await db.commit()
    await clear_pending_secret(str(user.id))
    return {"status": "totp_enabled"}


@router.post("/{user_id}/totp/disable")
async def totp_disable(
    user_id: str,
    request: Request,
    admin: AdminUser = Depends(require_permission(Permission.USERS_MANAGE_2FA)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AdminUser).where(AdminUser.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "user_not_found")

    if not user.totp_enabled:
        raise HTTPException(400, "totp_not_enabled")

    if user.id != admin.id:
        await assert_can_manage(db, admin, user)

    user.totp_secret_ciphertext = None
    user.totp_enabled = False
    user.totp_enabled_at = None

    # Revoke sessions
    await db.execute(
        update(AdminSession)
        .where(AdminSession.admin_id == user.id, AdminSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )

    _audit(db, AuditEvent.totp_disabled, actor_id=admin.id, target_id=user.id,
           ip=request.client.host if request.client else None,
           meta={"target_username": user.username})

    await db.commit()
    return {"status": "totp_disabled"}


@router.post("/{user_id}/totp/reset")
async def totp_reset(
    user_id: str,
    request: Request,
    admin: AdminUser = Depends(require_permission(Permission.USERS_MANAGE_2FA)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AdminUser).where(AdminUser.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "user_not_found")

    if not user.totp_enabled:
        raise HTTPException(400, "totp_not_enabled")

    if user.id != admin.id:
        await assert_can_manage(db, admin, user)

    user.totp_secret_ciphertext = None
    user.totp_enabled = False
    user.totp_enabled_at = None

    # Revoke sessions
    await db.execute(
        update(AdminSession)
        .where(AdminSession.admin_id == user.id, AdminSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )

    _audit(db, AuditEvent.totp_disabled, actor_id=admin.id, target_id=user.id,
           ip=request.client.host if request.client else None,
           meta={"target_username": user.username, "action": "totp_reset"})

    await db.commit()
    return {"status": "totp_reset"}
