"""010_trash_lifecycle - Trash soft-delete system

- Add deleted_at, trash_expires_at, deleted_by columns to contact_messages
- Add trash_retention_days column to admin_settings (default 30)
- Add partial indexes for efficient trash listing and cleanup queries

Revision ID: 010_trash_lifecycle
Revises: 009_account_unlocked
Create Date: 2026-08-25
"""
from alembic import op
import sqlalchemy as sa

revision = "010_trash_lifecycle"
down_revision = "009_account_unlocked"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Trash columns on contact_messages
    op.add_column("contact_messages", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("contact_messages", sa.Column("trash_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("contact_messages", sa.Column("deleted_by", sa.dialects.postgresql.UUID(as_uuid=True),
                                                 sa.ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True))

    # Indexes for trash queries
    op.execute(
        "CREATE INDEX idx_messages_deleted_at ON contact_messages (deleted_at) WHERE deleted_at IS NOT NULL"
    )
    op.execute(
        "CREATE INDEX idx_messages_trash_expires ON contact_messages (trash_expires_at) WHERE trash_expires_at IS NOT NULL"
    )

    # Retention setting
    op.add_column("admin_settings", sa.Column("trash_retention_days", sa.Integer, nullable=False, server_default="30"))


def downgrade() -> None:
    op.drop_column("admin_settings", "trash_retention_days")
    op.drop_index("idx_messages_trash_expires", table_name="contact_messages")
    op.drop_index("idx_messages_deleted_at", table_name="contact_messages")
    op.drop_column("contact_messages", "deleted_by")
    op.drop_column("contact_messages", "trash_expires_at")
    op.drop_column("contact_messages", "deleted_at")
