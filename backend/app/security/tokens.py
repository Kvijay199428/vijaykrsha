import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import jwt
from jwt.exceptions import InvalidTokenError
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

from app.config import get_settings
from app.security.rate_limit import get_redis

settings = get_settings()

ACCESS_TOKEN_TTL = timedelta(minutes=15)
REFRESH_TOKEN_TTL = timedelta(days=7)
REFRESH_TOKEN_TTL_SHORT = timedelta(hours=2)
WS_TICKET_TTL = timedelta(seconds=30)
EXCHANGE_CODE_TTL = timedelta(seconds=30)

ACCESS_ALGORITHM = "RS256"

_JWS_KEYS_DIR = Path(__file__).resolve().parent.parent / "jws_keys"
_PRIVATE_KEY_FILE = _JWS_KEYS_DIR / "jws_private.pem"
_PUBLIC_KEY_FILE = _JWS_KEYS_DIR / "jws_public.pem"

_signing_key: Optional[str] = None
_verify_key: Optional[str] = None


class TokenError(Exception):
    pass


class TokenReuseDetected(TokenError):
    pass


class TokenExpired(TokenError):
    pass


class InvalidToken(TokenError):
    pass


def _ensure_keys() -> None:
    """Return the PEM private/public key strings, generating and persisting an
    RSA-2048 pair on first use if not already present or provided via env."""
    global _signing_key, _verify_key

    if _signing_key and _verify_key:
        return

    env_priv = (settings.JWT_SIGNING_PRIVATE_KEY or "").strip()
    env_pub = (settings.JWT_SIGNING_PUBLIC_KEY or "").strip()

    if env_priv and env_priv.startswith("-----BEGIN") and env_pub and env_pub.startswith("-----BEGIN"):
        _signing_key = env_priv
        _verify_key = env_pub
        return

    if _PRIVATE_KEY_FILE.exists() and _PUBLIC_KEY_FILE.exists():
        _signing_key = _PRIVATE_KEY_FILE.read_text()
        _verify_key = _PUBLIC_KEY_FILE.read_text()
        return

    _JWS_KEYS_DIR.mkdir(parents=True, exist_ok=True)
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend(),
    )
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()

    _PRIVATE_KEY_FILE.write_text(private_pem)
    _PUBLIC_KEY_FILE.write_text(public_pem)
    try:
        os.chmod(_PRIVATE_KEY_FILE, 0o600)
    except Exception:
        pass

    _signing_key = private_pem
    _verify_key = public_pem


def _signing_key_str() -> str:
    _ensure_keys()
    assert _signing_key is not None
    return _signing_key


def _verify_key_str() -> str:
    _ensure_keys()
    assert _verify_key is not None
    return _verify_key


def _base_claims(sub: str, audience: str, ttl: timedelta, token_type: str) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "sub": str(sub),
        "aud": audience,
        "iat": now,
        "nbf": now,
        "exp": now + ttl,
        "type": token_type,
        "jti": secrets.token_urlsafe(16),
    }


def create_access_token(
    admin_id: str,
    username: str,
    role: str,
    role_level: int,
    session_id: str | None = None,
) -> str:
    claims = _base_claims(admin_id, "access", ACCESS_TOKEN_TTL, "access")
    claims.update({
        "username": username,
        "role": role,
        "role_level": role_level,
    })
    if session_id:
        claims["sid"] = str(session_id)
    return jwt.encode(claims, _signing_key_str(), algorithm=ACCESS_ALGORITHM)


def verify_access_token(token: str) -> dict:
    try:
        claims = jwt.decode(
            token,
            _verify_key_str(),
            algorithms=[ACCESS_ALGORITHM],
            audience="access",
            options={"require": ["sub", "exp", "jti", "type"]},
        )
    except jwt.ExpiredSignatureError:
        raise TokenExpired()
    except InvalidTokenError:
        raise InvalidToken()
    if claims.get("type") != "access":
        raise InvalidToken()
    return claims


def _hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def create_refresh_token(
    admin_id: str,
    remember_me: bool = False,
    family: Optional[str] = None,
) -> tuple[str, str]:
    r = await get_redis()
    token = secrets.token_urlsafe(48)
    token_hash = _hash_refresh_token(token)
    family = family or secrets.token_urlsafe(16)

    ttl = REFRESH_TOKEN_TTL if remember_me else REFRESH_TOKEN_TTL_SHORT
    now = datetime.now(timezone.utc)
    expires_at = now + ttl

    pipe = r.pipeline()
    pipe.hset(f"refresh:{token_hash}", mapping={
        "user_id": str(admin_id),
        "family": family,
        "used": "0",
        "issued_at": int(now.timestamp()),
        "expires_at": int(expires_at.timestamp()),
    })
    pipe.expire(f"refresh:{token_hash}", int(ttl.total_seconds()))
    pipe.sadd(f"refresh_family:{family}", token_hash)
    pipe.expire(f"refresh_family:{family}", int(ttl.total_seconds()))
    await pipe.execute()

    return token, family


