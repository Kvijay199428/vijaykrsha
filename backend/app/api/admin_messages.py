from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, update, desc, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.models import (
    ContactMessage, MessageStatus, MessagePriority, MessageNote,
    AuditEvent, AuditLog, MessageTag, ContactMessageTag, AdminUser,
)
from app.api.deps import require_permission
from app.models_rbac import Permission

router = APIRouter(prefix="/admin/api/messages", tags=["messages"])


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
    stmt = select(ContactMessage)
    count_stmt = select(func.count(ContactMessage.id))

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

    if not msg.first_viewed_at:
        msg.first_viewed_at = datetime.now(timezone.utc)
        await db.commit()

    notes = (await db.execute(
        select(MessageNote).where(MessageNote.message_id == msg.id).order_by(MessageNote.created_at)
    )).scalars().all()

    tags = (await db.execute(
        select(MessageTag).join(ContactMessageTag).where(ContactMessageTag.message_id == msg.id)
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
    }


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


def _audit(db: AsyncSession, event: AuditEvent, admin_id=None, message_id=None, target_admin_id=None):
    db.add(AuditLog(
        event=event,
        actor_admin_id=admin_id,
        target_message_id=message_id,
        target_admin_id=target_admin_id,
    ))
