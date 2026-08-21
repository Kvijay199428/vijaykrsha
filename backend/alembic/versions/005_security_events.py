"""005_security_events - Add security_events table

Revision ID: 005_security_events
Revises: 004_trusted_devices
Create Date: 2026-08-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, INET, JSONB

revision = "005_security_events"
down_revision = "004_trusted_devices"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TYPE securityeventtype AS ENUM (
            'login_success', 'login_failure', 'login_lockout',
            'otp_failure', 'otp_rate_limit', 'totp_failure',
            'new_device', 'device_trusted', 'device_revoked', 'device_blocked',
            'session_created', 'session_revoked',
            'rate_limited', 'bot_suspected', 'suspicious_request', 'account_locked'
        )
    """)

    op.execute("""
        CREATE TYPE securityseverity AS ENUM (
            'low', 'medium', 'high', 'critical'
        )
    """)

    op.execute("""
        CREATE TABLE security_events (
            id BIGSERIAL PRIMARY KEY,
            event_type securityeventtype NOT NULL,
            severity securityseverity NOT NULL DEFAULT 'low',
            admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
            session_id UUID REFERENCES admin_sessions(id) ON DELETE SET NULL,
            device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
            ip_address INET,
            user_agent TEXT,
            path TEXT,
            method VARCHAR(8),
            risk_score INTEGER NOT NULL DEFAULT 0,
            reason TEXT,
            metadata JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    op.execute("CREATE INDEX idx_security_events_type ON security_events(event_type)")
    op.execute("CREATE INDEX idx_security_events_admin ON security_events(admin_id)")
    op.execute("CREATE INDEX idx_security_events_ip ON security_events(ip_address)")
    op.execute("CREATE INDEX idx_security_events_created ON security_events(created_at)")
    op.execute("CREATE INDEX idx_security_events_type_created ON security_events(event_type, created_at)")


def downgrade() -> None:
    op.drop_table("security_events")
    op.execute("DROP TYPE securityseverity")
    op.execute("DROP TYPE securityeventtype")
