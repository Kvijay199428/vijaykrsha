import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import AdminSession, AdminUser
from app.config import get_settings
from app.security.session_events import publish_session_event

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
) -> tuple[str, AdminSession]:
    token, token_hash = create_session_token()
    idle = timedelta(minutes=settings.SESSION_IDLE_MINUTES)
    if remember_me:
        absolute = timedelta(hours=settings.SESSION_ABSOLUTE_HOURS)
    else:
        absolute = timedelta(hours=2)

    now = datetime.now(timezone.utc)

    existing = await db.execute(
        select(AdminSession).where(
            AdminSession.admin_id == admin_id,
            AdminSession.revoked_at.is_(None),
            AdminSession.expires_at > now,
        )
    )
    active_count = len(existing.scalars().all())

    evicted_session_id: UUID | None = None
    if active_count >= settings.MAX_CONCURRENT_SESSIONS:
        oldest = await db.execute(
            select(AdminSession).where(
                AdminSession.admin_id == admin_id,
                AdminSession.revoked_at.is_(None),
            ).order_by(AdminSession.created_at.asc()).limit(1)
        )
        oldest_session = oldest.scalar_one_or_none()
        if oldest_session:
            oldest_session.revoked_at = now
            evicted_session_id = oldest_session.id

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

    if evicted_session_id is not None:
        # An over-limit session was dropped: tell its live socket immediately.
        await publish_session_event(
            "session_revoked",
            admin_id=str(admin_id),
            session_id=str(evicted_session_id),
            reason="concurrent_session_limit",
        )

    return token, session


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


async def get_session_by_id(db: AsyncSession, session_id: str | UUID) -> AdminSession | None:
    try:
        sid = session_id if isinstance(session_id, UUID) else UUID(str(session_id))
    except (ValueError, TypeError):
        return None
    stmt = (
        select(AdminSession)
        .where(
            AdminSession.id == sid,
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
    row = (
        await db.execute(
            select(AdminSession).where(
                AdminSession.session_hash == token_hash,
                AdminSession.revoked_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if not row:
        return
    row.revoked_at = datetime.now(timezone.utc)
    await db.commit()
    await publish_session_event(
        "session_revoked",
        admin_id=str(row.admin_id),
        session_id=str(row.id),
        reason="session_revoked",
    )


async def revoke_session_by_id(db: AsyncSession, session_id: str | UUID) -> None:
    row = await get_session_by_id(db, session_id)
    if not row:
        return
    row.revoked_at = datetime.now(timezone.utc)
    await db.commit()
    await publish_session_event(
        "session_revoked",
        admin_id=str(row.admin_id),
        session_id=str(row.id),
        reason="session_revoked_by_id",
    )


async def revoke_all_sessions(db: AsyncSession, admin_id: UUID) -> None:
    stmt = update(AdminSession).where(
        AdminSession.admin_id == admin_id,
        AdminSession.revoked_at.is_(None),
    ).values(revoked_at=datetime.now(timezone.utc))
    await db.execute(stmt)
    await db.commit()
    await publish_session_event(
        "session_revoked",
        admin_id=str(admin_id),
        reason="all_sessions_revoked",
    )


async def revoke_other_sessions(db: AsyncSession, admin_id: str | UUID, current_token: str) -> None:
    """Revoke every active session for the admin except the one holding current_token."""
    current_hash = _hash_session_token(current_token)
    rows = (
        await db.execute(
            select(AdminSession.id).where(
                AdminSession.admin_id == admin_id,
                AdminSession.session_hash != current_hash,
                AdminSession.revoked_at.is_(None),
            )
        )
    ).scalars().all()
    stmt = update(AdminSession).where(
        AdminSession.admin_id == admin_id,
        AdminSession.session_hash != current_hash,
        AdminSession.revoked_at.is_(None),
    ).values(revoked_at=datetime.now(timezone.utc))
    await db.execute(stmt)
    await db.commit()
    for sid in rows:
        await publish_session_event(
            "session_revoked",
            admin_id=str(admin_id),
            session_id=str(sid),
            reason="other_sessions_revoked",
        )
