import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import (
    Device, DeviceState, TrustedDevice, AdminSession,
    AdminUser, SecurityEvent, SecurityEventType, SecuritySeverity,
)
from app.config import get_settings

settings = get_settings()

_BOT_PATTERNS = (
    "bot", "spider", "crawler", "scraper", "headless", "phantom",
    "selenium", "puppeteer", "playwright", "curl", "wget",
    "python-requests", "python-urllib", "httpx", "aiohttp",
    "go-http-client", "java/", "okhttp",
)


def _hash_device(device_token: str) -> str:
    return hashlib.sha256(device_token.encode()).hexdigest()


def _hash_trust(trust_secret: str) -> str:
    return hashlib.sha256(trust_secret.encode()).hexdigest()


def _parse_user_agent(ua: str) -> dict:
    result = {
        "browser_name": None,
        "browser_version": None,
        "os_name": None,
        "os_version": None,
        "device_type": "desktop",
    }
    if not ua:
        return result

    ua_lower = ua.lower()

    for pattern in _BOT_PATTERNS:
        if pattern in ua_lower:
            result["device_type"] = "bot"
            return result

    if "mobile" in ua_lower or "android" in ua_lower:
        result["device_type"] = "mobile"
    elif "tablet" in ua_lower or "ipad" in ua_lower:
        result["device_type"] = "tablet"

    if "chrome/" in ua_lower and "edg/" not in ua_lower:
        result["browser_name"] = "Chrome"
        try:
            idx = ua_lower.index("chrome/") + 7
            end = ua_lower.index(" ", idx) if " " in ua_lower[idx:] else len(ua)
            result["browser_version"] = ua[idx:end].split(".")[0]
        except (ValueError, IndexError):
            pass
    elif "edg/" in ua_lower:
        result["browser_name"] = "Edge"
        try:
            idx = ua_lower.index("edg/") + 4
            end = ua_lower.index(" ", idx) if " " in ua_lower[idx:] else len(ua)
            result["browser_version"] = ua[idx:end].split(".")[0]
        except (ValueError, IndexError):
            pass
    elif "firefox/" in ua_lower:
        result["browser_name"] = "Firefox"
        try:
            idx = ua_lower.index("firefox/") + 8
            end = ua_lower.index(" ", idx) if " " in ua_lower[idx:] else len(ua)
            result["browser_version"] = ua[idx:end].split(".")[0]
        except (ValueError, IndexError):
            pass
    elif "safari/" in ua_lower and "chrome" not in ua_lower:
        result["browser_name"] = "Safari"

    if "windows" in ua_lower:
        result["os_name"] = "Windows"
        if "windows nt 10" in ua_lower:
            result["os_version"] = "10"
        elif "windows nt 11" in ua_lower or ("windows nt 10" in ua_lower and "build/22" in ua_lower):
            result["os_version"] = "11"
    elif "mac os" in ua_lower or "macos" in ua_lower:
        result["os_name"] = "macOS"
    elif "linux" in ua_lower and "android" not in ua_lower:
        result["os_name"] = "Linux"
    elif "android" in ua_lower:
        result["os_name"] = "Android"
        try:
            idx = ua_lower.index("android ") + 8
            end = ua_lower.index(";", idx) if ";" in ua_lower[idx:] else len(ua)
            result["os_version"] = ua[idx:end].strip().split(".")[0]
        except (ValueError, IndexError):
            pass
    elif "iphone" in ua_lower or "ipad" in ua_lower:
        result["os_name"] = "iOS"

    return result


async def identify_or_create_device(
    db: AsyncSession,
    device_token: str | None,
    admin_id: UUID,
    ip_address: str | None,
    user_agent: str | None,
) -> tuple[Device, bool, str]:
    is_new = False
    if device_token:
        device_hash = _hash_device(device_token)
        stmt = select(Device).where(Device.device_hash == device_hash)
        result = await db.execute(stmt)
        device = result.scalar_one_or_none()

        if device and device.admin_id == admin_id:
            device.last_seen_at = datetime.now(timezone.utc)
            device.last_ip = ip_address
            if user_agent:
                device.user_agent = user_agent
                parsed = _parse_user_agent(user_agent)
                device.browser_name = parsed["browser_name"]
                device.browser_version = parsed["browser_version"]
                device.os_name = parsed["os_name"]
                device.os_version = parsed["os_version"]
                device.device_type = parsed["device_type"]
            device.last_activity_at = datetime.now(timezone.utc)
            await db.commit()
            new_token = device_token
            return device, False, new_token

    new_token = secrets.token_urlsafe(32)
    new_hash = _hash_device(new_token)
    parsed = _parse_user_agent(user_agent or "")

    device = Device(
        device_hash=new_hash,
        admin_id=admin_id,
        first_ip=ip_address,
        last_ip=ip_address,
        user_agent=user_agent,
        browser_name=parsed["browser_name"],
        browser_version=parsed["browser_version"],
        os_name=parsed["os_name"],
        os_version=parsed["os_version"],
        device_type=parsed["device_type"],
        state=DeviceState.unknown,
        last_activity_at=datetime.now(timezone.utc),
    )
    db.add(device)
    await db.flush()
    is_new = True

    if is_new:
        db.add(SecurityEvent(
            event_type=SecurityEventType.new_device,
            severity=SecuritySeverity.low,
            admin_id=admin_id,
            device_id=device.id,
            ip_address=ip_address,
            user_agent=user_agent,
            risk_score=0,
            reason="New device registered",
        ))

    return device, is_new, new_token


