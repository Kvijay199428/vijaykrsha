"""initial schema

Revision ID: 001_initial
Revises:
Create Date: 2026-08-19
"""
from alembic import op

revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS citext")

    enums = [
        ("adminrole", "'owner', 'admin', 'operator', 'viewer'"),
        ("adminstatus", "'active', 'suspended', 'disabled', 'pending'"),
        ("messagestatus", "'new', 'in_progress', 'waiting', 'resolved', 'spam', 'archived'"),
        ("messagepriority", "'low', 'normal', 'high', 'urgent'"),
        ("messagechannel", "'contact_form', 'email', 'phone', 'whatsapp', 'telegram', 'other'"),
        ("otppurpose", "'login', 'password_reset', 'admin_action'"),
        ("otpdelivery", "'telegram', 'email'"),
        ("auditevent", "'login_success', 'login_failure', 'logout', 'otp_sent', 'otp_verified', 'totp_verified', 'message_viewed', 'message_updated', 'message_deleted', 'settings_updated', 'admin_created', 'admin_updated', 'admin_disabled', 'password_changed', 'totp_enabled', 'totp_disabled'"),
    ]
    for name, values in enums:
        op.execute(f"DO $$ BEGIN CREATE TYPE {name} AS ENUM ({values}); EXCEPTION WHEN duplicate_object THEN null; END $$")

    op.execute("""
        CREATE TABLE IF NOT EXISTS admin_users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            username CITEXT NOT NULL UNIQUE,
            email CITEXT UNIQUE,
            display_name VARCHAR(160) NOT NULL,
            password_hash TEXT NOT NULL,
            role adminrole NOT NULL DEFAULT 'admin',
            status adminstatus NOT NULL DEFAULT 'active',
            telegram_chat_id TEXT,
            telegram_username VARCHAR(64),
            totp_enabled BOOLEAN NOT NULL DEFAULT false,
            totp_secret_ciphertext BYTEA,
            totp_enabled_at TIMESTAMPTZ,
            last_login_at TIMESTAMPTZ,
            password_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            failed_login_count INTEGER NOT NULL DEFAULT 0,
            locked_until TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users (username)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS admin_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
            session_hash VARCHAR(64) NOT NULL UNIQUE,
            ip_address INET,
            user_agent TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            expires_at TIMESTAMPTZ NOT NULL,
            revoked_at TIMESTAMPTZ
        )
    """)
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_hash ON admin_sessions (session_hash)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_sessions_admin ON admin_sessions (admin_id, revoked_at, expires_at)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS auth_challenges (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
            challenge_hash VARCHAR(64) NOT NULL UNIQUE,
            otp_hash VARCHAR(64),
            otp_delivery otpdelivery,
            otp_purpose otppurpose NOT NULL DEFAULT 'login',
            telegram_message_id BIGINT,
            otp_attempts INTEGER NOT NULL DEFAULT 0,
            totp_attempts INTEGER NOT NULL DEFAULT 0,
            expires_at TIMESTAMPTZ NOT NULL,
            otp_verified_at TIMESTAMPTZ,
            totp_verified_at TIMESTAMPTZ,
            consumed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_challenges_hash ON auth_challenges (challenge_hash)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS website_users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(160),
            email CITEXT,
            phone VARCHAR(32),
            organization VARCHAR(160),
            country_code VARCHAR(2),
            first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            message_count INTEGER NOT NULL DEFAULT 0,
            is_blocked BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_website_users_email ON website_users (email)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS contact_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            public_reference VARCHAR(24) NOT NULL UNIQUE,
            website_user_id UUID REFERENCES website_users(id) ON DELETE SET NULL,
            channel messagechannel NOT NULL DEFAULT 'contact_form',
            status messagestatus NOT NULL DEFAULT 'new',
            priority messagepriority NOT NULL DEFAULT 'normal',
            subject VARCHAR(240),
            body TEXT NOT NULL,
            sender_name VARCHAR(160),
            sender_email CITEXT,
            sender_phone VARCHAR(32),
            source_page VARCHAR(500),
            ip_address INET,
            user_agent TEXT,
            assigned_to UUID REFERENCES admin_users(id) ON DELETE SET NULL,
            first_viewed_at TIMESTAMPTZ,
            resolved_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_ref ON contact_messages (public_reference)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_messages_created ON contact_messages (created_at)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_messages_status_priority ON contact_messages (status, priority, created_at)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_messages_assigned ON contact_messages (assigned_to, status)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS message_attachments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            message_id UUID NOT NULL REFERENCES contact_messages(id) ON DELETE CASCADE,
            object_key TEXT NOT NULL UNIQUE,
            original_filename VARCHAR(255) NOT NULL,
            content_type VARCHAR(160) NOT NULL,
            size_bytes BIGINT NOT NULL,
            sha256_hex VARCHAR(64) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS message_tags (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name CITEXT NOT NULL UNIQUE,
            color VARCHAR(32),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS contact_message_tags (
            message_id UUID NOT NULL REFERENCES contact_messages(id) ON DELETE CASCADE,
            tag_id UUID NOT NULL REFERENCES message_tags(id) ON DELETE CASCADE,
            PRIMARY KEY (message_id, tag_id)
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS message_notes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            message_id UUID NOT NULL REFERENCES contact_messages(id) ON DELETE CASCADE,
            author_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
            body TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS admin_settings (
            id SMALLINT PRIMARY KEY DEFAULT 1,
            telegram_otp_required BOOLEAN NOT NULL DEFAULT true,
            default_totp_enabled BOOLEAN NOT NULL DEFAULT false,
            otp_length SMALLINT NOT NULL DEFAULT 6,
            otp_ttl_seconds INTEGER NOT NULL DEFAULT 300,
            otp_resend_seconds INTEGER NOT NULL DEFAULT 60,
            max_login_attempts SMALLINT NOT NULL DEFAULT 5,
            session_idle_minutes INTEGER NOT NULL DEFAULT 30,
            updated_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS audit_logs (
            id BIGSERIAL PRIMARY KEY,
            event auditevent NOT NULL,
            actor_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
            target_message_id UUID REFERENCES contact_messages(id) ON DELETE SET NULL,
            target_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
            ip_address INET,
            user_agent TEXT,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at)")


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("admin_settings")
    op.drop_table("message_notes")
    op.drop_table("contact_message_tags")
    op.drop_table("message_tags")
    op.drop_table("message_attachments")
    op.drop_table("contact_messages")
    op.drop_table("website_users")
    op.drop_table("auth_challenges")
    op.drop_table("admin_sessions")
    op.drop_table("admin_users")

    for name in ["auditevent", "otpdelivery", "otppurpose", "messagechannel", "messagepriority", "messagestatus", "adminstatus", "adminrole"]:
        op.execute(f"DROP TYPE IF EXISTS {name}")
