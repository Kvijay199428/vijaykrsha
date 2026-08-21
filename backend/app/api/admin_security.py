from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.models import (
    AdminUser, SecurityEvent, SecurityEventType, SecuritySeverity,
    Device, DeviceState,
)
from app.api.deps import get_current_admin, require_permission
from app.models_rbac import Permission
from app.security.rate_limit import RedisBlocklist
from app.security.devices import log_security_event
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/admin/api/security", tags=["security"])


class BlockIpRequest(BaseModel):
    ip_address: str
    reason: str = ""
    ttl_seconds: int = 3600


class UnblockIpRequest(BaseModel):
    ip_address: str


@router.get("/dashboard")
async def security_dashboard(
    admin: AdminUser = Depends(require_permission(Permission.AUDIT_LOGS_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    last_24h = now - timedelta(hours=24)
    last_1h = now - timedelta(hours=1)

    total_24h = await db.execute(
        select(func.count(SecurityEvent.id)).where(SecurityEvent.created_at >= last_24h)
    )
    events_24h = total_24h.scalar() or 0

    total_1h = await db.execute(
        select(func.count(SecurityEvent.id)).where(SecurityEvent.created_at >= last_1h)
    )
    events_1h = total_1h.scalar() or 0

    blocked_24h = await db.execute(
        select(func.count(SecurityEvent.id)).where(
            SecurityEvent.event_type == SecurityEventType.rate_limited,
            SecurityEvent.created_at >= last_24h,
        )
    )
    blocked_count = blocked_24h.scalar() or 0

    failed_logins_24h = await db.execute(
        select(func.count(SecurityEvent.id)).where(
            SecurityEvent.event_type == SecurityEventType.login_failure,
            SecurityEvent.created_at >= last_24h,
        )
    )
    failed_logins = failed_logins_24h.scalar() or 0

    new_devices_24h = await db.execute(
        select(func.count(SecurityEvent.id)).where(
            SecurityEvent.event_type == SecurityEventType.new_device,
            SecurityEvent.created_at >= last_24h,
        )
    )
    new_devices = new_devices_24h.scalar() or 0

    active_devices = await db.execute(
        select(func.count(Device.id)).where(
            Device.state != DeviceState.revoked,
            Device.state != DeviceState.blocked,
        )
    )
    active_dev_count = active_devices.scalar() or 0

    severity_counts = {}
    for sev in SecuritySeverity:
        count_result = await db.execute(
            select(func.count(SecurityEvent.id)).where(
                SecurityEvent.severity == sev,
                SecurityEvent.created_at >= last_24h,
            )
        )
        severity_counts[sev.value] = count_result.scalar() or 0

    return {
        "events_24h": events_24h,
        "events_1h": events_1h,
        "blocked_requests_24h": blocked_count,
        "failed_logins_24h": failed_logins,
        "new_devices_24h": new_devices,
        "active_devices": active_dev_count,
        "severity_counts": severity_counts,
    }


@router.get("/events")
async def list_security_events(
    request: Request,
    admin: AdminUser = Depends(require_permission(Permission.AUDIT_LOGS_VIEW)),
    db: AsyncSession = Depends(get_db),
    page: int = 1,
    limit: int = 50,
    event_type: str | None = None,
    severity: str | None = None,
    admin_id: str | None = None,
):
    limit = min(limit, 100)
    offset = (max(page, 1) - 1) * limit

    stmt = select(SecurityEvent).order_by(SecurityEvent.created_at.desc())

    if event_type:
        stmt = stmt.where(SecurityEvent.event_type == event_type)
    if severity:
        stmt = stmt.where(SecurityEvent.severity == severity)
    if admin_id:
        stmt = stmt.where(SecurityEvent.admin_id == admin_id)

    count_stmt = select(func.count(SecurityEvent.id))
    if event_type:
        count_stmt = count_stmt.where(SecurityEvent.event_type == event_type)
    if severity:
        count_stmt = count_stmt.where(SecurityEvent.severity == severity)
    if admin_id:
        count_stmt = count_stmt.where(SecurityEvent.admin_id == admin_id)

    total = (await db.execute(count_stmt)).scalar() or 0
    result = await db.execute(stmt.offset(offset).limit(limit))
    events = result.scalars().all()

    items = []
    for e in events:
        items.append({
            "id": e.id,
            "event_type": e.event_type.value if hasattr(e.event_type, "value") else e.event_type,
            "severity": e.severity.value if hasattr(e.severity, "value") else e.severity,
            "admin_id": str(e.admin_id) if e.admin_id else None,
            "device_id": str(e.device_id) if e.device_id else None,
            "ip_address": str(e.ip_address) if e.ip_address else None,
            "user_agent": e.user_agent,
            "path": e.path,
            "method": e.method,
            "risk_score": e.risk_score,
            "reason": e.reason,
            "metadata": e.metadata_,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
    }


@router.get("/blocked-ips")
async def list_blocked_ips(
    admin: AdminUser = Depends(require_permission(Permission.AUDIT_LOGS_VIEW)),
):
    from app.security.rate_limit import get_redis
    r = await get_redis()
    keys = await r.keys("block:ip:*")
    items = []
    for key in keys:
        ip = key.replace("block:ip:", "")
        ttl = await r.ttl(key)
        items.append({"ip_address": ip, "ttl_seconds": max(ttl, 0)})
    return {"items": items}


@router.post("/block-ip")
async def block_ip_endpoint(
    body: BlockIpRequest,
    request: Request,
    admin: AdminUser = Depends(require_permission(Permission.AUDIT_LOGS_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    await RedisBlocklist.block(f"ip:{body.ip_address}", ttl_seconds=body.ttl_seconds)
    await log_security_event(
        db, "rate_limited", "high",
        admin_id=admin.id,
        ip_address=body.ip_address,
        reason=f"IP manually blocked by {admin.username}: {body.reason}",
        metadata={"manual_block": True, "ttl": body.ttl_seconds},
    )
    return {"status": "blocked", "ip_address": body.ip_address, "ttl_seconds": body.ttl_seconds}


@router.post("/unblock-ip")
async def unblock_ip_endpoint(
    body: UnblockIpRequest,
    request: Request,
    admin: AdminUser = Depends(require_permission(Permission.AUDIT_LOGS_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    await RedisBlocklist.unblock(f"ip:{body.ip_address}")
    return {"status": "unblocked", "ip_address": body.ip_address}
