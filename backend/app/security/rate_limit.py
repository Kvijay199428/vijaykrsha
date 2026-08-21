import time
import hashlib
from typing import Optional
import redis.asyncio as redis
from app.config import get_settings

settings = get_settings()

_pool: Optional[redis.Redis] = None


async def get_redis() -> redis.Redis:
    global _pool
    if _pool is None:
        _pool = redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            max_connections=20,
        )
    return _pool


async def close_redis():
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None


def _prefix_key(scope: str, key: str) -> str:
    return f"rl:{scope}:{key}"


class RedisRateLimiter:
    def __init__(
        self,
        max_requests: int,
        window_seconds: int,
        scope: str = "global",
    ):
        self.max_requests = max_requests
        self.window = window_seconds
        self.scope = scope

    async def check_and_record(self, key: str) -> tuple[bool, float]:
        r = await get_redis()
        redis_key = _prefix_key(self.scope, key)
        now = time.time()
        window_start = now - self.window

        pipe = r.pipeline()
        pipe.zremrangebyscore(redis_key, 0, window_start)
        pipe.zadd(redis_key, {str(now): now})
        pipe.zcard(redis_key)
        pipe.expire(redis_key, self.window + 10)
        results = await pipe.execute()

        count = results[2]
        if count > self.max_requests:
            members = await r.zrange(redis_key, 0, 0, withscores=True)
            if members:
                oldest_time = members[0][1]
                retry_after = self.window - (now - oldest_time)
                return False, max(retry_after, 1.0)
            return False, float(self.window)

        return True, 0.0

    async def check(self, key: str) -> tuple[bool, float]:
        r = await get_redis()
        redis_key = _prefix_key(self.scope, key)
        now = time.time()
        window_start = now - self.window

        pipe = r.pipeline()
        pipe.zremrangebyscore(redis_key, 0, window_start)
        pipe.zcard(redis_key)
        results = await pipe.execute()

        count = results[1]
        if count >= self.max_requests:
            members = await r.zrange(redis_key, 0, 0, withscores=True)
            if members:
                oldest_time = members[0][1]
                retry_after = self.window - (now - oldest_time)
                return False, max(retry_after, 1.0)
            return False, float(self.window)

        return True, 0.0

    async def record(self, key: str) -> None:
        r = await get_redis()
        redis_key = _prefix_key(self.scope, key)
        now = time.time()
        pipe = r.pipeline()
        pipe.zadd(redis_key, {str(now): now})
        pipe.expire(redis_key, self.window + 10)
        await pipe.execute()


class RedisBlocklist:
    BLOCK_PREFIX = "block"

    @classmethod
    async def block(cls, identifier: str, ttl_seconds: int = 900) -> None:
        r = await get_redis()
        key = f"{cls.BLOCK_PREFIX}:{identifier}"
        await r.setex(key, ttl_seconds, "1")

    @classmethod
    async def is_blocked(cls, identifier: str) -> bool:
        r = await get_redis()
        key = f"{cls.BLOCK_PREFIX}:{identifier}"
        return await r.exists(key) > 0

    @classmethod
    async def unblock(cls, identifier: str) -> None:
        r = await get_redis()
        key = f"{cls.BLOCK_PREFIX}:{identifier}"
        await r.delete(key)

    @classmethod
    async def get_block_ttl(cls, identifier: str) -> int:
        r = await get_redis()
        key = f"{cls.BLOCK_PREFIX}:{identifier}"
        ttl = await r.ttl(key)
        return max(ttl, 0)


login_ip_limiter = RedisRateLimiter(
    max_requests=settings.RATE_LIMIT_LOGIN_IP,
    window_seconds=settings.RATE_LIMIT_LOGIN_IP_WINDOW,
    scope="login_ip",
)
login_user_limiter = RedisRateLimiter(
    max_requests=settings.RATE_LIMIT_LOGIN_USER,
    window_seconds=settings.RATE_LIMIT_LOGIN_USER_WINDOW,
    scope="login_user",
)
otp_send_limiter = RedisRateLimiter(
    max_requests=settings.RATE_LIMIT_OTP_SEND,
    window_seconds=settings.RATE_LIMIT_OTP_SEND_WINDOW,
    scope="otp_send",
)
otp_verify_limiter = RedisRateLimiter(
    max_requests=settings.RATE_LIMIT_OTP_VERIFY,
    window_seconds=settings.RATE_LIMIT_OTP_VERIFY_WINDOW,
    scope="otp_verify",
)
totp_verify_limiter = RedisRateLimiter(
    max_requests=settings.RATE_LIMIT_TOTP_VERIFY,
    window_seconds=settings.RATE_LIMIT_TOTP_VERIFY_WINDOW,
    scope="totp_verify",
)
api_read_limiter = RedisRateLimiter(
    max_requests=settings.RATE_LIMIT_API_READ,
    window_seconds=settings.RATE_LIMIT_API_READ_WINDOW,
    scope="api_read",
)
api_write_limiter = RedisRateLimiter(
    max_requests=settings.RATE_LIMIT_API_WRITE,
    window_seconds=settings.RATE_LIMIT_API_WRITE_WINDOW,
    scope="api_write",
)
setup_limiter = RedisRateLimiter(
    max_requests=settings.RATE_LIMIT_SETUP,
    window_seconds=settings.RATE_LIMIT_SETUP_WINDOW,
    scope="setup",
)
contact_limiter = RedisRateLimiter(
    max_requests=5,
    window_seconds=300,
    scope="contact",
)
