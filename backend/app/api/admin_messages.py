from uuid import UUID
from datetime import datetime, timezone
from urllib.parse import quote

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, func, update, desc, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import (
    ContactMessage, MessageStatus, MessagePriority, MessageNote,
    AuditEvent, AuditLog, MessageTag, ContactMessageTag, AdminUser,
    MessageAttachment,
)
from app.api.deps import require_permission
from app.models_rbac import Permission
from app.services.storage_service import get_storage

logger = structlog.get_logger()
router = APIRouter(prefix="/admin/api/messages", tags=["messages"])

# Content types that must never render inline in the admin browser context.
_HOSTILE_TYPES = ("text/html", "application/xhtml", "image/svg")


class MessageUpdate(BaseModel):
    status: MessageStatus | None = None
    priority: MessagePriority | None = None
    assigned_to: str | None = None


class NoteRequest(BaseModel):
    body: str


class TagRequest(BaseModel):
    tag_name: str


@router.get("")
async def list_messages(
    status: MessageStatus | None = None,
    priority: MessagePriority | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ContactMessage).where(ContactMessage.deleted_at.isnot(None) == False)  # noqa: E712
    count_stmt = select(func.count(ContactMessage.id)).where(ContactMessage.deleted_at.isnot(None) == False)  # noqa: E712

    if status:
        stmt = stmt.where(ContactMessage.status == status)
        count_stmt = count_stmt.where(ContactMessage.status == status)
    if priority:
        stmt = stmt.where(ContactMessage.priority == priority)
        count_stmt = count_stmt.where(ContactMessage.priority == priority)
    if search:
        pattern = f"%{search}%"
        cond = or_(
            ContactMessage.sender_name.ilike(pattern),
            ContactMessage.sender_email.ilike(pattern),
            ContactMessage.subject.ilike(pattern),
            ContactMessage.body.ilike(pattern),
            ContactMessage.public_reference.ilike(pattern),
        )
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)

    total = (await db.execute(count_stmt)).scalar()
    offset = (page - 1) * limit
    stmt = stmt.order_by(desc(ContactMessage.created_at)).offset(offset).limit(limit)
    result = await db.execute(stmt)
    messages = result.scalars().all()

    attachment_counts: dict = {}
    message_ids = [m.id for m in messages]
    if message_ids:
        rows = await db.execute(
            select(MessageAttachment.message_id, func.count(MessageAttachment.id))
            .where(MessageAttachment.message_id.in_(message_ids))
            .group_by(MessageAttachment.message_id)
        )
        attachment_counts = {mid: count for mid, count in rows.all()}

    return {
        "items": [
            {
                "id": str(m.id),
                "reference": m.public_reference,
                "sender_name": m.sender_name,
                "sender_email": m.sender_email,
                "subject": m.subject,
                "status": m.status,
                "priority": m.priority,
                "channel": m.channel,
                "created_at": m.created_at.isoformat() if m.created_at else None,
                "attachment_count": attachment_counts.get(m.id, 0),
            }
            for m in messages
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/{message_id}")
async def get_message(
    message_id: UUID,
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    msg = (await db.execute(
        select(ContactMessage).where(ContactMessage.id == message_id)
    )).scalar_one_or_none()
    if not msg:
        raise HTTPException(404, "not_found")

    if msg.deleted_at:
        return {
            **{k: None for k in ["notes", "tags", "attachments"]},
            "id": str(msg.id),
            "reference": msg.public_reference,
            "subject": msg.subject,
            "sender_name": msg.sender_name,
            "sender_email": msg.sender_email,
            "trashed": True,
            "deleted_at": msg.deleted_at.isoformat(),
        }

    if not msg.first_viewed_at:
        msg.first_viewed_at = datetime.now(timezone.utc)
        await db.commit()

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


@router.get("/{message_id}/attachments/{attachment_id}")
async def download_attachment(
    message_id: UUID,
    attachment_id: UUID,
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    att = (await db.execute(
        select(MessageAttachment).where(
            MessageAttachment.id == attachment_id,
            MessageAttachment.message_id == message_id,
        )
    )).scalar_one_or_none()
    if not att:
        raise HTTPException(404, "not_found")

    # Always download: browser preview of untrusted uploads is never useful
    # here, and a navigation to an inline body reads as a blank page.
    content_type = (att.content_type or "application/octet-stream").lower()
    if content_type.startswith(_HOSTILE_TYPES):
        content_type = "application/octet-stream"
    disposition = "attachment"

    ascii_name = att.original_filename.encode("ascii", "ignore").decode() or "download"
    quoted_name = quote(att.original_filename)

    storage = get_storage()
    try:
        chunk_iter = await storage.open_attachment(att.object_key)
    except Exception:
        logger.error("attachment_download_failed",
                     attachment_id=str(att.id), object_key=att.object_key)
        raise HTTPException(502, "storage_unavailable")

    return StreamingResponse(
        chunk_iter,
        media_type=content_type,
        headers={
            "Content-Disposition": (
                f'{disposition}; filename="{ascii_name}"; '
                f"filename*=UTF-8''{quoted_name}"
            ),
            "Cache-Control": "no-store",
        },
    )


@router.patch("/{message_id}")
async def update_message(
    message_id: UUID,
    body: MessageUpdate,
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_UPDATE)),
    db: AsyncSession = Depends(get_db),
):
    msg = (await db.execute(
        select(ContactMessage).where(ContactMessage.id == message_id)
    )).scalar_one_or_none()
    if not msg:
        raise HTTPException(404, "not_found")

    values = {}
    if body.status:
        values["status"] = body.status
        if body.status == MessageStatus.resolved:
            values["resolved_at"] = datetime.now(timezone.utc)
    if body.priority:
        values["priority"] = body.priority
    if body.assigned_to is not None:
        values["assigned_to"] = UUID(body.assigned_to) if body.assigned_to else None

    if values:
        values["updated_at"] = datetime.now(timezone.utc)
        await db.execute(
            update(ContactMessage).where(ContactMessage.id == message_id).values(**values)
        )

    _audit(db, AuditEvent.message_updated, admin.id, message_id, admin.id)
    await db.commit()

    return {"status": "ok"}


@router.delete("/{message_id}")
async def delete_message(
    message_id: UUID,
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_DELETE)),
    db: AsyncSession = Depends(get_db),
):
    msg = (await db.execute(
        select(ContactMessage).where(ContactMessage.id == message_id)
    )).scalar_one_or_none()
    if not msg:
        raise HTTPException(404, "not_found")

    msg.status = MessageStatus.archived
    msg.updated_at = datetime.now(timezone.utc)

    _audit(db, AuditEvent.message_deleted, admin.id, message_id, admin.id)
    await db.commit()
    return {"status": "ok"}


