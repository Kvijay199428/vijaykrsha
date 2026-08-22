import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import AdminSession, AdminUser
from app.config import get_settings

settings = get_settings()


def _hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session_token() -> tuple[str, str]:
    token = secrets.token_urlsafe(48)
    return token, _hash_session_token(token)


async def create_session(
    db: AsyncSession,
    admin_id: UUID,
    ip_address: str | None,
    user_agent: str | None,
    remember_me: bool = False,
    device_id: UUID | None = None,
) -> str:
    token, token_hash = create_session_token()
    idle = timedelta(minutes=settings.SESSION_IDLE_MINUTES)
    if remember_me:
        absolute = timedelta(hours=settings.SESSION_ABSOLUTE_HOURS)
    else:
        absolute = timedelta(hours=2)

    existing = await db.execute(
        select(AdminSession).where(
            AdminSession.admin_id == admin_id,
            AdminSession.revoked_at.is_(None),
            AdminSession.expires_at > datetime.now(timezone.utc),
        )
    )
    active_count = len(existing.scalars().all())

    if active_count >= settings.MAX_CONCURRENT_SESSIONS:
        oldest = await db.execute(
            select(AdminSession).where(
                AdminSession.admin_id == admin_id,
                AdminSession.revoked_at.is_(None),
            ).order_by(AdminSession.created_at.asc()).limit(1)
        )
        oldest_session = oldest.scalar_one_or_none()
        if oldest_session:
            oldest_session.revoked_at = datetime.now(timezone.utc)

    now = datetime.now(timezone.utc)
    session = AdminSession(
        admin_id=admin_id,
        device_id=device_id,
        session_hash=token_hash,
        ip_address=ip_address,
        user_agent=user_agent,
        expires_at=now + min(idle, absolute),
        absolute_expires_at=now + absolute,
    )
    db.add(session)
    await db.commit()
    return token


async def get_session(db: AsyncSession, token: str) -> AdminSession | None:
    token_hash = _hash_session_token(token)
    stmt = (
        select(AdminSession)
        .where(
            AdminSession.session_hash == token_hash,
            AdminSession.revoked_at.is_(None),
            AdminSession.expires_at > datetime.now(timezone.utc),
        )
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def touch_session(db: AsyncSession, session: AdminSession) -> None:
    session.last_seen_at = datetime.now(timezone.utc)
    idle = timedelta(minutes=settings.SESSION_IDLE_MINUTES)
    if session.absolute_expires_at is not None:
        absolute_limit = session.absolute_expires_at
    else:
        # Legacy rows created before 006 migration.
        absolute_limit = session.created_at + timedelta(hours=settings.SESSION_ABSOLUTE_HOURS)
    session.expires_at = min(
        datetime.now(timezone.utc) + idle,
        absolute_limit,
    )
    await db.commit()


async def revoke_session(db: AsyncSession, token: str) -> None:
    token_hash = _hash_session_token(token)
    stmt = update(AdminSession).where(
        AdminSession.session_hash == token_hash,
        AdminSession.revoked_at.is_(None),
    ).values(revoked_at=datetime.now(timezone.utc))
    await db.execute(stmt)
    await db.commit()


async def revoke_all_sessions(db: AsyncSession, admin_id: UUID) -> None:
    stmt = update(AdminSession).where(
        AdminSession.admin_id == admin_id,
        AdminSession.revoked_at.is_(None),
    ).values(revoked_at=datetime.now(timezone.utc))
    await db.execute(stmt)
    await db.commit()


async def revoke_other_sessions(db: AsyncSession, admin_id: str | UUID, current_token: str) -> None:
    """Revoke every active session for the admin except the one holding current_token."""
    current_hash = _hash_session_token(current_token)
    stmt = update(AdminSession).where(
        AdminSession.admin_id == admin_id,
        AdminSession.session_hash != current_hash,
        AdminSession.revoked_at.is_(None),
    ).values(revoked_at=datetime.now(timezone.utc))
    await db.execute(stmt)
    await db.commit()
