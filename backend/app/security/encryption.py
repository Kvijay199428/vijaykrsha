import uuid

from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.backends import default_backend

from app.config import get_settings
from app.security.rate_limit import get_redis

settings = get_settings()

ENCRYPTION_KEY_TTL = 300


async def new_encryption_keypair() -> tuple[str, str]:
    """Generate an ephemeral RSA-2048 key pair, store the private key in
    Redis, and return (key_id, public_key_pem)."""
    r = await get_redis()
    key_id = str(uuid.uuid4())

    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend(),
    )
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )

    await r.setex(f"auth:enc_key:{key_id}", ENCRYPTION_KEY_TTL, private_pem)
    return key_id, public_pem.decode()


async def decrypt_password(key_id: str, cipher_b64: str) -> str:
    """Retrieve the ephemeral private key and decrypt the RSA-OAEP payload.
    The key is deleted after a single use."""
    r = await get_redis()
    key = f"auth:enc_key:{key_id}"
    private_pem = await r.get(key)
    if not private_pem:
        raise ValueError("encryption_key_expired")
    await r.delete(key)

    import base64

    private_key = serialization.load_pem_private_key(
        private_pem.encode() if isinstance(private_pem, str) else private_pem,
        password=None,
        backend=default_backend(),
    )
    try:
        ciphertext = base64.b64decode(cipher_b64)
        plaintext = private_key.decrypt(
            ciphertext,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None,
            ),
        )
    except Exception:
        raise ValueError("password_decryption_failed")
    return plaintext.decode("utf-8")
