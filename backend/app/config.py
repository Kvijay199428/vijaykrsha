from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

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
    MAX_ATTACHMENT_BYTES: int = 10_485_760

    SESSION_SECRET: str = "change-me-in-production"
    SESSION_IDLE_MINUTES: int = 30
    SESSION_ABSOLUTE_HOURS: int = 12

    CORS_ORIGINS: str = "https://vijaykrsha.online,https://vijaykrsha-website.pages.dev"

    OTP_PEPPER: str = "vijaykrsha-otp-pepper-change-me"
    MAX_LOGIN_ATTEMPTS: int = 5
    LOCKOUT_MINUTES: int = 15

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
