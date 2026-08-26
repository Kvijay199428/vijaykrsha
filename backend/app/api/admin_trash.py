from uuid import UUID
from datetime import datetime, timezone, timedelta

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, desc, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import (
    ContactMessage, MessageAttachment, MessageNote, ContactMessageTag,
    MessageTag, AdminSetting, AuditEvent, AuditLog, AdminUser,
)
from app.api.deps import require_permission
from app.models_rbac import Permission
from app.services.storage_service import get_storage

logger = structlog.get_logger()
router = APIRouter(prefix="/admin/api/trash", tags=["trash"])


class BulkRequest(BaseModel):
    message_ids: list[UUID]


async def _get_retention_days(db: AsyncSession) -> int:
    result = await db.execute(select(AdminSetting).where(AdminSetting.id == 1))
    setting = result.scalar_one_or_none()
    return setting.trash_retention_days if setting else 30


async def _permanent_delete(db: AsyncSession, msg: ContactMessage) -> None:
    storage = get_storage()
    attachments = (await db.execute(
        select(MessageAttachment).where(MessageAttachment.message_id == msg.id)
    )).scalars().all()
    for att in attachments:
        try:
            await storage.delete_attachment(att.object_key)
        except Exception:
            logger.warning("attachment_delete_failed", attachment_id=str(att.id), object_key=att.object_key)
    await db.execute(
        update(ContactMessage).where(ContactMessage.id == msg.id).values(deleted_by=None)
    )
    for att in attachments:
        await db.delete(att)
    notes = (await db.execute(
        select(MessageNote).where(MessageNote.message_id == msg.id)
    )).scalars().all()
    for note in notes:
        await db.delete(note)
    await db.execute(
        update(ContactMessageTag).where(ContactMessageTag.message_id == msg.id).values()
    )
    await db.delete(msg)


def _audit(db: AsyncSession, event: AuditEvent, admin_id=None, message_id=None, meta=None):
    db.add(AuditLog(
        event=event,
        actor_admin_id=admin_id,
        target_message_id=message_id,
        metadata_=meta or {},
    ))


# ── List trash ───────────────────────────────────────────────────
@router.get("")
async def list_trash(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: str | None = None,
    expiry: str | None = None,
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ContactMessage).where(ContactMessage.deleted_at.isnot(None))
    count_stmt = select(func.count(ContactMessage.id)).where(ContactMessage.deleted_at.isnot(None))

    if search:
        pattern = f"%{search}%"
        from sqlalchemy import or_
        cond = or_(
            ContactMessage.sender_name.ilike(pattern),
            ContactMessage.sender_email.ilike(pattern),
            ContactMessage.subject.ilike(pattern),
            ContactMessage.public_reference.ilike(pattern),
        )
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)

    now = datetime.now(timezone.utc)
    if expiry == "7":
        stmt = stmt.where(ContactMessage.trash_expires_at <= now + timedelta(days=7))
        count_stmt = count_stmt.where(ContactMessage.trash_expires_at <= now + timedelta(days=7))
    elif expiry == "30":
        stmt = stmt.where(ContactMessage.trash_expires_at <= now + timedelta(days=30))
        count_stmt = count_stmt.where(ContactMessage.trash_expires_at <= now + timedelta(days=30))

    total = (await db.execute(count_stmt)).scalar()
    offset = (page - 1) * limit
    stmt = stmt.order_by(desc(ContactMessage.deleted_at)).offset(offset).limit(limit)
    result = await db.execute(stmt)
    messages = result.scalars().all()

    return {
        "items": [
            {
                "id": str(m.id),
                "reference": m.public_reference,
                "sender_name": m.sender_name,
                "sender_email": m.sender_email,
                "subject": m.subject,
                "deleted_at": m.deleted_at.isoformat() if m.deleted_at else None,
                "trash_expires_at": m.trash_expires_at.isoformat() if m.trash_expires_at else None,
                "deleted_by": str(m.deleted_by) if m.deleted_by else None,
            }
            for m in messages
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }


# ── Get trashed message detail ───────────────────────────────────
@router.get("/{message_id}")
async def get_trashed_message(
    message_id: UUID,
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    msg = (await db.execute(
        select(ContactMessage).where(ContactMessage.id == message_id)
    )).scalar_one_or_none()
    if not msg or not msg.deleted_at:
        raise HTTPException(404, "not_found")

    notes = (await db.execute(
        select(MessageNote).where(MessageNote.message_id == msg.id).order_by(MessageNote.created_at)
    )).scalars().all()

    tags = (await db.execute(
        select(MessageTag).join(ContactMessageTag).where(ContactMessageTag.message_id == msg.id)
    )).scalars().all()

    attachments = (await db.execute(
        select(MessageAttachment)
        .where(MessageAttachment.message_id == msg.id)
        .order_by(MessageAttachment.created_at)
    )).scalars().all()

    return {
        "id": str(msg.id),
        "reference": msg.public_reference,
        "sender_name": msg.sender_name,
        "sender_email": msg.sender_email,
        "sender_phone": msg.sender_phone,
        "subject": msg.subject,
        "body": msg.body,
        "status": msg.status,
        "priority": msg.priority,
        "channel": msg.channel,
        "source_page": msg.source_page,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
        "deleted_at": msg.deleted_at.isoformat() if msg.deleted_at else None,
        "trash_expires_at": msg.trash_expires_at.isoformat() if msg.trash_expires_at else None,
        "deleted_by": str(msg.deleted_by) if msg.deleted_by else None,
        "notes": [
            {
                "id": str(n.id),
                "body": n.body,
                "author_id": str(n.author_id),
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notes
        ],
        "tags": [{"id": str(t.id), "name": t.name, "color": t.color} for t in tags],
        "attachments": [
            {
                "id": str(a.id),
                "filename": a.original_filename,
                "url": f"/admin/api/messages/{msg.id}/attachments/{a.id}",
                "size": a.size_bytes,
                "content_type": a.content_type,
            }
            for a in attachments
        ],
    }


# ── Restore ──────────────────────────────────────────────────────
@router.post("/{message_id}/restore")
async def restore_message(
    message_id: UUID,
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_RESTORE)),
    db: AsyncSession = Depends(get_db),
):
    msg = (await db.execute(
        select(ContactMessage).where(ContactMessage.id == message_id)
    )).scalar_one_or_none()
    if not msg or not msg.deleted_at:
        raise HTTPException(404, "not_found")

    msg.deleted_at = None
    msg.trash_expires_at = None
    msg.deleted_by = None
    msg.updated_at = datetime.now(timezone.utc)

    _audit(db, AuditEvent.message_restored, admin.id, message_id)
    await db.commit()
    return {"status": "ok"}


# ── Permanent delete ─────────────────────────────────────────────
@router.delete("/{message_id}")
async def permanent_delete(
    message_id: UUID,
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_DELETE)),
    db: AsyncSession = Depends(get_db),
):
    msg = (await db.execute(
        select(ContactMessage).where(ContactMessage.id == message_id)
    )).scalar_one_or_none()
    if not msg:
        raise HTTPException(404, "not_found")

    await _permanent_delete(db, msg)
    _audit(db, AuditEvent.message_permanently_deleted, admin.id, message_id)
    await db.commit()
    return {"status": "ok"}


