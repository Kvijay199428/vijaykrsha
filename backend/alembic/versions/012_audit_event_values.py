"""012_audit_event_values - Extend auditevent enum with trash/message lifecycle events

The application inserts these event labels in audit_logs.event, but the
PostgreSQL auditevent enum type was created in 001 and only extended with
role_created/role_deleted in 007. Inserting an unknown label raises a
DataError (invalid input value for enum auditevent), which surfaced as a
500 on POST /admin/api/messages/{id}/trash and the other message lifecycle
endpoints.

Revision ID: 012_audit_event_values
Revises: 011_pin_flag
Create Date: 2026-08-27
"""
from alembic import op

revision = "012_audit_event_values"
down_revision = "011_pin_flag"
branch_labels = None
depends_on = None

_NEW_AUDIT_EVENTS = [
    "message_tag_removed",
    "message_trashed",
    "message_restored",
    "message_permanently_deleted",
    "trash_retention_changed",
    "message_pinned",
    "message_unpinned",
    "message_flagged",
    "message_unflagged",
]


def upgrade() -> None:
    with op.get_context().autocommit_block():
        for label in _NEW_AUDIT_EVENTS:
            op.execute(
                f"ALTER TYPE auditevent ADD VALUE IF NOT EXISTS '{label}'"
            )


def downgrade() -> None:
    # PostgreSQL cannot remove a single enum value without recreating the
    # type. Downgrade is intentionally a no-op; the labels are harmless until
    # the type is dropped and rebuilt.
    pass