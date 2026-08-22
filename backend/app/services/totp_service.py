import io
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import pyotp
from app.config import get_settings

settings = get_settings()

PENDING_TOTP_TTL_SECONDS = 600


def _derive_key() -> bytes:
    password = settings.TOTP_ENCRYPTION_KEY.encode()
    salt = b"vijaykrsha-totp-salt-v1"
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=480000,
    )
    return base64.urlsafe_b64encode(kdf.derive(password))


_fernet = Fernet(_derive_key())


def generate_secret() -> str:
    return pyotp.random_base32()


def encrypt_secret(secret: str) -> bytes:
    return _fernet.encrypt(secret.encode())


def decrypt_secret(ciphertext: bytes) -> str:
    return _fernet.decrypt(ciphertext).decode()


def verify_totp(secret: str, code: str) -> bool:
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)


def get_provisioning_uri(secret: str, username: str) -> str:
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=username, issuer_name="vijaykrsha.online")


def _pending_key(admin_id: str) -> str:
    return f"totp_pending:{admin_id}"


async def store_pending_secret(admin_id: str, secret: str) -> None:
    """Store the enrollment secret server-side (encrypted, short TTL).

    The client never round-trips the secret back on enable; only the code.
    """
    from app.security.rate_limit import get_redis
    r = await get_redis()
    ciphertext = encrypt_secret(secret).decode()
    await r.setex(_pending_key(admin_id), PENDING_TOTP_TTL_SECONDS, ciphertext)


async def get_pending_secret(admin_id: str) -> str | None:
    from app.security.rate_limit import get_redis
    r = await get_redis()
    val = await r.get(_pending_key(admin_id))
    if not val:
        return None
    return decrypt_secret(val.encode())


async def clear_pending_secret(admin_id: str) -> None:
    from app.security.rate_limit import get_redis
    r = await get_redis()
    await r.delete(_pending_key(admin_id))
