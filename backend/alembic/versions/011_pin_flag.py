"""011_pin_flag - Pin and flag columns on contact_messages

Revision ID: 011_pin_flag
Revises: 010_trash_lifecycle
Create Date: 2026-08-26
"""
from alembic import op
import sqlalchemy as sa

revision = "011_pin_flag"
down_revision = "010_trash_lifecycle"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("contact_messages", sa.Column("is_pinned", sa.Boolean, nullable=False, server_default="false"))
    op.add_column("contact_messages", sa.Column("pinned_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("contact_messages", sa.Column("pinned_by", sa.dialects.postgresql.UUID(as_uuid=True),
                                                  sa.ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True))
    op.add_column("contact_messages", sa.Column("is_flagged", sa.Boolean, nullable=False, server_default="false"))
    op.add_column("contact_messages", sa.Column("flagged_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("contact_messages", sa.Column("flagged_by", sa.dialects.postgresql.UUID(as_uuid=True),
                                                  sa.ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True))

    # Partial indexes for efficient inbox filtering
    op.execute(
        "CREATE INDEX idx_messages_pinned ON contact_messages (created_at DESC) WHERE is_pinned = true AND deleted_at IS NULL"
    )
    op.execute(
        "CREATE INDEX idx_messages_flagged ON contact_messages (created_at DESC) WHERE is_flagged = true AND deleted_at IS NULL"
    )


def downgrade() -> None:
    op.drop_index("idx_messages_flagged", if_exists=True)
    op.drop_index("idx_messages_pinned", if_exists=True)
    op.drop_column("contact_messages", "flagged_by")
    op.drop_column("contact_messages", "flagged_at")
    op.drop_column("contact_messages", "is_flagged")
    op.drop_column("contact_messages", "pinned_by")
    op.drop_column("contact_messages", "pinned_at")
    op.drop_column("contact_messages", "is_pinned")
