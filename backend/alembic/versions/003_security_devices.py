"""003_security_devices - Add devices table and device_id to sessions

Revision ID: 003_security_devices
Revises: 002_rbac
Create Date: 2026-08-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, INET

revision = "003_security_devices"
down_revision = "002_rbac"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TYPE devicestate AS ENUM (
            'unknown', 'verified', 'trusted', 'suspicious', 'blocked', 'revoked'
        )
    """)

    op.execute("""
        CREATE TABLE devices (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            device_hash VARCHAR(64) NOT NULL UNIQUE,
            admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
            first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            first_ip INET,
            last_ip INET,
            user_agent TEXT,
            browser_name VARCHAR(64),
            browser_version VARCHAR(32),
            os_name VARCHAR(64),
            os_version VARCHAR(32),
            device_type VARCHAR(32),
            country VARCHAR(2),
            state devicestate NOT NULL DEFAULT 'unknown',
            risk_score INTEGER NOT NULL DEFAULT 0,
            last_login_at TIMESTAMPTZ,
            last_activity_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    op.execute("CREATE INDEX idx_devices_admin ON devices(admin_id)")
    op.execute("CREATE INDEX idx_devices_hash ON devices(device_hash)")

    op.execute("""
        ALTER TABLE admin_sessions
        ADD COLUMN device_id UUID REFERENCES devices(id) ON DELETE SET NULL
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE admin_sessions DROP COLUMN device_id")
    op.drop_table("devices")
    op.execute("DROP TYPE devicestate")
