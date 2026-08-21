"""004_trusted_devices - Add trusted_devices table

Revision ID: 004_trusted_devices
Revises: 003_security_devices
Create Date: 2026-08-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, INET

revision = "004_trusted_devices"
down_revision = "003_security_devices"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE trusted_devices (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE UNIQUE,
            admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
            trust_hash VARCHAR(64) NOT NULL UNIQUE,
            trusted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            last_used_at TIMESTAMPTZ,
            ip_address INET,
            user_agent TEXT,
            expires_at TIMESTAMPTZ NOT NULL,
            revoked_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    op.execute("CREATE INDEX idx_trusted_devices_admin ON trusted_devices(admin_id)")


def downgrade() -> None:
    op.drop_table("trusted_devices")
