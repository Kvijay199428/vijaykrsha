from uuid import UUID

from app.api.admin_messages import _audit as messages_audit
from app.api.admin_trash import _audit as trash_audit
from app.models import AuditEvent

_ADMIN_ID = UUID("11111111-1111-1111-1111-111111111111")
_MESSAGE_ID = UUID("a8f49d46-c9b2-4c78-ab2c-a3a360f7d673")


class RecordingSession:
    def __init__(self):
        self.added = []

    def add(self, obj):
        self.added.append(obj)


def test_trash_audit_writes_meta_into_metadata_column():
    """Regression: the message_trashed metadata dict must go to audit_logs.metadata,
    not audit_logs.target_admin_id (a UUID FK). Passing a dict there previously
    raised ValueError during flush -> 500 on POST /messages/{id}/trash."""
    db = RecordingSession()
    meta = {"retention_days": 30, "trash_expires_at": "2028-08-27T00:00:00+00:00"}
    messages_audit(
        db,
        AuditEvent.message_trashed,
        admin_id=_ADMIN_ID,
        message_id=_MESSAGE_ID,
        meta=meta,
    )
    assert len(db.added) == 1
    entry = db.added[0]
    assert entry.metadata_ == meta
    assert entry.target_message_id == _MESSAGE_ID
    assert entry.target_admin_id is None


def test_messages_audit_omits_meta_uses_empty_dict():
    db = RecordingSession()
    messages_audit(
        db,
        AuditEvent.message_restored,
        admin_id=_ADMIN_ID,
        message_id=_MESSAGE_ID,
    )
    entry = db.added[0]
    assert entry.metadata_ == {}
    assert entry.target_admin_id is None


def test_messages_audit_never_stores_dict_in_target_admin_id():
    for meta in ({"count": 3}, None):
        db = RecordingSession()
        messages_audit(
            db,
            AuditEvent.message_trashed,
            admin_id=_ADMIN_ID,
            message_id=_MESSAGE_ID,
            meta=meta,
        )
        assert isinstance(db.added[0].target_admin_id, UUID) is False
        assert isinstance(db.added[0].metadata_, dict)


def test_trash_router_audit_writes_meta():
    db = RecordingSession()
    meta = {"count": 4, "source": "empty_trash"}
    trash_audit(
        db,
        AuditEvent.message_permanently_deleted,
        admin_id=_ADMIN_ID,
        meta=meta,
    )
    entry = db.added[0]
    assert entry.metadata_ == meta
    assert entry.target_admin_id is None