async def get_device_by_token(
    db: AsyncSession,
    device_token: str,
) -> Device | None:
    device_hash = _hash_device(device_token)
    stmt = select(Device).where(Device.device_hash == device_hash)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def revoke_device(db: AsyncSession, device_id: UUID) -> None:
    stmt = update(Device).where(Device.id == device_id).values(
        state=DeviceState.revoked,
        updated_at=datetime.now(timezone.utc),
    )
    await db.execute(stmt)

    await db.execute(
        update(AdminSession).where(
            AdminSession.device_id == device_id,
            AdminSession.revoked_at.is_(None),
        ).values(revoked_at=datetime.now(timezone.utc))
    )

    await db.execute(
        update(TrustedDevice).where(
            TrustedDevice.device_id == device_id,
            TrustedDevice.revoked_at.is_(None),
        ).values(revoked_at=datetime.now(timezone.utc))
    )
    await db.commit()


async def block_device(db: AsyncSession, device_id: UUID) -> None:
    stmt = update(Device).where(Device.id == device_id).values(
        state=DeviceState.blocked,
        updated_at=datetime.now(timezone.utc),
    )
    await db.execute(stmt)
    await db.commit()


async def unblock_device(db: AsyncSession, device_id: UUID) -> None:
    stmt = update(Device).where(Device.id == device_id).values(
        state=DeviceState.unknown,
        updated_at=datetime.now(timezone.utc),
    )
    await db.execute(stmt)
    await db.commit()


async def create_trust(
    db: AsyncSession,
    device_id: UUID,
    admin_id: UUID,
    ip_address: str | None,
    user_agent: str | None,
) -> tuple[str, TrustedDevice]:
    trust_secret = secrets.token_urlsafe(32)
    trust_hash = _hash_trust(trust_secret)

    existing = await db.execute(
        select(TrustedDevice).where(
            TrustedDevice.device_id == device_id,
            TrustedDevice.revoked_at.is_(None),
        )
    )
    existing_trust = existing.scalar_one_or_none()
    if existing_trust:
        existing_trust.trust_hash = trust_hash
        existing_trust.trusted_at = datetime.now(timezone.utc)
        existing_trust.expires_at = datetime.now(timezone.utc) + timedelta(days=settings.TRUST_EXPIRY_DAYS)
        existing_trust.ip_address = ip_address
        existing_trust.user_agent = user_agent
        await db.commit()
        return trust_secret, existing_trust

    trust = TrustedDevice(
        device_id=device_id,
        admin_id=admin_id,
        trust_hash=trust_hash,
        ip_address=ip_address,
        user_agent=user_agent,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.TRUST_EXPIRY_DAYS),
    )
    db.add(trust)

    await db.execute(
        update(Device).where(Device.id == device_id).values(
            state=DeviceState.trusted,
            updated_at=datetime.now(timezone.utc),
        )
    )
    await db.commit()
    return trust_secret, trust


async def verify_trust(
    db: AsyncSession,
    trust_secret: str,
) -> TrustedDevice | None:
    trust_hash = _hash_trust(trust_secret)
    stmt = select(TrustedDevice).where(
        TrustedDevice.trust_hash == trust_hash,
        TrustedDevice.revoked_at.is_(None),
        TrustedDevice.expires_at > datetime.now(timezone.utc),
    )
    result = await db.execute(stmt)
    trust = result.scalar_one_or_none()
    if trust:
        trust.last_used_at = datetime.now(timezone.utc)
        await db.commit()
    return trust


async def revoke_trust(db: AsyncSession, trust_id: UUID) -> None:
    stmt = update(TrustedDevice).where(
        TrustedDevice.id == trust_id,
        TrustedDevice.revoked_at.is_(None),
    ).values(revoked_at=datetime.now(timezone.utc))
    await db.execute(stmt)
    await db.commit()


async def revoke_all_trust_for_device(db: AsyncSession, device_id: UUID) -> None:
    stmt = update(TrustedDevice).where(
        TrustedDevice.device_id == device_id,
        TrustedDevice.revoked_at.is_(None),
    ).values(revoked_at=datetime.now(timezone.utc))
    await db.execute(stmt)
    await db.commit()


async def count_active_trusted_devices(db: AsyncSession, admin_id: UUID) -> int:
    result = await db.execute(
        select(func.count(TrustedDevice.id)).where(
            TrustedDevice.admin_id == admin_id,
            TrustedDevice.revoked_at.is_(None),
            TrustedDevice.expires_at > datetime.now(timezone.utc),
        )
    )
    return result.scalar() or 0


async def log_security_event(
    db: AsyncSession,
    event_type: SecurityEventType,
    severity: SecuritySeverity = SecuritySeverity.low,
    admin_id: UUID | None = None,
    session_id: UUID | None = None,
    device_id: UUID | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    path: str | None = None,
    method: str | None = None,
    risk_score: int = 0,
    reason: str = "",
    metadata: dict | None = None,
) -> None:
    event = SecurityEvent(
        event_type=event_type,
        severity=severity,
        admin_id=admin_id,
        session_id=session_id,
        device_id=device_id,
        ip_address=ip_address,
        user_agent=user_agent,
        path=path,
        method=method,
        risk_score=risk_score,
        reason=reason,
        metadata_=metadata or {},
    )
    db.add(event)
    await db.commit()
