"""S3/MinIO storage for contact-message attachments.

The stack already ships a MinIO service (docker-compose: "storage") and boto3
is a declared dependency. Files are buffered in memory before upload — safe
because MAX_ATTACHMENT_BYTES caps each file at 25 MiB.
"""
import asyncio
import hashlib
import re
import uuid
from typing import Iterator, Tuple

import boto3
from botocore.client import Config as BotoConfig
from botocore.exceptions import ClientError

from app.config import get_settings

_DOWNLOAD_CHUNK = 64 * 1024


def sanitize_filename(name: str) -> str:
    """Reduce a client-supplied filename to a safe basename."""
    name = name.replace("\\", "/").split("/")[-1]
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._")
    return name[:120] or "file"


class StorageError(Exception):
    pass


class StorageService:
    def __init__(self):
        settings = get_settings()
        self._bucket = settings.S3_BUCKET
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT,
            region_name=settings.S3_REGION,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            use_ssl=settings.S3_USE_SSL,
            config=BotoConfig(signature_version="s3v4"),
        )

    # ── bucket bootstrap ────────────────────────────────────────────
    def _ensure_bucket_sync(self) -> None:
        try:
            self._client.head_bucket(Bucket=self._bucket)
        except ClientError:
            try:
                self._client.create_bucket(Bucket=self._bucket)
            except ClientError as exc:
                raise StorageError(f"cannot create bucket {self._bucket}: {exc}") from exc

    async def ensure_bucket(self) -> None:
        await asyncio.to_thread(self._ensure_bucket_sync)

    # ── upload ──────────────────────────────────────────────────────
    def _put_sync(self, object_key: str, data: bytes, content_type: str) -> None:
        try:
            self._client.put_object(
                Bucket=self._bucket,
                Key=object_key,
                Body=data,
                ContentType=content_type,
            )
        except ClientError as exc:
            raise StorageError(f"upload failed for {object_key}: {exc}") from exc

    async def upload_attachment(
        self, message_id: uuid.UUID, filename: str, content_type: str, data: bytes
    ) -> Tuple[str, int, str]:
        """Store bytes and return (object_key, size_bytes, sha256_hex)."""
        safe = sanitize_filename(filename)
        object_key = f"contact/{message_id}/{uuid.uuid4().hex}/{safe}"
        size = len(data)
        sha256 = hashlib.sha256(data).hexdigest()
        await asyncio.to_thread(self._put_sync, object_key, data, content_type or "application/octet-stream")
        return object_key, size, sha256

    # ── download ────────────────────────────────────────────────────
    def _get_sync(self, object_key: str):
        resp = self._client.get_object(Bucket=self._bucket, Key=object_key)
        return resp["Body"]

    async def open_attachment(self, object_key: str):
        """Return a chunk iterator over the stored object."""
        body = await asyncio.to_thread(self._get_sync, object_key)

        def _iter() -> Iterator[bytes]:
            while True:
                chunk = body.read(_DOWNLOAD_CHUNK)
                if not chunk:
                    break
                yield chunk

        # Return the running iterator — the bare generator function would
        # make StreamingResponse fail with "'function' object is not iterable"
        # after response headers were already sent (empty 200).
        return _iter()


_storage: StorageService | None = None


def get_storage() -> StorageService:
    global _storage
    if _storage is None:
        _storage = StorageService()
    return _storage
