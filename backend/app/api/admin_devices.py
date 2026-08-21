from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.models import (
    AdminUser, Device, DeviceState, TrustedDevice,
    AuditEvent, AuditLog, AdminSession,
)
from app.api.deps import get_current_admin, require_permission
from app.models_rbac import Permission
from app.security.devices import (
    revoke_device, block_device, unblock_device,
    revoke_trust, log_security_event,
)
from app.security.rate_limit import RedisBlocklist
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/admin/api", tags=["devices"])


def _device_to_dict(device: Device, is_current: bool = False) -> dict:
    return {
        "id": str(device.id),
        "browser_name": device.browser_name,
        "browser_version": device.browser_version,
        "os_name": device.os_name,
        "os_version": device.os_version,
        "device_type": device.device_type,
        "first_ip": str(device.first_ip) if device.first_ip else None,
        "last_ip": str(device.last_ip) if device.last_ip else None,
        "state": device.state.value if hasattr(device.state, "value") else device.state,
        "risk_score": device.risk_score,
        "first_seen_at": device.first_seen_at.isoformat() if device.first_seen_at else None,
        "last_seen_at": device.last_seen_at.isoformat() if device.last_seen_at else None,
        "last_login_at": device.last_login_at.isoformat() if device.last_login_at else None,
        "last_activity_at": device.last_activity_at.isoformat() if device.last_activity_at else None,
        "is_current": is_current,
    }


def _trust_to_dict(trust: TrustedDevice) -> dict:
    return {
        "id": str(trust.id),
        "device_id": str(trust.device_id),
        "trusted_at": trust.trusted_at.isoformat() if trust.trusted_at else None,
        "last_used_at": trust.last_used_at.isoformat() if trust.last_used_at else None,
        "expires_at": trust.expires_at.isoformat() if trust.expires_at else None,
        "revoked_at": trust.revoked_at.isoformat() if trust.revoked_at else None,
        "ip_address": str(trust.ip_address) if trust.ip_address else None,
    }


@router.get("/devices")
async def list_devices(
    request: Request,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Device).where(Device.admin_id == admin.id).order_by(Device.last_seen_at.desc())
    result = await db.execute(stmt)
    devices = result.scalars().all()

    current_device_token = request.cookies.get("__Host-device")
    current_device_id = None
    if current_device_token:
        import hashlib
        device_hash = hashlib.sha256(current_device_token.encode()).hexdigest()
        current = await db.execute(select(Device).where(Device.device_hash == device_hash))
        current_dev = current.scalar_one_or_none()
        if current_dev:
            current_device_id = current_dev.id

    items = []
    for d in devices:
        item = _device_to_dict(d, is_current=d.id == current_device_id)
        trust_stmt = select(TrustedDevice).where(
            TrustedDevice.device_id == d.id,
            TrustedDevice.revoked_at.is_(None),
            TrustedDevice.expires_at > datetime.now(timezone.utc),
        )
        trust_result = await db.execute(trust_stmt)
        trust = trust_result.scalar_one_or_none()
        item["is_trusted"] = trust is not None
        item["trust"] = _trust_to_dict(trust) if trust else None
        items.append(item)

    return {"items": items}


@router.get("/devices/trusted")
async def list_trusted_devices(
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(TrustedDevice)
        .where(
            TrustedDevice.admin_id == admin.id,
            TrustedDevice.revoked_at.is_(None),
            TrustedDevice.expires_at > datetime.now(timezone.utc),
        )
        .order_by(TrustedDevice.trusted_at.desc())
    )
    result = await db.execute(stmt)
    trusts = result.scalars().all()
    return {"items": [_trust_to_dict(t) for t in trusts]}


@router.get("/devices/{device_id}")
async def get_device(
    device_id: str,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Device).where(Device.id == UUID(device_id), Device.admin_id == admin.id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(404, "device_not_found")
    return _device_to_dict(device)


@router.post("/devices/{device_id}/revoke")
async def revoke_device_endpoint(
    device_id: str,
    request: Request,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Device).where(Device.id == UUID(device_id), Device.admin_id == admin.id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(404, "device_not_found")

    current_token = request.cookies.get("__Host-device")
    if current_token:
        import hashlib
        current_hash = hashlib.sha256(current_token.encode()).hexdigest()
        if device.device_hash == current_hash:
            raise HTTPException(400, "cannot_revoke_current_device")

    await revoke_device(db, device.id)
    await log_security_event(
        db, "device_revoked", "medium",
        admin_id=admin.id, device_id=device.id,
        ip_address=request.client.host if request.client else None,
        reason="Device revoked by user",
    )

    return {"status": "revoked"}


@router.post("/devices/{device_id}/block")
async def block_device_endpoint(
    device_id: str,
    request: Request,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Device).where(Device.id == UUID(device_id), Device.admin_id == admin.id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(404, "device_not_found")

    current_token = request.cookies.get("__Host-device")
    if current_token:
        import hashlib
        current_hash = hashlib.sha256(current_token.encode()).hexdigest()
        if device.device_hash == current_hash:
            raise HTTPException(400, "cannot_block_current_device")

    await block_device(db, device.id)
    if device.last_ip:
        await RedisBlocklist.block(f"ip:{device.last_ip}", ttl_seconds=3600)
    await log_security_event(
        db, "device_blocked", "high",
        admin_id=admin.id, device_id=device.id,
        ip_address=request.client.host if request.client else None,
        reason="Device blocked by user",
    )

    return {"status": "blocked"}


@router.post("/devices/{device_id}/unblock")
async def unblock_device_endpoint(
    device_id: str,
    request: Request,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Device).where(Device.id == UUID(device_id), Device.admin_id == admin.id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(404, "device_not_found")

    await unblock_device(db, device.id)
    if device.last_ip:
        await RedisBlocklist.unblock(f"ip:{device.last_ip}")

    return {"status": "unblocked"}


@router.post("/devices/{device_id}/revoke-trust")
async def revoke_trust_endpoint(
    device_id: str,
    request: Request,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Device).where(Device.id == UUID(device_id), Device.admin_id == admin.id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(404, "device_not_found")

    trust_stmt = select(TrustedDevice).where(
        TrustedDevice.device_id == device.id,
        TrustedDevice.revoked_at.is_(None),
    )
    trust_result = await db.execute(trust_stmt)
    trust = trust_result.scalar_one_or_none()
    if not trust:
        raise HTTPException(404, "no_active_trust")

    await revoke_trust(db, trust.id)
    await log_security_event(
        db, "device_revoked", "medium",
        admin_id=admin.id, device_id=device.id,
        ip_address=request.client.host if request.client else None,
        reason="Trust revoked by user",
    )

    return {"status": "trust_revoked"}
