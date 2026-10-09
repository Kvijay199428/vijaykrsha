from pydantic_settings import BaseSettings
from functools import lru_cache
from pydantic import model_validator

import json


_INSECURE_DEFAULTS = frozenset({
    "",
    "change-me-in-production",
    "change-me",
    "changeme",
    "secret",
    "totp_encryption_key",
})

from pathlib import Path

_JWS_PRIVATE_FILENAME = "jws_private.pem"
_JWS_PUBLIC_FILENAME = "jws_public.pem"
_TURNSTILE_KEYS_FILENAME = "turnstile.json"


def _default_keys_dir() -> Path:
    # backend/app/config.py -> repo root -> .keys/
    return Path(__file__).resolve().parent.parent.parent / ".keys"


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

    # Cloudflare Turnstile (admin login CAPTCHA)
    TURNSTILE_ENABLED: bool = True
    TURNSTILE_SITE_KEY: str = ""
    TURNSTILE_SECRET_KEY: str = ""
    TURNSTILE_EXPECTED_ACTION: str = "admin_login"
    TURNSTILE_EXPECTED_HOSTNAMES: str = "vijaykrsha.online,www.vijaykrsha.online"
    # Public contact form CAPTCHA. Kept separate from TURNSTILE_ENABLED so the
    # lead form and admin login can be enforced independently. Uses its own
    # widget/action (see TURNSTILE_CONTACT_ACTION) so a token minted for one
    # form cannot be replayed against the other.
    #
    # Each Turnstile widget has its OWN secret, and siteverify rejects a token
    # verified with the wrong one — so these two secrets must never be set to
    # the same value.
    TURNSTILE_CONTACT_REQUIRED: bool = True
    TURNSTILE_CONTACT_ACTION: str = "contact_form"
    # Env override for the contact widget secret. When empty (the default)
    # the secret comes from .keys/turnstile.json instead — see
    # turnstile_secret_for(). Same env-first-then-.keys/ precedence as
    # JWT_SIGNING_PRIVATE_KEY -> .keys/jws_private.pem.
    TURNSTILE_CONTACT_SECRET_KEY: str = ""

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

    # JWT / token rotation
    JWT_SIGNING_PRIVATE_KEY: str = ""
    JWT_SIGNING_PUBLIC_KEY: str = ""
    JWT_ACCESS_TTL_MINUTES: int = 15
    JWT_REFRESH_TTL_DAYS: int = 7
    # Directory holding jws_private.pem/jws_public.pem. Empty → repo-root/.keys/.
    # In docker set KEYS_DIR=/app/.keys and bind-mount ./.keys there.
    KEYS_DIR: str = ""

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
        if not self.JWT_SIGNING_PRIVATE_KEY and not self.JWT_SIGNING_PUBLIC_KEY:
            keys_dir = self.keys_dir_path
            if not (
                (keys_dir / _JWS_PRIVATE_FILENAME).exists()
                and (keys_dir / _JWS_PUBLIC_FILENAME).exists()
            ):
                insecure.append(
                    "JWT_SIGNING_PRIVATE_KEY/JWT_SIGNING_PUBLIC_KEY (neither set, "
                    f"and no persisted PEM pair under {keys_dir})"
                )
        elif (
            not self.JWT_SIGNING_PRIVATE_KEY.startswith("-----BEGIN")
            or not self.JWT_SIGNING_PUBLIC_KEY.startswith("-----BEGIN")
        ):
            insecure.append(
                "JWT_SIGNING_PRIVATE_KEY/JWT_SIGNING_PUBLIC_KEY (set but not valid PEM; "
                "generate real keys, not placeholders)"
            )
        # Cloudflare Turnstile verification is fail-closed: an empty secret
        # does not degrade, it makes every login and contact submission
        # return 403. Refuse to boot so this surfaces as a startup error
        # instead of "the container looks healthy but nobody can log in".
        registry = self.keys_dir_path / _TURNSTILE_KEYS_FILENAME
        for label, required, action in (
            (
                "TURNSTILE_SECRET_KEY",
                self.TURNSTILE_ENABLED,
                self.TURNSTILE_EXPECTED_ACTION,
            ),
            (
                "TURNSTILE_CONTACT_SECRET_KEY",
                self.TURNSTILE_CONTACT_REQUIRED,
                self.TURNSTILE_CONTACT_ACTION,
            ),
        ):
            if required and not self.turnstile_secret_for(action):
                insecure.append(
                    f"{label}: no secret resolves for action '{action}' "
                    f"(set {label} in the environment or add the entry to {registry})"
                )
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
    def keys_dir_path(self) -> Path:
        if self.KEYS_DIR:
            return Path(self.KEYS_DIR)
        return _default_keys_dir()

    def _turnstile_registry(self) -> dict:
        """Read .keys/turnstile.json. Missing, unreadable or malformed yields
        {} — every caller already treats an empty secret as fail-closed, and
        the production guard below surfaces it as a startup error rather than
        a silently-broken 403 later."""
        try:
            raw = (
                self.keys_dir_path / _TURNSTILE_KEYS_FILENAME
            ).read_text(encoding="utf-8")
        except OSError:
            return {}
        try:
            data = json.loads(raw)
        except ValueError:
            return {}
        return data if isinstance(data, dict) else {}

    def turnstile_secret_for(self, action: str) -> str:
        """Resolve the Cloudflare Turnstile secret for one widget action.

        Env vars win (explicit overrides), then .keys/turnstile.json — the
        same precedence as JWT_SIGNING_PRIVATE_KEY -> .keys/jws_private.pem.

        Two widgets means two distinct secrets: siteverify returns
        success=false when the secret does not match the widget that minted
        the token, so resolving this correctly is load-bearing — getting it
        wrong rejects every submission on that form.
        """
        if action == self.TURNSTILE_EXPECTED_ACTION and self.TURNSTILE_SECRET_KEY:
            return self.TURNSTILE_SECRET_KEY
        if action == self.TURNSTILE_CONTACT_ACTION and self.TURNSTILE_CONTACT_SECRET_KEY:
            return self.TURNSTILE_CONTACT_SECRET_KEY
        entry = self._turnstile_registry().get(action)
        if isinstance(entry, dict):
            secret = entry.get("secret_key")
            if isinstance(secret, str):
                return secret.strip()
        return ""

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
