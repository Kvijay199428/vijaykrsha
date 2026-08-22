"""006_session_absolute_expiry - Persist absolute expiry on admin_sessions

Adds absolute_expires_at so the 12h (remember_me) / 2h hard wall survives
session touches, and so /auth/me can expose the true forced-logout time.

Revision ID: 006_session_absolute_expiry
Revises: 005_security_events
Create Date: 2026-08-22
"""
from alembic import op

revision = "006_session_absolute_expiry"
down_revision = "005_security_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE admin_sessions "
        "ADD COLUMN IF NOT EXISTS absolute_expires_at TIMESTAMPTZ"
    )
    # Backfill: existing sessions get the legacy 12h-from-created wall.
    op.execute(
        "UPDATE admin_sessions "
        "SET absolute_expires_at = created_at + INTERVAL '12 hours' "
        "WHERE absolute_expires_at IS NULL"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE admin_sessions DROP COLUMN IF EXISTS absolute_expires_at")
