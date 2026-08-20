import io
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import pyotp
from app.config import get_settings

settings = get_settings()


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