async def rotate_refresh_token(refresh_token: str) -> tuple[str, str]:
    r = await get_redis()
    token_hash = _hash_refresh_token(refresh_token)
    data = await r.hgetall(f"refresh:{token_hash}")
    if not data:
        raise InvalidToken()

    now = datetime.now(timezone.utc)
    expires_at = datetime.fromtimestamp(int(data["expires_at"]), tz=timezone.utc)
    if expires_at <= now:
        await r.delete(f"refresh:{token_hash}")
        raise TokenExpired()

    if data.get("used") == "1":
        await _revoke_family(r, data["family"])
        raise TokenReuseDetected()

    user_id = data["user_id"]
    family = data["family"]
    remember_me = (expires_at - datetime.fromtimestamp(int(data["issued_at"]), tz=timezone.utc)) > timedelta(hours=6)

    pipe = r.pipeline()
    pipe.hset(f"refresh:{token_hash}", "used", "1")
    pipe.expire(f"refresh:{token_hash}", 60)
    await pipe.execute()

    new_token, _ = await create_refresh_token(user_id, remember_me=remember_me, family=family)
    return new_token, user_id


async def _revoke_family(r, family: str) -> None:
    member_hashes = await r.smembers(f"refresh_family:{family}")
    for member_hash in member_hashes:
        await r.delete(f"refresh:{member_hash}")
    await r.delete(f"refresh_family:{family}")


async def revoke_refresh_token(refresh_token: str) -> None:
    r = await get_redis()
    token_hash = _hash_refresh_token(refresh_token)
    data = await r.hgetall(f"refresh:{token_hash}")
    if data:
        await _revoke_family(r, data["family"])


async def revoke_refresh_family(family: str) -> None:
    r = await get_redis()
    await _revoke_family(r, family)


async def revoke_all_refresh_tokens(admin_id: str) -> None:
    r = await get_redis()
    cursor = 0
    while True:
        cursor, keys = await r.scan(cursor=cursor, match="refresh:*", count=200)
        for key in keys:
            data = await r.hgetall(key)
            if data and data.get("user_id") == str(admin_id):
                await _revoke_family(r, data["family"])
        if cursor == 0:
            break


async def block_access_token_jti(jti: str, ttl_seconds: int = 900) -> None:
    r = await get_redis()
    await r.setex(f"access_block:{jti}", ttl_seconds, "1")


async def is_access_token_blocked(jti: str) -> bool:
    r = await get_redis()
    return await r.exists(f"access_block:{jti}") > 0


def create_ws_ticket(challenge_id: str) -> str:
    claims = _base_claims(challenge_id, "ws_auth", WS_TICKET_TTL, "ws_ticket")
    return jwt.encode(claims, _signing_key_str(), algorithm=ACCESS_ALGORITHM)


def verify_ws_ticket(ticket: str) -> dict:
    try:
        claims = jwt.decode(
            ticket,
            _verify_key_str(),
            algorithms=[ACCESS_ALGORITHM],
            audience="ws_auth",
            options={"require": ["sub", "exp", "jti", "type"]},
        )
    except jwt.ExpiredSignatureError:
        raise TokenExpired()
    except InvalidTokenError:
        raise InvalidToken()
    if claims.get("type") != "ws_ticket":
        raise InvalidToken()
    return claims


def create_exchange_code(admin_id: str) -> str:
    claims = _base_claims(admin_id, "auth_exchange", EXCHANGE_CODE_TTL, "exchange")
    return jwt.encode(claims, _signing_key_str(), algorithm=ACCESS_ALGORITHM)


def verify_exchange_code(code: str) -> dict:
    try:
        claims = jwt.decode(
            code,
            _verify_key_str(),
            algorithms=[ACCESS_ALGORITHM],
            audience="auth_exchange",
            options={"require": ["sub", "exp", "jti", "type"]},
        )
    except jwt.ExpiredSignatureError:
        raise TokenExpired()
    except InvalidTokenError:
        raise InvalidToken()
    if claims.get("type") != "exchange":
        raise InvalidToken()
    return claims


async def consume_exchange_code(code: str) -> str:
    r = await get_redis()
    jti = hashlib.sha256(code.encode()).hexdigest()
    key = f"auth:exchange:{jti}"
    if await r.set(key, "1", nx=True, ex=int(EXCHANGE_CODE_TTL.total_seconds())):
        return code
    raise InvalidToken()
