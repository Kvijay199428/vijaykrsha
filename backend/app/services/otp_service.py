import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from uuid import UUID
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import AuthChallenge, OtpPurpose, OtpDelivery
from app.config import get_settings

settings = get_settings()


def generate_otp(length: int = 6) -> str:
    return "".join(str(secrets.randbelow(10)) for _ in range(length))


def _hash_otp(otp: str) -> str:
    pepper = settings.OTP_PEPPER
    return hashlib.sha256(f"{pepper}:{otp}".encode()).hexdigest()


async def create_challenge(
    db: AsyncSession,
    admin_id: UUID,
    purpose: OtpPurpose = OtpPurpose.login,
    ttl_seconds: int = 300,
) -> AuthChallenge:
    challenge = secrets.token_urlsafe(32)
    challenge_hash = hashlib.sha256(challenge.encode()).hexdigest()

    auth_challenge = AuthChallenge(
        admin_id=admin_id,
        challenge_hash=challenge_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds),
        otp_purpose=purpose,
    )
    db.add(auth_challenge)
    await db.commit()
    return auth_challenge


async def get_challenge(db: AsyncSession, challenge_id: UUID) -> AuthChallenge | None:
    stmt = select(AuthChallenge).where(
        AuthChallenge.id == challenge_id,
        AuthChallenge.consumed_at.is_(None),
        AuthChallenge.expires_at > datetime.now(timezone.utc),
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_challenge_by_hash(db: AsyncSession, challenge_hash: str) -> AuthChallenge | None:
    stmt = select(AuthChallenge).where(
        AuthChallenge.challenge_hash == challenge_hash,
        AuthChallenge.consumed_at.is_(None),
        AuthChallenge.expires_at > datetime.now(timezone.utc),
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def set_otp_on_challenge(
    db: AsyncSession,
    challenge_id: UUID,
    otp: str,
    delivery: OtpDelivery,
    telegram_message_id: int | None = None,
) -> None:
    otp_hash = _hash_otp(otp)
    stmt = update(AuthChallenge).where(AuthChallenge.id == challenge_id).values(
        otp_hash=otp_hash,
        otp_delivery=delivery,
        telegram_message_id=telegram_message_id,
        otp_attempts=0,
    )
    await db.execute(stmt)
    await db.commit()


async def verify_otp(db: AsyncSession, challenge_id: UUID, otp: str) -> bool:
    challenge = await get_challenge(db, challenge_id)
    if not challenge:
        return False
    if not challenge.otp_hash:
        return False
    if challenge.otp_attempts >= 5:
        return False

    otp_hash = _hash_otp(otp)
    if challenge.otp_hash != otp_hash:
        challenge.otp_attempts += 1
        await db.commit()
        return False

    challenge.otp_verified_at = datetime.now(timezone.utc)
    await db.commit()
    return True


async def consume_challenge(db: AsyncSession, challenge_id: UUID) -> None:
    stmt = update(AuthChallenge).where(AuthChallenge.id == challenge_id).values(
        consumed_at=datetime.now(timezone.utc)
    )
    await db.execute(stmt)
    await db.commit()


async def can_resend_otp(db: AsyncSession, challenge_id: UUID, cooldown_seconds: int = 60) -> tuple[bool, float]:
    challenge = await get_challenge(db, challenge_id)
    if not challenge:
        return False, 0.0
    if not challenge.created_at:
        return True, 0.0

    elapsed = (datetime.now(timezone.utc) - challenge.created_at).total_seconds()
    if elapsed < cooldown_seconds:
        return False, cooldown_seconds - elapsed
    return True, 0.0
