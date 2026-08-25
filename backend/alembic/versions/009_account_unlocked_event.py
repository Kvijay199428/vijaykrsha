"""009_account_unlocked_event - Security event type for manual account unlocks

- Extend securityeventtype enum with 'account_unlocked' so top-rank admins can
  manually revoke a failed-login suspension and leave an auditable trail.

Revision ID: 009_account_unlocked
Revises: 008_admin_username_case
Create Date: 2026-08-25
"""
from alembic import op

revision = "009_account_unlocked"
down_revision = "008_admin_username_case"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE securityeventtype ADD VALUE IF NOT EXISTS 'account_unlocked'")


def downgrade() -> None:
    pass