@router.post("/{message_id}/notes")
async def add_note(
    message_id: UUID,
    body: NoteRequest,
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_NOTES)),
    db: AsyncSession = Depends(get_db),
):
    msg = (await db.execute(
        select(ContactMessage).where(ContactMessage.id == message_id)
    )).scalar_one_or_none()
    if not msg:
        raise HTTPException(404, "not_found")

    note = MessageNote(
        message_id=message_id,
        author_id=admin.id,
        body=body.body,
    )
    db.add(note)
    await db.commit()

    return {
        "id": str(note.id),
        "body": note.body,
        "author_id": str(note.author_id),
        "created_at": note.created_at.isoformat() if note.created_at else None,
    }


@router.post("/{message_id}/tags")
async def add_tag(
    message_id: UUID,
    body: TagRequest,
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_TAGS)),
    db: AsyncSession = Depends(get_db),
):
    msg = (await db.execute(
        select(ContactMessage).where(ContactMessage.id == message_id)
    )).scalar_one_or_none()
    if not msg:
        raise HTTPException(404, "not_found")

    tag = (await db.execute(
        select(MessageTag).where(MessageTag.name == body.tag_name)
    )).scalar_one_or_none()
    if not tag:
        tag = MessageTag(name=body.tag_name)
        db.add(tag)
        await db.flush()

    existing = (await db.execute(
        select(ContactMessageTag).where(
            ContactMessageTag.message_id == message_id,
            ContactMessageTag.tag_id == tag.id,
        )
    )).scalar_one_or_none()
    if not existing:
        db.add(ContactMessageTag(message_id=message_id, tag_id=tag.id))
        await db.commit()

    return {"id": str(tag.id), "name": tag.name}


@router.delete("/{message_id}/tags/{tag_id}")
async def remove_tag(
    message_id: UUID,
    tag_id: UUID,
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_TAGS)),
    db: AsyncSession = Depends(get_db),
):
    msg = (await db.execute(
        select(ContactMessage).where(ContactMessage.id == message_id)
    )).scalar_one_or_none()
    if not msg:
        raise HTTPException(404, "not_found")

    link = (await db.execute(
        select(ContactMessageTag).where(
            ContactMessageTag.message_id == message_id,
            ContactMessageTag.tag_id == tag_id,
        )
    )).scalar_one_or_none()
    if not link:
        raise HTTPException(404, "tag_not_found")

    await db.delete(link)

    tag = (await db.execute(
        select(MessageTag).where(MessageTag.id == tag_id)
    )).scalar_one_or_none()
    if tag:
        usage = (await db.execute(
            select(func.count(ContactMessageTag.message_id))
            .where(ContactMessageTag.tag_id == tag_id)
        )).scalar()
        if usage == 0:
            await db.delete(tag)

    _audit(db, AuditEvent.message_tag_removed, admin.id, message_id, admin.id)
    await db.commit()
    return {"status": "ok"}


def _audit(db: AsyncSession, event: AuditEvent, admin_id=None, message_id=None, target_admin_id=None):
    db.add(AuditLog(
        event=event,
        actor_admin_id=admin_id,
        target_message_id=message_id,
        target_admin_id=target_admin_id,
    ))