# ── Bulk restore ─────────────────────────────────────────────────
@router.post("/bulk/restore")
async def bulk_restore(
    body: BulkRequest,
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_RESTORE)),
    db: AsyncSession = Depends(get_db),
):
    restored = 0
    for mid in body.message_ids:
        msg = (await db.execute(
            select(ContactMessage).where(ContactMessage.id == mid)
        )).scalar_one_or_none()
        if msg and msg.deleted_at:
            msg.deleted_at = None
            msg.trash_expires_at = None
            msg.deleted_by = None
            msg.updated_at = datetime.now(timezone.utc)
            restored += 1

    if restored:
        _audit(db, AuditEvent.message_restored, admin.id, None, {"count": restored})
    await db.commit()
    return {"status": "ok", "restored": restored}


# ── Bulk permanent delete ────────────────────────────────────────
@router.post("/bulk/delete")
async def bulk_permanent_delete(
    body: BulkRequest,
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_DELETE)),
    db: AsyncSession = Depends(get_db),
):
    deleted = 0
    for mid in body.message_ids:
        msg = (await db.execute(
            select(ContactMessage).where(ContactMessage.id == mid)
        )).scalar_one_or_none()
        if msg:
            await _permanent_delete(db, msg)
            deleted += 1

    if deleted:
        _audit(db, AuditEvent.message_permanently_deleted, admin.id, None, {"count": deleted})
    await db.commit()
    return {"status": "ok", "deleted": deleted}


# ── Empty trash ──────────────────────────────────────────────────
@router.post("/empty")
async def empty_trash(
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_EMPTY_TRASH)),
    db: AsyncSession = Depends(get_db),
):
    messages = (await db.execute(
        select(ContactMessage).where(ContactMessage.deleted_at.isnot(None)).limit(500)
    )).scalars().all()

    count = 0
    for msg in messages:
        await _permanent_delete(db, msg)
        count += 1

    if count:
        _audit(db, AuditEvent.message_permanently_deleted, admin.id, None, {"count": count, "source": "empty_trash"})
    await db.commit()
    return {"status": "ok", "deleted": count}
