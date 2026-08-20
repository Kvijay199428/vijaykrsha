import time
from collections import defaultdict


class RateLimiter:
    def __init__(self, max_requests: int = 10, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window = window_seconds
        self._buckets: dict[str, list[float]] = defaultdict(list)

    def _cleanup(self, key: str) -> None:
        now = time.time()
        self._buckets[key] = [
            t for t in self._buckets[key] if now - t < self.window
        ]

    def check(self, key: str) -> tuple[bool, float]:
        self._cleanup(key)
        now = time.time()
        attempts = self._buckets[key]
        if len(attempts) >= self.max_requests:
            oldest = attempts[0]
            retry_after = self.window - (now - oldest)
            return False, max(retry_after, 1.0)
        return True, 0.0

    def record(self, key: str) -> None:
        self._buckets[key].append(time.time())


otp_limiter = RateLimiter(max_requests=5, window_seconds=300)
login_limiter = RateLimiter(max_requests=10, window_seconds=60)
