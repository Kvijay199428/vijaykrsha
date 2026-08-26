from pydantic_settings import BaseSettings
from functools import lru_cache
from pydantic import model_validator


_INSECURE_DEFAULTS = frozenset({
    "",
    "change-me-in-production",
    "change-me",
    "changeme",
    "secret",
    "totp_encryption_key",
})


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    PRODUCTION: bool = False

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@db:5432/vijaykrsha"

    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_ADMIN_CHAT_ID: str = ""
    TELEGRAM_OTP_ENABLED: bool = True
    TELEGRAM_OTP_TTL_SECONDS: int = 300
    TELEGRAM_OTP_RESEND_SECONDS: int = 60
    TELEGRAM_OTP_LENGTH: int = 6

    TOTP_ENCRYPTION_KEY: str = "change-me-in-production"
    S3_ENDPOINT: str = "http://storage:9000"
    S3_REGION: str = "us-east-1"
    S3_BUCKET: str = "vijaykrsha-private"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_USE_SSL: bool = False
    MAX_ATTACHMENT_BYTES: int = 26_214_400  # 25 MiB per file
    MAX_CONTACT_BODY_BYTES: int = 146_800_640  # 5 x 25 MiB + form overhead
    ALLOWED_ATTACHMENT_EXTENSIONS: str = (
        "pdf,doc,docx,xls,xlsx,csv,txt,png,jpg,jpeg,gif,webp"
    )

    SESSION_IDLE_MINUTES: int = 30
    SESSION_ABSOLUTE_HOURS: int = 12

    CORS_ORIGINS: str = "https://vijaykrsha.online,https://vijaykrsha-website.pages.dev"

    OTP_PEPPER: str = "vijaykrsha-otp-pepper-change-me"

    # Redis
    REDIS_URL: str = "redis://redis-prod:6379/0"

    # Rate limiting
    RATE_LIMIT_LOGIN_IP: int = 10
    RATE_LIMIT_LOGIN_IP_WINDOW: int = 60
    RATE_LIMIT_LOGIN_USER: int = 5
    RATE_LIMIT_LOGIN_USER_WINDOW: int = 600
    RATE_LIMIT_OTP_SEND: int = 3
    RATE_LIMIT_OTP_SEND_WINDOW: int = 600
    RATE_LIMIT_OTP_VERIFY: int = 5
    RATE_LIMIT_OTP_VERIFY_WINDOW: int = 600
    RATE_LIMIT_TOTP_VERIFY: int = 5
    RATE_LIMIT_TOTP_VERIFY_WINDOW: int = 300
    RATE_LIMIT_API_READ: int = 120
    RATE_LIMIT_API_READ_WINDOW: int = 60
    RATE_LIMIT_API_WRITE: int = 30
    RATE_LIMIT_API_WRITE_WINDOW: int = 60
    RATE_LIMIT_SETUP: int = 1
    RATE_LIMIT_SETUP_WINDOW: int = 600

    # Lockout
    MAX_LOGIN_ATTEMPTS: int = 5
    LOCKOUT_MINUTES: int = 30
    LOCKOUT_SHORT_SECONDS: int = 30
    LOCKOUT_SHORT_THRESHOLD: int = 3

    # Request validation
    MAX_JSON_BODY_KB: int = 64

    # Sessions
    MAX_CONCURRENT_SESSIONS: int = 5

    # Device trust
    MAX_TRUSTED_DEVICES: int = 5
    TRUST_EXPIRY_DAYS: int = 90

    # Risk scoring
    RISK_THRESHOLD_SUSPICIOUS: int = 30
    RISK_THRESHOLD_CHALLENGE: int = 50
    RISK_THRESHOLD_BLOCK_TEMP: int = 70
    RISK_THRESHOLD_BLOCK_PERM: int = 90

    @model_validator(mode="after")
    def check_insecure_defaults(self) -> "Settings":
        if not self.PRODUCTION:
            return self
        insecure: list[str] = []
        if self.TOTP_ENCRYPTION_KEY in _INSECURE_DEFAULTS:
            insecure.append("TOTP_ENCRYPTION_KEY")
        elif len(self.TOTP_ENCRYPTION_KEY) < 32:
            insecure.append("TOTP_ENCRYPTION_KEY (too short, need >= 32 chars)")
        if self.OTP_PEPPER in _INSECURE_DEFAULTS or self.OTP_PEPPER.startswith("vijaykrsha-otp-pepper"):
            insecure.append("OTP_PEPPER")
        elif len(self.OTP_PEPPER) < 24:
            insecure.append("OTP_PEPPER (too short, need >= 24 chars)")
        if self.S3_ACCESS_KEY == "minioadmin" or self.S3_SECRET_KEY == "minioadmin":
            insecure.append("S3_ACCESS_KEY/S3_SECRET_KEY (minioadmin default)")
        if insecure:
            raise RuntimeError(
                "Refusing to start in production with insecure defaults: "
                + "; ".join(insecure)
                + ". Generate strong values before setting PRODUCTION=true."
            )
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def cookie_secure(self) -> bool:
        return self.PRODUCTION

    @property
    def device_cookie_name(self) -> str:
        return "__Host-device" if self.PRODUCTION else "vks_device"

    @property
    def trusted_device_cookie_name(self) -> str:
        return "__Host-trusted-device" if self.PRODUCTION else "vks_trusted_device"

    @property
    def allowed_attachment_extensions(self) -> frozenset[str]:
        return frozenset(
            e.strip().lower() for e in self.ALLOWED_ATTACHMENT_EXTENSIONS.split(",") if e.strip()
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
