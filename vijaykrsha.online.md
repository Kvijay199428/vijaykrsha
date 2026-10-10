```yaml
# File: .cloudflare\config.yml
ingress:
  - hostname: api.vijaykrsha.online
    service: http://localhost:8000
  - service: http_status:404
```

```
// File: .dockerignore
node_modules
dist
.git
.env
.env.local
*.md
.cloudflare
.wrangler
```

```
// File: .env.example
# Database
POSTGRES_PASSWORD=<generate-a-strong-random-password>
DATABASE_URL=postgresql+asyncpg://postgres:<same-password>@db:5432/vijaykrsha

# Telegram
TELEGRAM_BOT_TOKEN=<from-@BotFather-rotate-if-ever-committed>
TELEGRAM_ADMIN_CHAT_ID=<your-chat-id>

# Security
TOTP_ENCRYPTION_KEY=<run: python -c "import secrets; print(secrets.token_urlsafe(48))">
OTP_PEPPER=<run: python -c "import secrets; print(secrets.token_urlsafe(32))">
PRODUCTION=false
S3_ENDPOINT=http://storage:9000
S3_BUCKET=vijaykrsha-private

# CORS
CORS_ORIGINS=https://vijaykrsha.online,https://vijaykrsha-website.pages.dev

# Cloudflare Turnstile — BACKEND (secret keys never leave the server)
# Get both key pairs from Cloudflare Dashboard > Turnstile > your widget.
# Each widget has its OWN secret; siteverify rejects a token verified with the
# wrong one, so never reuse one secret for both forms.
#
# Default source is the gitignored registry at .keys/turnstile.json — these
# env vars are only needed to OVERRIDE that. Note TURNSTILE_SECRET_KEY is
# admin-scoped by name: setting it does not cover the contact form.
TURNSTILE_ENABLED=true
TURNSTILE_CONTACT_REQUIRED=true
# TURNSTILE_SECRET_KEY=<admin-login-widget-secret>
# TURNSTILE_CONTACT_SECRET_KEY=<contact-form-widget-secret>
TURNSTILE_EXPECTED_ACTION=admin_login
TURNSTILE_CONTACT_ACTION=contact_form
TURNSTILE_EXPECTED_HOSTNAMES=vijaykrsha.online,www.vijaykrsha.online

# Cloudflare Turnstile — FRONTEND (public site keys, safe to ship)
# Vite inlines these at BUILD time. The Dockerfile declares both as build args;
# `npm run build` on its own (the Cloudflare Pages path) reads them from .env.
# Both default to their real keys in src/lib/turnstile.ts, so these are only
# needed to point at a staging/preview widget.
VITE_TURNSTILE_SITE_KEY=0x4AAAAAAEYNYl20nw8S24aH
VITE_TURNSTILE_CONTACT_SITE_KEY=0x4AAAAAAFRKAxlycVCJSy__
```

```python
// File: backend\alembic\env.py
import asyncio
import os
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

db_url = os.environ.get("DATABASE_URL", config.get_main_option("sqlalchemy.url"))
config.set_main_option("sqlalchemy.url", db_url)

from app.models import Base
target_metadata = Base.metadata


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations():
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online():
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

```python
// File: backend\alembic\versions\001_initial_schema.py
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
```

```python
// File: backend\alembic\versions\002_rbac.py
"""002_rbac - Add RBAC tables and migrate existing roles

Revision ID: 002_rbac
Revises: 001_initial
Create Date: 2026-08-20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, CITEXT

revision = "002_rbac"
down_revision = "001_initial"
branch_labels = None
depends_on = None


# Seed data
ROLES = [
    ("owner", "Full system access", True),
    ("admin", "Administrative access", False),
    ("manager", "Message management", False),
    ("support", "Support agent", False),
    ("viewer", "Read-only access", False),
]

PERMISSIONS = [
    ("dashboard.view", "View dashboard", "dashboard"),
    ("messages.view", "View messages", "messages"),
    ("messages.update", "Update message status/priority", "messages"),
    ("messages.delete", "Delete messages", "messages"),
    ("messages.notes", "Add internal notes", "messages"),
    ("messages.tags", "Manage tags", "messages"),
    ("users.view", "View user list", "users"),
    ("users.create", "Create users", "users"),
    ("users.update", "Update user details", "users"),
    ("users.disable", "Disable/enable users", "users"),
    ("users.delete", "Delete users", "users"),
    ("users.reset_password", "Reset user passwords", "users"),
    ("users.manage_2fa", "Reset user TOTP", "users"),
    ("settings.view", "View settings", "settings"),
    ("settings.update", "Update settings", "settings"),
    ("audit_logs.view", "View audit logs", "audit"),
    ("roles.view", "View roles", "roles"),
    ("roles.manage", "Create/edit roles", "roles"),
]

ROLE_PERMS = {
    "owner": [p[0] for p in PERMISSIONS],
    "admin": [
        "dashboard.view",
        "messages.view", "messages.update", "messages.notes", "messages.tags",
        "users.view", "users.create", "users.update", "users.disable",
        "users.reset_password",
        "settings.view", "audit_logs.view",
    ],
    "manager": [
        "dashboard.view",
        "messages.view", "messages.update", "messages.notes", "messages.tags",
        "settings.view",
    ],
    "support": [
        "dashboard.view",
        "messages.view", "messages.update", "messages.notes",
    ],
    "viewer": [
        "dashboard.view",
        "messages.view",
    ],
}


def upgrade() -> None:
    # Create admin_roles
    op.execute("""
        CREATE TABLE admin_roles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(64) NOT NULL UNIQUE,
            description TEXT,
            is_system BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    # Create admin_permissions
    op.execute("""
        CREATE TABLE admin_permissions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            key VARCHAR(128) NOT NULL UNIQUE,
            description TEXT,
            category VARCHAR(64)
        )
    """)

    # Create admin_role_permissions
    op.execute("""
        CREATE TABLE admin_role_permissions (
            role_id UUID NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
            permission_id UUID NOT NULL REFERENCES admin_permissions(id) ON DELETE CASCADE,
            PRIMARY KEY (role_id, permission_id)
        )
    """)

    # Seed roles
    for name, desc, is_system in ROLES:
        op.execute(
            f"INSERT INTO admin_roles (name, description, is_system) VALUES ('{name}', '{desc}', {str(is_system).lower()})"
        )

    # Seed permissions
    for key, desc, cat in PERMISSIONS:
        op.execute(
            f"INSERT INTO admin_permissions (key, description, category) VALUES ('{key}', '{desc}', '{cat}')"
        )
    op.execute("CREATE INDEX idx_permissions_category ON admin_permissions(category)")

    # Seed role-permission mappings
    for role_name, perm_keys in ROLE_PERMS.items():
        for perm_key in perm_keys:
            op.execute(f"""
                INSERT INTO admin_role_permissions (role_id, permission_id)
                SELECT r.id, p.id
                FROM admin_roles r, admin_permissions p
                WHERE r.name = '{role_name}' AND p.key = '{perm_key}'
            """)

    # Add role_id to admin_users
    op.execute("ALTER TABLE admin_users ADD COLUMN role_id UUID REFERENCES admin_roles(id)")

    # Migrate existing role enum values to role_id
    op.execute("""
        UPDATE admin_users SET role_id = (
            SELECT id FROM admin_roles WHERE name = admin_users.role::text
        )
    """)

    # Make role_id NOT NULL
    op.execute("ALTER TABLE admin_users ALTER COLUMN role_id SET NOT NULL")


def downgrade() -> None:
    op.drop_table("admin_role_permissions")
    op.drop_table("admin_permissions")
    op.drop_table("admin_roles")
    op.drop_column("admin_users", "role_id")
```

```python
// File: backend\alembic\versions\003_security_devices.py
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
```

```python
// File: backend\alembic\versions\004_trusted_devices.py
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
```

```python
// File: backend\alembic\versions\005_security_events.py
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
```

```python
// File: backend\alembic\versions\006_session_absolute_expiry.py
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
```

```python
// File: backend\alembic\versions\007_role_varchar_levels.py
"""007_role_varchar_levels_creator - Support custom roles and created-by tracking

- Convert admin_users.role from PG enum (owner/admin/operator/viewer) to varchar(64)
  so RBAC roles (manager/support) and arbitrary custom roles can be stored.
- Add admin_roles.level for hierarchy enforcement.
- Grant roles.view/roles.manage to admin and manager.
- Add admin_users.created_by audit column.

Revision ID: 007_role_varchar_levels
Revises: 006_session_absolute_expiry
Create Date: 2026-08-22
"""
from alembic import op

revision = "007_role_varchar_levels"
down_revision = "006_session_absolute_expiry"
branch_labels = None
depends_on = None


ROLE_LEVELS = [
    ("owner", 100),
    ("admin", 80),
    ("manager", 60),
    ("support", 40),
    ("viewer", 20),
]

# Additional permission grants: admins manage custom roles, managers
# may view users and enable/disable those below their rank.
EXTRA_GRANTS = [
    ("admin", "roles.view"),
    ("admin", "roles.manage"),
    ("manager", "roles.view"),
    ("manager", "roles.manage"),
    ("manager", "users.view"),
    ("manager", "users.disable"),
]


def upgrade() -> None:
    # 0. Extend audit event enum for role CRUD events.
    # autocommit block: ADD VALUE is not allowed inside a transaction on PG < 12.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE auditevent ADD VALUE IF NOT EXISTS 'role_created'")
        op.execute("ALTER TYPE auditevent ADD VALUE IF NOT EXISTS 'role_deleted'")

    # 1. admin_users.role: PG enum -> varchar(64)
    op.execute("ALTER TABLE admin_users ALTER COLUMN role DROP DEFAULT")
    op.execute(
        "ALTER TABLE admin_users ALTER COLUMN role TYPE VARCHAR(64) "
        "USING role::text"
    )
    op.execute("ALTER TABLE admin_users ALTER COLUMN role SET DEFAULT 'admin'")

    # 2. Hierarchy level on roles
    op.execute(
        "ALTER TABLE admin_roles ADD COLUMN level INTEGER NOT NULL DEFAULT 40"
    )
    for name, level in ROLE_LEVELS:
        op.execute(
            f"UPDATE admin_roles SET level = {level} WHERE name = '{name}'"
        )

    # 3. Grant extra permissions to admin and manager (idempotent)
    for role_name, perm_key in EXTRA_GRANTS:
        op.execute(f"""
            INSERT INTO admin_role_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM admin_roles r, admin_permissions p
            WHERE r.name = '{role_name}' AND p.key = '{perm_key}'
            ON CONFLICT DO NOTHING
        """)

    # 4. Track who created each user
    op.execute(
        "ALTER TABLE admin_users ADD COLUMN created_by UUID "
        "REFERENCES admin_users(id)"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE admin_users DROP COLUMN IF EXISTS created_by")

    op.execute("""
        DELETE FROM admin_role_permissions arp
        USING admin_roles r, admin_permissions p
        WHERE arp.role_id = r.id
          AND arp.permission_id = p.id
          AND r.name IN ('admin', 'manager')
          AND p.key IN ('roles.view', 'roles.manage', 'users.view', 'users.disable')
    """)

    op.execute("ALTER TABLE admin_roles DROP COLUMN IF EXISTS level")

    # Restore enum column. Custom role names not in the enum fall back to 'viewer'.
    op.execute("ALTER TABLE admin_users ALTER COLUMN role DROP DEFAULT")
    op.execute("""
        ALTER TABLE admin_users ALTER COLUMN role TYPE adminrole
        USING CASE
            WHEN role::text IN ('owner', 'admin', 'operator', 'viewer')
            THEN role::adminrole
            ELSE 'viewer'::adminrole
        END
    """)
    op.execute("ALTER TABLE admin_users ALTER COLUMN role SET DEFAULT 'admin'")
```

```python
// File: backend\alembic\versions\008_admin_username_case.py
"""008_admin_username_case_sensitive - Enforce case-sensitive admin usernames

- Convert admin_users.username from CITEXT (case-insensitive compare) to
  VARCHAR(64). Login lookups, availability checks, and password-reset
  lookups all use `username == input`, so they become binary comparisons.
- Uniqueness likewise becomes case-sensitive: "Admin" and "admin" can no
  longer collide, and typing the wrong case no longer authenticates.

Passwords were always case-sensitive (argon2/bcrypt verify).

Revision ID: 008_admin_username_case
Revises: 007_role_varchar_levels
Create Date: 2026-08-24
"""
from alembic import op

revision = "008_admin_username_case"
down_revision = "007_role_varchar_levels"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE admin_users ALTER COLUMN username TYPE VARCHAR(64)
        USING username::varchar(64)
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE admin_users ALTER COLUMN username TYPE CITEXT
        USING username::citext
    """)
```

```python
// File: backend\alembic\versions\009_account_unlocked_event.py
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
```

```python
// File: backend\alembic\versions\010_trash_lifecycle.py
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
```

```python
// File: backend\alembic\versions\011_pin_flag.py
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
```

```python
// File: backend\alembic\versions\012_audit_event_values.py
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
```

```ini
# File: backend\alembic.ini
[alembic]
script_location = alembic
sqlalchemy.url = postgresql+asyncpg://postgres:postgres@localhost:5432/vijaykrsha

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
```

```python
// File: backend\app\__init__.py

```

```python
// File: backend\app\api\__init__.py

```

```python
// File: backend\app\api\admin_devices.py
from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.config import get_settings
from app.models import (
    AdminUser, Device, DeviceState, TrustedDevice,
    AuditEvent, AuditLog, AdminSession,
)
from app.api.deps import get_current_admin, require_permission
from app.models_rbac import Permission
from app.security.devices import (
    revoke_device, block_device, unblock_device,
    revoke_trust, log_security_event,
)
from app.security.rate_limit import RedisBlocklist
import structlog

logger = structlog.get_logger()
settings = get_settings()
router = APIRouter(prefix="/admin/api", tags=["devices"])


def _device_to_dict(device: Device, is_current: bool = False) -> dict:
    return {
        "id": str(device.id),
        "browser_name": device.browser_name,
        "browser_version": device.browser_version,
        "os_name": device.os_name,
        "os_version": device.os_version,
        "device_type": device.device_type,
        "first_ip": str(device.first_ip) if device.first_ip else None,
        "last_ip": str(device.last_ip) if device.last_ip else None,
        "state": device.state.value if hasattr(device.state, "value") else device.state,
        "risk_score": device.risk_score,
        "first_seen_at": device.first_seen_at.isoformat() if device.first_seen_at else None,
        "last_seen_at": device.last_seen_at.isoformat() if device.last_seen_at else None,
        "last_login_at": device.last_login_at.isoformat() if device.last_login_at else None,
        "last_activity_at": device.last_activity_at.isoformat() if device.last_activity_at else None,
        "is_current": is_current,
    }


def _trust_to_dict(trust: TrustedDevice) -> dict:
    return {
        "id": str(trust.id),
        "device_id": str(trust.device_id),
        "trusted_at": trust.trusted_at.isoformat() if trust.trusted_at else None,
        "last_used_at": trust.last_used_at.isoformat() if trust.last_used_at else None,
        "expires_at": trust.expires_at.isoformat() if trust.expires_at else None,
        "revoked_at": trust.revoked_at.isoformat() if trust.revoked_at else None,
        "ip_address": str(trust.ip_address) if trust.ip_address else None,
    }


@router.get("/devices")
async def list_devices(
    request: Request,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Device).where(Device.admin_id == admin.id).order_by(Device.last_seen_at.desc())
    result = await db.execute(stmt)
    devices = result.scalars().all()

    current_device_token = request.cookies.get(settings.device_cookie_name)
    current_device_id = None
    if current_device_token:
        import hashlib
        device_hash = hashlib.sha256(current_device_token.encode()).hexdigest()
        current = await db.execute(select(Device).where(Device.device_hash == device_hash))
        current_dev = current.scalar_one_or_none()
        if current_dev:
            current_device_id = current_dev.id

    items = []
    for d in devices:
        item = _device_to_dict(d, is_current=d.id == current_device_id)
        trust_stmt = select(TrustedDevice).where(
            TrustedDevice.device_id == d.id,
            TrustedDevice.revoked_at.is_(None),
            TrustedDevice.expires_at > datetime.now(timezone.utc),
        )
        trust_result = await db.execute(trust_stmt)
        trust = trust_result.scalar_one_or_none()
        item["is_trusted"] = trust is not None
        item["trust"] = _trust_to_dict(trust) if trust else None
        items.append(item)

    return {"items": items}


@router.get("/devices/trusted")
async def list_trusted_devices(
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(TrustedDevice)
        .where(
            TrustedDevice.admin_id == admin.id,
            TrustedDevice.revoked_at.is_(None),
            TrustedDevice.expires_at > datetime.now(timezone.utc),
        )
        .order_by(TrustedDevice.trusted_at.desc())
    )
    result = await db.execute(stmt)
    trusts = result.scalars().all()
    return {"items": [_trust_to_dict(t) for t in trusts]}


@router.get("/devices/{device_id}")
async def get_device(
    device_id: str,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Device).where(Device.id == UUID(device_id), Device.admin_id == admin.id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(404, "device_not_found")
    return _device_to_dict(device)


@router.post("/devices/{device_id}/revoke")
async def revoke_device_endpoint(
    device_id: str,
    request: Request,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Device).where(Device.id == UUID(device_id), Device.admin_id == admin.id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(404, "device_not_found")

    current_token = request.cookies.get(settings.device_cookie_name)
    if current_token:
        import hashlib
        current_hash = hashlib.sha256(current_token.encode()).hexdigest()
        if device.device_hash == current_hash:
            raise HTTPException(400, "cannot_revoke_current_device")

    await revoke_device(db, device.id)
    await log_security_event(
        db, "device_revoked", "medium",
        admin_id=admin.id, device_id=device.id,
        ip_address=request.client.host if request.client else None,
        reason="Device revoked by user",
    )

    return {"status": "revoked"}


@router.post("/devices/{device_id}/block")
async def block_device_endpoint(
    device_id: str,
    request: Request,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Device).where(Device.id == UUID(device_id), Device.admin_id == admin.id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(404, "device_not_found")

    current_token = request.cookies.get(settings.device_cookie_name)
    if current_token:
        import hashlib
        current_hash = hashlib.sha256(current_token.encode()).hexdigest()
        if device.device_hash == current_hash:
            raise HTTPException(400, "cannot_block_current_device")

    await block_device(db, device.id)
    if device.last_ip:
        await RedisBlocklist.block(f"ip:{device.last_ip}", ttl_seconds=3600)
    await log_security_event(
        db, "device_blocked", "high",
        admin_id=admin.id, device_id=device.id,
        ip_address=request.client.host if request.client else None,
        reason="Device blocked by user",
    )

    return {"status": "blocked"}


@router.post("/devices/{device_id}/unblock")
async def unblock_device_endpoint(
    device_id: str,
    request: Request,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Device).where(Device.id == UUID(device_id), Device.admin_id == admin.id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(404, "device_not_found")

    await unblock_device(db, device.id)
    if device.last_ip:
        await RedisBlocklist.unblock(f"ip:{device.last_ip}")

    return {"status": "unblocked"}


@router.post("/devices/{device_id}/revoke-trust")
async def revoke_trust_endpoint(
    device_id: str,
    request: Request,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Device).where(Device.id == UUID(device_id), Device.admin_id == admin.id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(404, "device_not_found")

    trust_stmt = select(TrustedDevice).where(
        TrustedDevice.device_id == device.id,
        TrustedDevice.revoked_at.is_(None),
    )
    trust_result = await db.execute(trust_stmt)
    trust = trust_result.scalar_one_or_none()
    if not trust:
        raise HTTPException(404, "no_active_trust")

    await revoke_trust(db, trust.id)
    await log_security_event(
        db, "device_revoked", "medium",
        admin_id=admin.id, device_id=device.id,
        ip_address=request.client.host if request.client else None,
        reason="Trust revoked by user",
    )

    return {"status": "trust_revoked"}
```

```python
// File: backend\app\api\admin_messages.py
from uuid import UUID
from datetime import datetime, timezone, timedelta
from urllib.parse import quote

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, func, update, desc, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import (
    ContactMessage, MessageStatus, MessagePriority, MessageNote,
    AuditEvent, AuditLog, MessageTag, ContactMessageTag, AdminUser,
    MessageAttachment, AdminSetting,
)
from app.api.deps import require_permission
from app.models_rbac import Permission
from app.services.storage_service import get_storage

logger = structlog.get_logger()
router = APIRouter(prefix="/admin/api/messages", tags=["messages"])

# Content types that must never render inline in the admin browser context.
_HOSTILE_TYPES = ("text/html", "application/xhtml", "image/svg")


class MessageUpdate(BaseModel):
    status: MessageStatus | None = None
    priority: MessagePriority | None = None
    assigned_to: str | None = None
    is_pinned: bool | None = None
    is_flagged: bool | None = None


class NoteRequest(BaseModel):
    body: str


class TagRequest(BaseModel):
    tag_name: str


class BulkIdsRequest(BaseModel):
    message_ids: list[UUID]


class BulkPinFlagRequest(BaseModel):
    message_ids: list[UUID]
    is_pinned: bool | None = None
    is_flagged: bool | None = None


@router.get("")
async def list_messages(
    status: MessageStatus | None = None,
    priority: MessagePriority | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ContactMessage).where(ContactMessage.deleted_at.isnot(None) == False)  # noqa: E712
    count_stmt = select(func.count(ContactMessage.id)).where(ContactMessage.deleted_at.isnot(None) == False)  # noqa: E712

    if status:
        stmt = stmt.where(ContactMessage.status == status)
        count_stmt = count_stmt.where(ContactMessage.status == status)
    if priority:
        stmt = stmt.where(ContactMessage.priority == priority)
        count_stmt = count_stmt.where(ContactMessage.priority == priority)
    if search:
        pattern = f"%{search}%"
        cond = or_(
            ContactMessage.sender_name.ilike(pattern),
            ContactMessage.sender_email.ilike(pattern),
            ContactMessage.subject.ilike(pattern),
            ContactMessage.body.ilike(pattern),
            ContactMessage.public_reference.ilike(pattern),
        )
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)

    total = (await db.execute(count_stmt)).scalar()
    offset = (page - 1) * limit
    stmt = stmt.order_by(ContactMessage.is_pinned.desc(), desc(ContactMessage.created_at)).offset(offset).limit(limit)
    result = await db.execute(stmt)
    messages = result.scalars().all()

    attachment_counts: dict = {}
    message_ids = [m.id for m in messages]
    if message_ids:
        rows = await db.execute(
            select(MessageAttachment.message_id, func.count(MessageAttachment.id))
            .where(MessageAttachment.message_id.in_(message_ids))
            .group_by(MessageAttachment.message_id)
        )
        attachment_counts = {mid: count for mid, count in rows.all()}

    return {
        "items": [
            {
                "id": str(m.id),
                "reference": m.public_reference,
                "sender_name": m.sender_name,
                "sender_email": m.sender_email,
                "subject": m.subject,
                "status": m.status,
                "priority": m.priority,
                "channel": m.channel,
                "created_at": m.created_at.isoformat() if m.created_at else None,
                "attachment_count": attachment_counts.get(m.id, 0),
                "is_pinned": m.is_pinned,
                "is_flagged": m.is_flagged,
            }
            for m in messages
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/{message_id}")
async def get_message(
    message_id: UUID,
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    msg = (await db.execute(
        select(ContactMessage).where(ContactMessage.id == message_id)
    )).scalar_one_or_none()
    if not msg:
        raise HTTPException(404, "not_found")

    if msg.deleted_at:
        return {
            **{k: None for k in ["notes", "tags", "attachments"]},
            "id": str(msg.id),
            "reference": msg.public_reference,
            "subject": msg.subject,
            "sender_name": msg.sender_name,
            "sender_email": msg.sender_email,
            "trashed": True,
            "deleted_at": msg.deleted_at.isoformat(),
        }

    if not msg.first_viewed_at:
        msg.first_viewed_at = datetime.now(timezone.utc)
        await db.commit()

    notes = (await db.execute(
        select(MessageNote).where(MessageNote.message_id == msg.id).order_by(MessageNote.created_at)
    )).scalars().all()

    tags = (await db.execute(
        select(MessageTag).join(ContactMessageTag).where(ContactMessageTag.message_id == msg.id)
    )).scalars().all()

    attachments = (await db.execute(
        select(MessageAttachment)
        .where(MessageAttachment.message_id == msg.id)
        .order_by(MessageAttachment.created_at)
    )).scalars().all()

    return {
        "id": str(msg.id),
        "reference": msg.public_reference,
        "sender_name": msg.sender_name,
        "sender_email": msg.sender_email,
        "sender_phone": msg.sender_phone,
        "subject": msg.subject,
        "body": msg.body,
        "status": msg.status,
        "priority": msg.priority,
        "channel": msg.channel,
        "source_page": msg.source_page,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
        "is_pinned": msg.is_pinned,
        "pinned_at": msg.pinned_at.isoformat() if msg.pinned_at else None,
        "is_flagged": msg.is_flagged,
        "flagged_at": msg.flagged_at.isoformat() if msg.flagged_at else None,
        "notes": [
            {
                "id": str(n.id),
                "body": n.body,
                "author_id": str(n.author_id),
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notes
        ],
        "tags": [{"id": str(t.id), "name": t.name, "color": t.color} for t in tags],
        "attachments": [
            {
                "id": str(a.id),
                "filename": a.original_filename,
                "url": f"/admin/api/messages/{msg.id}/attachments/{a.id}",
                "size": a.size_bytes,
                "content_type": a.content_type,
            }
            for a in attachments
        ],
    }


@router.get("/{message_id}/attachments/{attachment_id}")
async def download_attachment(
    message_id: UUID,
    attachment_id: UUID,
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    att = (await db.execute(
        select(MessageAttachment).where(
            MessageAttachment.id == attachment_id,
            MessageAttachment.message_id == message_id,
        )
    )).scalar_one_or_none()
    if not att:
        raise HTTPException(404, "not_found")

    # Always download: browser preview of untrusted uploads is never useful
    # here, and a navigation to an inline body reads as a blank page.
    content_type = (att.content_type or "application/octet-stream").lower()
    if content_type.startswith(_HOSTILE_TYPES):
        content_type = "application/octet-stream"
    disposition = "attachment"

    ascii_name = att.original_filename.encode("ascii", "ignore").decode() or "download"
    quoted_name = quote(att.original_filename)

    storage = get_storage()
    try:
        chunk_iter = await storage.open_attachment(att.object_key)
    except Exception:
        logger.error("attachment_download_failed",
                     attachment_id=str(att.id), object_key=att.object_key)
        raise HTTPException(502, "storage_unavailable")

    return StreamingResponse(
        chunk_iter,
        media_type=content_type,
        headers={
            "Content-Disposition": (
                f'{disposition}; filename="{ascii_name}"; '
                f"filename*=UTF-8''{quoted_name}"
            ),
            "Cache-Control": "no-store",
        },
    )


@router.patch("/{message_id}")
async def update_message(
    message_id: UUID,
    body: MessageUpdate,
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_UPDATE)),
    db: AsyncSession = Depends(get_db),
):
    msg = (await db.execute(
        select(ContactMessage).where(ContactMessage.id == message_id)
    )).scalar_one_or_none()
    if not msg:
        raise HTTPException(404, "not_found")

    values = {}
    if body.status:
        values["status"] = body.status
        if body.status == MessageStatus.resolved:
            values["resolved_at"] = datetime.now(timezone.utc)
    if body.priority:
        values["priority"] = body.priority
    if body.assigned_to is not None:
        values["assigned_to"] = UUID(body.assigned_to) if body.assigned_to else None

    now = datetime.now(timezone.utc)

    if body.is_pinned is not None and body.is_pinned != msg.is_pinned:
        values["is_pinned"] = body.is_pinned
        values["pinned_at"] = now if body.is_pinned else None
        values["pinned_by"] = admin.id if body.is_pinned else None
        event = AuditEvent.message_pinned if body.is_pinned else AuditEvent.message_unpinned
        _audit(db, event, admin.id, message_id)

    if body.is_flagged is not None and body.is_flagged != msg.is_flagged:
        values["is_flagged"] = body.is_flagged
        values["flagged_at"] = now if body.is_flagged else None
        values["flagged_by"] = admin.id if body.is_flagged else None
        event = AuditEvent.message_flagged if body.is_flagged else AuditEvent.message_unflagged
        _audit(db, event, admin.id, message_id)

    if values:
        values["updated_at"] = now
        await db.execute(
            update(ContactMessage).where(ContactMessage.id == message_id).values(**values)
        )

    _audit(db, AuditEvent.message_updated, admin.id, message_id)
    await db.commit()

    return {"status": "ok"}


@router.delete("/{message_id}")
async def delete_message(
    message_id: UUID,
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_DELETE)),
    db: AsyncSession = Depends(get_db),
):
    msg = (await db.execute(
        select(ContactMessage).where(ContactMessage.id == message_id)
    )).scalar_one_or_none()
    if not msg:
        raise HTTPException(404, "not_found")

    msg.status = MessageStatus.archived
    msg.updated_at = datetime.now(timezone.utc)

    _audit(db, AuditEvent.message_deleted, admin.id, message_id)
    await db.commit()
    return {"status": "ok"}


async def _get_retention_days(db: AsyncSession) -> int:
    result = await db.execute(select(AdminSetting).where(AdminSetting.id == 1))
    setting = result.scalar_one_or_none()
    return setting.trash_retention_days if setting else 30


@router.post("/bulk/trash")
async def bulk_trash(
    body: BulkIdsRequest,
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_DELETE)),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    retention_days = await _get_retention_days(db)
    trashed = 0

    for mid in body.message_ids:
        msg = (await db.execute(
            select(ContactMessage).where(ContactMessage.id == mid)
        )).scalar_one_or_none()
        if msg and not msg.deleted_at:
            msg.deleted_at = now
            msg.trash_expires_at = now + timedelta(days=retention_days)
            msg.deleted_by = admin.id
            msg.updated_at = now
            trashed += 1

    if trashed:
        _audit(db, AuditEvent.message_trashed, admin.id, meta={"count": trashed})
    await db.commit()
    return {"status": "ok", "trashed": trashed}


@router.patch("/bulk")
async def bulk_pin_flag(
    body: BulkPinFlagRequest,
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_UPDATE)),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    updated = 0

    for mid in body.message_ids:
        msg = (await db.execute(
            select(ContactMessage).where(ContactMessage.id == mid)
        )).scalar_one_or_none()
        if not msg:
            continue

        values = {"updated_at": now}

        if body.is_pinned is not None and body.is_pinned != msg.is_pinned:
            values["is_pinned"] = body.is_pinned
            values["pinned_at"] = now if body.is_pinned else None
            values["pinned_by"] = admin.id if body.is_pinned else None
            event = AuditEvent.message_pinned if body.is_pinned else AuditEvent.message_unpinned
            _audit(db, event, admin.id, mid)

        if body.is_flagged is not None and body.is_flagged != msg.is_flagged:
            values["is_flagged"] = body.is_flagged
            values["flagged_at"] = now if body.is_flagged else None
            values["flagged_by"] = admin.id if body.is_flagged else None
            event = AuditEvent.message_flagged if body.is_flagged else AuditEvent.message_unflagged
            _audit(db, event, admin.id, mid)

        if len(values) > 1:
            await db.execute(
                update(ContactMessage).where(ContactMessage.id == mid).values(**values)
            )
            updated += 1

    await db.commit()
    return {"status": "ok", "updated": updated}


@router.post("/{message_id}/trash")
async def trash_message(
    message_id: UUID,
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_DELETE)),
    db: AsyncSession = Depends(get_db),
):
    msg = (await db.execute(
        select(ContactMessage).where(ContactMessage.id == message_id)
    )).scalar_one_or_none()
    if not msg:
        raise HTTPException(404, "not_found")

    if msg.deleted_at:
        return {"status": "ok", "message": "already_trashed"}

    now = datetime.now(timezone.utc)
    retention_days = await _get_retention_days(db)
    msg.deleted_at = now
    msg.trash_expires_at = now + timedelta(days=retention_days)
    msg.deleted_by = admin.id
    msg.updated_at = now

    _audit(db, AuditEvent.message_trashed, admin.id, message_id, meta={
        "retention_days": retention_days,
        "trash_expires_at": msg.trash_expires_at.isoformat(),
    })
    await db.commit()

    return {
        "status": "ok",
        "deleted_at": msg.deleted_at.isoformat(),
        "trash_expires_at": msg.trash_expires_at.isoformat(),
    }


@router.post("/{message_id}/notes")
async def add_note(
    message_id: UUID,
    body: NoteRequest,
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_NOTES)),
    db: AsyncSession = Depends(get_db),
):
    msg = (await db.execute(
        select(ContactMessage).where(ContactMessage.id == message_id)
    )).scalar_one_or_none()
    if not msg:
        raise HTTPException(404, "not_found")

    note = MessageNote(
        message_id=message_id,
        author_id=admin.id,
        body=body.body,
    )
    db.add(note)
    await db.commit()

    return {
        "id": str(note.id),
        "body": note.body,
        "author_id": str(note.author_id),
        "created_at": note.created_at.isoformat() if note.created_at else None,
    }


@router.post("/{message_id}/tags")
async def add_tag(
    message_id: UUID,
    body: TagRequest,
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_TAGS)),
    db: AsyncSession = Depends(get_db),
):
    msg = (await db.execute(
        select(ContactMessage).where(ContactMessage.id == message_id)
    )).scalar_one_or_none()
    if not msg:
        raise HTTPException(404, "not_found")

    tag = (await db.execute(
        select(MessageTag).where(MessageTag.name == body.tag_name)
    )).scalar_one_or_none()
    if not tag:
        tag = MessageTag(name=body.tag_name)
        db.add(tag)
        await db.flush()

    existing = (await db.execute(
        select(ContactMessageTag).where(
            ContactMessageTag.message_id == message_id,
            ContactMessageTag.tag_id == tag.id,
        )
    )).scalar_one_or_none()
    if not existing:
        db.add(ContactMessageTag(message_id=message_id, tag_id=tag.id))
        await db.commit()

    return {"id": str(tag.id), "name": tag.name}


@router.delete("/{message_id}/tags/{tag_id}")
async def remove_tag(
    message_id: UUID,
    tag_id: UUID,
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_TAGS)),
    db: AsyncSession = Depends(get_db),
):
    msg = (await db.execute(
        select(ContactMessage).where(ContactMessage.id == message_id)
    )).scalar_one_or_none()
    if not msg:
        raise HTTPException(404, "not_found")

    link = (await db.execute(
        select(ContactMessageTag).where(
            ContactMessageTag.message_id == message_id,
            ContactMessageTag.tag_id == tag_id,
        )
    )).scalar_one_or_none()
    if not link:
        raise HTTPException(404, "tag_not_found")

    await db.delete(link)

    tag = (await db.execute(
        select(MessageTag).where(MessageTag.id == tag_id)
    )).scalar_one_or_none()
    if tag:
        usage = (await db.execute(
            select(func.count(ContactMessageTag.message_id))
            .where(ContactMessageTag.tag_id == tag_id)
        )).scalar()
        if usage == 0:
            await db.delete(tag)

    _audit(db, AuditEvent.message_tag_removed, admin.id, message_id)
    await db.commit()
    return {"status": "ok"}


def _audit(db: AsyncSession, event: AuditEvent, admin_id=None, message_id=None, meta=None):
    db.add(AuditLog(
        event=event,
        actor_admin_id=admin_id,
        target_message_id=message_id,
        metadata_=meta or {},
    ))
```

```python
// File: backend\app\api\admin_security.py
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.models import (
    AdminUser, SecurityEvent, SecurityEventType, SecuritySeverity,
    Device, DeviceState,
)
from app.api.deps import get_current_admin, require_permission
from app.models_rbac import Permission
from app.security.rate_limit import RedisBlocklist
from app.security.devices import log_security_event
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/admin/api/security", tags=["security"])


class BlockIpRequest(BaseModel):
    ip_address: str
    reason: str = ""
    ttl_seconds: int = 3600


class UnblockIpRequest(BaseModel):
    ip_address: str


@router.get("/dashboard")
async def security_dashboard(
    admin: AdminUser = Depends(require_permission(Permission.AUDIT_LOGS_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    last_24h = now - timedelta(hours=24)
    last_1h = now - timedelta(hours=1)

    total_24h = await db.execute(
        select(func.count(SecurityEvent.id)).where(SecurityEvent.created_at >= last_24h)
    )
    events_24h = total_24h.scalar() or 0

    total_1h = await db.execute(
        select(func.count(SecurityEvent.id)).where(SecurityEvent.created_at >= last_1h)
    )
    events_1h = total_1h.scalar() or 0

    blocked_24h = await db.execute(
        select(func.count(SecurityEvent.id)).where(
            SecurityEvent.event_type == SecurityEventType.rate_limited,
            SecurityEvent.created_at >= last_24h,
        )
    )
    blocked_count = blocked_24h.scalar() or 0

    failed_logins_24h = await db.execute(
        select(func.count(SecurityEvent.id)).where(
            SecurityEvent.event_type == SecurityEventType.login_failure,
            SecurityEvent.created_at >= last_24h,
        )
    )
    failed_logins = failed_logins_24h.scalar() or 0

    new_devices_24h = await db.execute(
        select(func.count(SecurityEvent.id)).where(
            SecurityEvent.event_type == SecurityEventType.new_device,
            SecurityEvent.created_at >= last_24h,
        )
    )
    new_devices = new_devices_24h.scalar() or 0

    active_devices = await db.execute(
        select(func.count(Device.id)).where(
            Device.state != DeviceState.revoked,
            Device.state != DeviceState.blocked,
        )
    )
    active_dev_count = active_devices.scalar() or 0

    severity_counts = {}
    for sev in SecuritySeverity:
        count_result = await db.execute(
            select(func.count(SecurityEvent.id)).where(
                SecurityEvent.severity == sev,
                SecurityEvent.created_at >= last_24h,
            )
        )
        severity_counts[sev.value] = count_result.scalar() or 0

    return {
        "events_24h": events_24h,
        "events_1h": events_1h,
        "blocked_requests_24h": blocked_count,
        "failed_logins_24h": failed_logins,
        "new_devices_24h": new_devices,
        "active_devices": active_dev_count,
        "severity_counts": severity_counts,
    }


@router.get("/events")
async def list_security_events(
    request: Request,
    admin: AdminUser = Depends(require_permission(Permission.AUDIT_LOGS_VIEW)),
    db: AsyncSession = Depends(get_db),
    page: int = 1,
    limit: int = 50,
    event_type: str | None = None,
    severity: str | None = None,
    admin_id: str | None = None,
):
    limit = min(limit, 100)
    offset = (max(page, 1) - 1) * limit

    stmt = select(SecurityEvent).order_by(SecurityEvent.created_at.desc())

    if event_type:
        stmt = stmt.where(SecurityEvent.event_type == event_type)
    if severity:
        stmt = stmt.where(SecurityEvent.severity == severity)
    if admin_id:
        stmt = stmt.where(SecurityEvent.admin_id == admin_id)

    count_stmt = select(func.count(SecurityEvent.id))
    if event_type:
        count_stmt = count_stmt.where(SecurityEvent.event_type == event_type)
    if severity:
        count_stmt = count_stmt.where(SecurityEvent.severity == severity)
    if admin_id:
        count_stmt = count_stmt.where(SecurityEvent.admin_id == admin_id)

    total = (await db.execute(count_stmt)).scalar() or 0
    result = await db.execute(stmt.offset(offset).limit(limit))
    events = result.scalars().all()

    items = []
    for e in events:
        items.append({
            "id": e.id,
            "event_type": e.event_type.value if hasattr(e.event_type, "value") else e.event_type,
            "severity": e.severity.value if hasattr(e.severity, "value") else e.severity,
            "admin_id": str(e.admin_id) if e.admin_id else None,
            "device_id": str(e.device_id) if e.device_id else None,
            "ip_address": str(e.ip_address) if e.ip_address else None,
            "user_agent": e.user_agent,
            "path": e.path,
            "method": e.method,
            "risk_score": e.risk_score,
            "reason": e.reason,
            "metadata": e.metadata_,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
    }


@router.get("/blocked-ips")
async def list_blocked_ips(
    admin: AdminUser = Depends(require_permission(Permission.AUDIT_LOGS_VIEW)),
):
    from app.security.rate_limit import get_redis
    r = await get_redis()
    keys = await r.keys("block:ip:*")
    items = []
    for key in keys:
        ip = key.replace("block:ip:", "")
        ttl = await r.ttl(key)
        items.append({"ip_address": ip, "ttl_seconds": max(ttl, 0)})
    return {"items": items}


@router.post("/block-ip")
async def block_ip_endpoint(
    body: BlockIpRequest,
    request: Request,
    admin: AdminUser = Depends(require_permission(Permission.AUDIT_LOGS_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    await RedisBlocklist.block(f"ip:{body.ip_address}", ttl_seconds=body.ttl_seconds)
    await log_security_event(
        db, "rate_limited", "high",
        admin_id=admin.id,
        ip_address=body.ip_address,
        reason=f"IP manually blocked by {admin.username}: {body.reason}",
        metadata={"manual_block": True, "ttl": body.ttl_seconds},
    )
    return {"status": "blocked", "ip_address": body.ip_address, "ttl_seconds": body.ttl_seconds}


@router.post("/unblock-ip")
async def unblock_ip_endpoint(
    body: UnblockIpRequest,
    request: Request,
    admin: AdminUser = Depends(require_permission(Permission.AUDIT_LOGS_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    await RedisBlocklist.unblock(f"ip:{body.ip_address}")
    return {"status": "unblocked", "ip_address": body.ip_address}
```

```python
// File: backend\app\api\admin_settings.py
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.models import AdminSetting, AuditEvent, AuditLog, AdminUser
from app.api.deps import get_current_admin, require_owner, require_permission
from app.models_rbac import Permission
from app.security.password_policy import (
    PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, validate_password_strength,
)
from app.services.totp_service import (
    generate_secret, encrypt_secret, decrypt_secret, verify_totp,
    get_provisioning_uri, store_pending_secret, get_pending_secret,
    clear_pending_secret,
)
from app.security.sessions import revoke_other_sessions

router = APIRouter(prefix="/admin/api", tags=["settings"])


def _audit_setting(db: AsyncSession, event: AuditEvent, admin_id, meta=None):
    db.add(AuditLog(
        event=event,
        actor_admin_id=admin_id,
        metadata_=meta or {},
    ))


class TotpEnableRequest(BaseModel):
    code: str = Field(min_length=6, max_length=8)


class TotpDisableRequest(BaseModel):
    totp_code: str


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)
    new_password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return validate_password_strength(v)


class SettingsUpdate(BaseModel):
    trash_retention_days: int | None = None


@router.get("/settings")
async def get_settings(admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AdminSetting).where(AdminSetting.id == 1))
    setting = result.scalar_one_or_none()
    if not setting:
        setting = AdminSetting()
        db.add(setting)
        await db.commit()

    return {
        "telegram_otp_required": setting.telegram_otp_required,
        "totp_enabled": admin.totp_enabled,
        "otp_length": setting.otp_length,
        "otp_ttl_seconds": setting.otp_ttl_seconds,
        "session_idle_minutes": setting.session_idle_minutes,
        "trash_retention_days": setting.trash_retention_days,
    }


@router.patch("/settings")
async def update_settings(
    body: SettingsUpdate,
    admin: AdminUser = Depends(require_permission(Permission.SETTINGS_UPDATE)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AdminSetting).where(AdminSetting.id == 1))
    setting = result.scalar_one_or_none()
    if not setting:
        setting = AdminSetting()
        db.add(setting)
        await db.flush()

    if body.trash_retention_days is not None:
        if body.trash_retention_days < 1 or body.trash_retention_days > 3650:
            raise HTTPException(400, "retention_days_out_of_range")
        old_days = setting.trash_retention_days
        setting.trash_retention_days = body.trash_retention_days
        _audit_setting(db, AuditEvent.trash_retention_changed, admin.id, {
            "old_days": old_days,
            "new_days": body.trash_retention_days,
        })

    setting.updated_by = admin.id
    setting.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"status": "ok"}


@router.get("/settings/totp/setup")
async def totp_setup(admin: AdminUser = Depends(get_current_admin)):
    secret = generate_secret()
    await store_pending_secret(str(admin.id), secret)
    uri = get_provisioning_uri(secret, admin.username)
    return {
        "secret": secret,
        "provisioning_uri": uri,
    }


@router.post("/settings/totp/enable")
async def totp_enable(
    body: TotpEnableRequest,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    pending = await get_pending_secret(str(admin.id))
    if not pending:
        raise HTTPException(400, "totp_setup_expired")

    if not verify_totp(pending, body.code):
        raise HTTPException(400, "invalid_totp")

    admin.totp_secret_ciphertext = encrypt_secret(pending)
    admin.totp_enabled = True
    admin.totp_enabled_at = datetime.now(timezone.utc)
    admin.updated_at = datetime.now(timezone.utc)

    db.add(AuditLog(
        event=AuditEvent.totp_enabled,
        actor_admin_id=admin.id,
    ))
    await db.commit()
    await clear_pending_secret(str(admin.id))
    return {"status": "ok"}


@router.post("/settings/totp/disable")
async def totp_disable(
    body: TotpDisableRequest,
    request: Request,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    if not admin.totp_secret_ciphertext:
        raise HTTPException(400, "totp_not_enabled")

    secret = decrypt_secret(admin.totp_secret_ciphertext)
    if not verify_totp(secret, body.totp_code):
        raise HTTPException(400, "invalid_totp")

    admin.totp_secret_ciphertext = None
    admin.totp_enabled = False
    admin.totp_enabled_at = None
    admin.updated_at = datetime.now(timezone.utc)

    current_token = request.cookies.get("vks_session")
    if current_token:
        await revoke_other_sessions(db, str(admin.id), current_token)

    db.add(AuditLog(
        event=AuditEvent.totp_disabled,
        actor_admin_id=admin.id,
    ))
    await db.commit()
    return {"status": "ok"}


@router.post("/settings/change-password")
async def change_password(
    body: PasswordChangeRequest,
    request: Request,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.security.passwords import hash_password, verify_password
    if not verify_password(body.current_password, admin.password_hash):
        raise HTTPException(400, "invalid_password")

    admin.password_hash = hash_password(body.new_password)
    admin.password_changed_at = datetime.now(timezone.utc)
    admin.updated_at = datetime.now(timezone.utc)

    current_token = request.cookies.get("vks_session")
    if current_token:
        await revoke_other_sessions(db, str(admin.id), current_token)

    db.add(AuditLog(
        event=AuditEvent.password_changed,
        actor_admin_id=admin.id,
    ))
    await db.commit()
    return {"status": "ok"}


@router.get("/audit-logs")
async def get_audit_logs(
    page: int = 1,
    limit: int = 50,
    admin: AdminUser = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import func, desc
    total = (await db.execute(select(func.count(AuditLog.id)))).scalar()
    offset = (page - 1) * limit
    result = await db.execute(
        select(AuditLog).order_by(desc(AuditLog.created_at)).offset(offset).limit(limit)
    )
    logs = result.scalars().all()
    return {
        "items": [
            {
                "id": l.id,
                "event": l.event,
                "actor_admin_id": str(l.actor_admin_id) if l.actor_admin_id else None,
                "ip_address": l.ip_address,
                "metadata": l.metadata_,
                "created_at": l.created_at.isoformat() if l.created_at else None,
            }
            for l in logs
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/admin-users")
async def list_admin_users(
    admin: AdminUser = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AdminUser).order_by(AdminUser.created_at))
    users = result.scalars().all()
    return {
        "items": [
            {
                "id": str(u.id),
                "username": u.username,
                "email": u.email,
                "display_name": u.display_name,
                "role": u.role,
                "status": u.status,
                "totp_enabled": u.totp_enabled,
                "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ],
    }


@router.get("/stats")
async def get_stats(
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.models import ContactMessage, MessageStatus
    from sqlalchemy import func

    total = (await db.execute(select(func.count(ContactMessage.id)).where(ContactMessage.deleted_at.isnot(None) == False))).scalar()  # noqa: E712
    new_count = (await db.execute(
        select(func.count(ContactMessage.id)).where(ContactMessage.status == MessageStatus.new, ContactMessage.deleted_at.isnot(None) == False)  # noqa: E712
    )).scalar()
    in_progress = (await db.execute(
        select(func.count(ContactMessage.id)).where(ContactMessage.status == MessageStatus.in_progress, ContactMessage.deleted_at.isnot(None) == False)  # noqa: E712
    )).scalar()
    resolved = (await db.execute(
        select(func.count(ContactMessage.id)).where(ContactMessage.status == MessageStatus.resolved, ContactMessage.deleted_at.isnot(None) == False)  # noqa: E712
    )).scalar()
    trashed = (await db.execute(
        select(func.count(ContactMessage.id)).where(ContactMessage.deleted_at.isnot(None))
    )).scalar()

    return {
        "total_messages": total,
        "new_messages": new_count,
        "in_progress": in_progress,
        "resolved": resolved,
        "trashed_count": trashed,
    }
```

```python
// File: backend\app\api\admin_totp.py
import structlog
from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.models import AdminUser, AdminSession, AuditEvent, AuditLog
from app.models_rbac import Permission
from app.api.deps import require_permission, assert_can_manage
from app.services.totp_service import (
    generate_secret, encrypt_secret, verify_totp,
    get_provisioning_uri, store_pending_secret, get_pending_secret,
    clear_pending_secret,
)

logger = structlog.get_logger()
router = APIRouter(prefix="/admin/api/users", tags=["user-totp"])


class TotpEnableRequest(BaseModel):
    code: str = Field(min_length=6, max_length=8)


def _audit(db: AsyncSession, event: AuditEvent, actor_id=None, target_id=None, ip=None, meta=None):
    db.add(AuditLog(
        event=event,
        actor_admin_id=actor_id,
        target_admin_id=target_id,
        ip_address=ip,
        metadata_=meta or {},
    ))


@router.get("/{user_id}/totp/setup")
async def totp_setup(
    user_id: str,
    admin: AdminUser = Depends(require_permission(Permission.USERS_MANAGE_2FA)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AdminUser).where(AdminUser.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "user_not_found")

    if user.id != admin.id:
        await assert_can_manage(db, admin, user)

    secret = generate_secret()
    await store_pending_secret(str(user.id), secret)
    provisioning_uri = get_provisioning_uri(secret, user.username)

    return {
        "user_id": str(user.id),
        "username": user.username,
        "secret": secret,
        "otpauth_uri": provisioning_uri,
    }


@router.post("/{user_id}/totp/enable")
async def totp_enable(
    user_id: str,
    body: TotpEnableRequest,
    request: Request,
    admin: AdminUser = Depends(require_permission(Permission.USERS_MANAGE_2FA)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AdminUser).where(AdminUser.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "user_not_found")

    if user.totp_enabled:
        raise HTTPException(400, "totp_already_enabled")

    pending = await get_pending_secret(str(user.id))
    if not pending:
        raise HTTPException(400, "totp_setup_expired")

    if not verify_totp(pending, body.code):
        raise HTTPException(401, "invalid_totp_code")

    if user.id != admin.id:
        await assert_can_manage(db, admin, user)

    user.totp_secret_ciphertext = encrypt_secret(pending)
    user.totp_enabled = True
    user.totp_enabled_at = datetime.now(timezone.utc)

    _audit(db, AuditEvent.totp_enabled, actor_id=admin.id, target_id=user.id,
           ip=request.client.host if request.client else None,
           meta={"target_username": user.username})

    await db.commit()
    await clear_pending_secret(str(user.id))
    return {"status": "totp_enabled"}


@router.post("/{user_id}/totp/disable")
async def totp_disable(
    user_id: str,
    request: Request,
    admin: AdminUser = Depends(require_permission(Permission.USERS_MANAGE_2FA)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AdminUser).where(AdminUser.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "user_not_found")

    if not user.totp_enabled:
        raise HTTPException(400, "totp_not_enabled")

    if user.id != admin.id:
        await assert_can_manage(db, admin, user)

    user.totp_secret_ciphertext = None
    user.totp_enabled = False
    user.totp_enabled_at = None

    # Revoke sessions
    await db.execute(
        update(AdminSession)
        .where(AdminSession.admin_id == user.id, AdminSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )

    _audit(db, AuditEvent.totp_disabled, actor_id=admin.id, target_id=user.id,
           ip=request.client.host if request.client else None,
           meta={"target_username": user.username})

    await db.commit()
    return {"status": "totp_disabled"}


@router.post("/{user_id}/totp/reset")
async def totp_reset(
    user_id: str,
    request: Request,
    admin: AdminUser = Depends(require_permission(Permission.USERS_MANAGE_2FA)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AdminUser).where(AdminUser.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "user_not_found")

    if not user.totp_enabled:
        raise HTTPException(400, "totp_not_enabled")

    if user.id != admin.id:
        await assert_can_manage(db, admin, user)

    user.totp_secret_ciphertext = None
    user.totp_enabled = False
    user.totp_enabled_at = None

    # Revoke sessions
    await db.execute(
        update(AdminSession)
        .where(AdminSession.admin_id == user.id, AdminSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )

    _audit(db, AuditEvent.totp_disabled, actor_id=admin.id, target_id=user.id,
           ip=request.client.host if request.client else None,
           meta={"target_username": user.username, "action": "totp_reset"})

    await db.commit()
    return {"status": "totp_reset"}
```

```python
// File: backend\app\api\admin_trash.py
from uuid import UUID
from datetime import datetime, timezone, timedelta

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, desc, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import (
    ContactMessage, MessageAttachment, MessageNote, ContactMessageTag,
    MessageTag, AdminSetting, AuditEvent, AuditLog, AdminUser,
)
from app.api.deps import require_permission
from app.models_rbac import Permission
from app.services.storage_service import get_storage

logger = structlog.get_logger()
router = APIRouter(prefix="/admin/api/trash", tags=["trash"])


class BulkRequest(BaseModel):
    message_ids: list[UUID]


async def _get_retention_days(db: AsyncSession) -> int:
    result = await db.execute(select(AdminSetting).where(AdminSetting.id == 1))
    setting = result.scalar_one_or_none()
    return setting.trash_retention_days if setting else 30


async def _permanent_delete(db: AsyncSession, msg: ContactMessage) -> None:
    storage = get_storage()
    attachments = (await db.execute(
        select(MessageAttachment).where(MessageAttachment.message_id == msg.id)
    )).scalars().all()
    for att in attachments:
        try:
            await storage.delete_attachment(att.object_key)
        except Exception:
            logger.warning("attachment_delete_failed", attachment_id=str(att.id), object_key=att.object_key)
    await db.execute(
        update(ContactMessage).where(ContactMessage.id == msg.id).values(deleted_by=None)
    )
    for att in attachments:
        await db.delete(att)
    notes = (await db.execute(
        select(MessageNote).where(MessageNote.message_id == msg.id)
    )).scalars().all()
    for note in notes:
        await db.delete(note)
    # contact_message_tags rows cascade via ON DELETE CASCADE.
    await db.delete(msg)


def _audit(db: AsyncSession, event: AuditEvent, admin_id=None, message_id=None, meta=None):
    db.add(AuditLog(
        event=event,
        actor_admin_id=admin_id,
        target_message_id=message_id,
        metadata_=meta or {},
    ))


# ── List trash ───────────────────────────────────────────────────
@router.get("")
async def list_trash(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: str | None = None,
    expiry: str | None = None,
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ContactMessage).where(ContactMessage.deleted_at.isnot(None))
    count_stmt = select(func.count(ContactMessage.id)).where(ContactMessage.deleted_at.isnot(None))

    if search:
        pattern = f"%{search}%"
        from sqlalchemy import or_
        cond = or_(
            ContactMessage.sender_name.ilike(pattern),
            ContactMessage.sender_email.ilike(pattern),
            ContactMessage.subject.ilike(pattern),
            ContactMessage.public_reference.ilike(pattern),
        )
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)

    now = datetime.now(timezone.utc)
    if expiry == "7":
        stmt = stmt.where(ContactMessage.trash_expires_at <= now + timedelta(days=7))
        count_stmt = count_stmt.where(ContactMessage.trash_expires_at <= now + timedelta(days=7))
    elif expiry == "30":
        stmt = stmt.where(ContactMessage.trash_expires_at <= now + timedelta(days=30))
        count_stmt = count_stmt.where(ContactMessage.trash_expires_at <= now + timedelta(days=30))

    total = (await db.execute(count_stmt)).scalar()
    offset = (page - 1) * limit
    stmt = stmt.order_by(desc(ContactMessage.deleted_at)).offset(offset).limit(limit)
    result = await db.execute(stmt)
    messages = result.scalars().all()

    return {
        "items": [
            {
                "id": str(m.id),
                "reference": m.public_reference,
                "sender_name": m.sender_name,
                "sender_email": m.sender_email,
                "subject": m.subject,
                "deleted_at": m.deleted_at.isoformat() if m.deleted_at else None,
                "trash_expires_at": m.trash_expires_at.isoformat() if m.trash_expires_at else None,
                "deleted_by": str(m.deleted_by) if m.deleted_by else None,
            }
            for m in messages
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }


# ── Get trashed message detail ───────────────────────────────────
@router.get("/{message_id}")
async def get_trashed_message(
    message_id: UUID,
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    msg = (await db.execute(
        select(ContactMessage).where(ContactMessage.id == message_id)
    )).scalar_one_or_none()
    if not msg or not msg.deleted_at:
        raise HTTPException(404, "not_found")

    notes = (await db.execute(
        select(MessageNote).where(MessageNote.message_id == msg.id).order_by(MessageNote.created_at)
    )).scalars().all()

    tags = (await db.execute(
        select(MessageTag).join(ContactMessageTag).where(ContactMessageTag.message_id == msg.id)
    )).scalars().all()

    attachments = (await db.execute(
        select(MessageAttachment)
        .where(MessageAttachment.message_id == msg.id)
        .order_by(MessageAttachment.created_at)
    )).scalars().all()

    return {
        "id": str(msg.id),
        "reference": msg.public_reference,
        "sender_name": msg.sender_name,
        "sender_email": msg.sender_email,
        "sender_phone": msg.sender_phone,
        "subject": msg.subject,
        "body": msg.body,
        "status": msg.status,
        "priority": msg.priority,
        "channel": msg.channel,
        "source_page": msg.source_page,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
        "deleted_at": msg.deleted_at.isoformat() if msg.deleted_at else None,
        "trash_expires_at": msg.trash_expires_at.isoformat() if msg.trash_expires_at else None,
        "deleted_by": str(msg.deleted_by) if msg.deleted_by else None,
        "notes": [
            {
                "id": str(n.id),
                "body": n.body,
                "author_id": str(n.author_id),
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notes
        ],
        "tags": [{"id": str(t.id), "name": t.name, "color": t.color} for t in tags],
        "attachments": [
            {
                "id": str(a.id),
                "filename": a.original_filename,
                "url": f"/admin/api/messages/{msg.id}/attachments/{a.id}",
                "size": a.size_bytes,
                "content_type": a.content_type,
            }
            for a in attachments
        ],
    }


# ── Bulk restore ─────────────────────────────────────────────────
@router.post("/bulk/restore")
async def bulk_restore(
    body: BulkRequest,
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_RESTORE)),
    db: AsyncSession = Depends(get_db),
):
    restored = 0
    for mid in body.message_ids:
        msg = (await db.execute(
            select(ContactMessage).where(ContactMessage.id == mid)
        )).scalar_one_or_none()
        if msg and msg.deleted_at:
            msg.deleted_at = None
            msg.trash_expires_at = None
            msg.deleted_by = None
            msg.updated_at = datetime.now(timezone.utc)
            restored += 1

    if restored:
        _audit(db, AuditEvent.message_restored, admin.id, None, {"count": restored})
    await db.commit()
    return {"status": "ok", "restored": restored}


# ── Restore ──────────────────────────────────────────────────────
@router.post("/{message_id}/restore")
async def restore_message(
    message_id: UUID,
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_RESTORE)),
    db: AsyncSession = Depends(get_db),
):
    msg = (await db.execute(
        select(ContactMessage).where(ContactMessage.id == message_id)
    )).scalar_one_or_none()
    if not msg or not msg.deleted_at:
        raise HTTPException(404, "not_found")

    msg.deleted_at = None
    msg.trash_expires_at = None
    msg.deleted_by = None
    msg.updated_at = datetime.now(timezone.utc)

    _audit(db, AuditEvent.message_restored, admin.id, message_id)
    await db.commit()
    return {"status": "ok"}


# ── Permanent delete ─────────────────────────────────────────────
@router.delete("/{message_id}")
async def permanent_delete(
    message_id: UUID,
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_DELETE)),
    db: AsyncSession = Depends(get_db),
):
    msg = (await db.execute(
        select(ContactMessage).where(ContactMessage.id == message_id)
    )).scalar_one_or_none()
    if not msg:
        raise HTTPException(404, "not_found")

    await _permanent_delete(db, msg)
    _audit(db, AuditEvent.message_permanently_deleted, admin.id, message_id)
    await db.commit()
    return {"status": "ok"}


# ── Bulk permanent delete ────────────────────────────────────────
@router.post("/bulk/delete")
async def bulk_permanent_delete(
    body: BulkRequest,
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_DELETE)),
    db: AsyncSession = Depends(get_db),
):
    deleted = 0
    for mid in body.message_ids:
        msg = (await db.execute(
            select(ContactMessage).where(ContactMessage.id == mid)
        )).scalar_one_or_none()
        if msg:
            await _permanent_delete(db, msg)
            deleted += 1

    if deleted:
        _audit(db, AuditEvent.message_permanently_deleted, admin.id, None, {"count": deleted})
    await db.commit()
    return {"status": "ok", "deleted": deleted}


# ── Empty trash ──────────────────────────────────────────────────
@router.post("/empty")
async def empty_trash(
    admin: AdminUser = Depends(require_permission(Permission.MESSAGES_EMPTY_TRASH)),
    db: AsyncSession = Depends(get_db),
):
    messages = (await db.execute(
        select(ContactMessage).where(ContactMessage.deleted_at.isnot(None)).limit(500)
    )).scalars().all()

    count = 0
    for msg in messages:
        await _permanent_delete(db, msg)
        count += 1

    if count:
        _audit(db, AuditEvent.message_permanently_deleted, admin.id, None, {"count": count, "source": "empty_trash"})
    await db.commit()
    return {"status": "ok", "deleted": count}
```

```python
// File: backend\app\api\admin_users.py
import structlog
import re
from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, func, delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased
from app.db import get_db
from app.models import AdminUser, AdminStatus, AuditEvent, AuditLog
from app.models_rbac import AdminRole as AdminRoleModel, Permission
from app.models_rbac import AdminPermission, AdminRolePermission
from app.api.deps import (
    get_current_admin,
    require_permission,
    get_admin_role_level,
    assert_can_manage,
)
from app.security.passwords import hash_password

logger = structlog.get_logger()
router = APIRouter(prefix="/admin/api", tags=["admin-users"])

_PASSWORD_MIN = 12
_RESERVED_ROLE_NAMES = {"owner", "admin", "manager", "support", "viewer", "operator"}
_ROLE_NAME_RE = re.compile(r"^[a-z][a-z0-9_-]{1,63}$")


class CreateUserRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    display_name: str = Field(min_length=1, max_length=160)
    email: str | None = None
    password: str = Field(min_length=_PASSWORD_MIN, max_length=256)
    role: str = "support"
    telegram_chat_id: str | None = None

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain an uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain a lowercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain a number")
        if not re.search(r"[^A-Za-z0-9]", v):
            raise ValueError("Password must contain a special character")
        if v != v.strip():
            raise ValueError("Password must not have leading or trailing whitespace")
        return v


class UpdateUserRequest(BaseModel):
    display_name: str | None = None
    email: str | None = None
    role: str | None = None
    telegram_chat_id: str | None = None


class ResetPasswordRequest(BaseModel):
    new_password: str = Field(min_length=_PASSWORD_MIN, max_length=256)

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain an uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain a lowercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain a number")
        if not re.search(r"[^A-Za-z0-9]", v):
            raise ValueError("Password must contain a special character")
        if v != v.strip():
            raise ValueError("Password must not have leading or trailing whitespace")
        return v


class CreateRoleRequest(BaseModel):
    name: str = Field(min_length=2, max_length=64)
    description: str | None = None
    level: int = Field(default=40, ge=1, le=99)
    permissions: list[str] = Field(default_factory=list)


def _audit(db: AsyncSession, event: AuditEvent, actor_id=None, target_id=None, ip=None, meta=None):
    db.add(AuditLog(
        event=event,
        actor_admin_id=actor_id,
        target_admin_id=target_id,
        ip_address=ip,
        metadata_=meta or {},
    ))


def _user_to_dict(
    user: AdminUser,
    creator: AdminUser | None = None,
    role_row: AdminRoleModel | None = None,
) -> dict:
    return {
        "id": str(user.id),
        "username": user.username,
        "email": user.email,
        "display_name": user.display_name,
        "role": user.role,
        "role_level": role_row.level if role_row else None,
        "role_id": str(user.role_id) if user.role_id else None,
        "status": user.status.value if hasattr(user.status, "value") else user.status,
        "telegram_chat_id": user.telegram_chat_id,
        "telegram_username": user.telegram_username,
        "totp_enabled": user.totp_enabled,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        "locked_until": user.locked_until.isoformat() if user.locked_until else None,
        "failed_login_count": user.failed_login_count or 0,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "created_by": (
            {
                "id": str(creator.id),
                "username": creator.username,
                "display_name": creator.display_name,
            }
            if creator
            else None
        ),
    }


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


async def _resolve_assignable_role(
    db: AsyncSession, role_name: str, actor: AdminUser
) -> AdminRoleModel:
    """Fetch the role row and enforce that the actor may assign it."""
    result = await db.execute(select(AdminRoleModel).where(AdminRoleModel.name == role_name))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=400, detail="invalid_role")

    actor_is_owner = actor.role == "owner"
    if role.name == "owner" and not actor_is_owner:
        raise HTTPException(status_code=403, detail="only_owner_can_assign_owner")

    if not actor_is_owner:
        actor_level = await get_admin_role_level(db, actor)
        if role.level >= actor_level:
            raise HTTPException(status_code=403, detail="cannot_assign_role_at_or_above_yours")
    return role


@router.get("/users")
async def list_users(
    admin: AdminUser = Depends(require_permission(Permission.USERS_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    Creator = aliased(AdminUser)
    result = await db.execute(
        select(AdminUser, Creator, AdminRoleModel)
        .outerjoin(Creator, AdminUser.created_by == Creator.id)
        .outerjoin(AdminRoleModel, AdminUser.role_id == AdminRoleModel.id)
        .order_by(AdminUser.created_at)
    )
    users = result.all()
    return {"items": [_user_to_dict(u, creator=c, role_row=r) for u, c, r in users]}


@router.post("/users/create")
async def create_user(
    body: CreateUserRequest,
    request: Request,
    admin: AdminUser = Depends(require_permission(Permission.USERS_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    # Check username uniqueness
    existing = await db.execute(select(AdminUser.id).where(AdminUser.username == body.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="username_taken")

    # Check email uniqueness
    if body.email:
        existing_email = await db.execute(select(AdminUser.id).where(AdminUser.email == body.email))
        if existing_email.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="email_taken")

    role = await _resolve_assignable_role(db, body.role, admin)

    new_user = AdminUser(
        username=body.username,
        display_name=body.display_name,
        email=body.email,
        password_hash=hash_password(body.password),
        role_id=role.id,
        role=role.name,
        status=AdminStatus.active,
        telegram_chat_id=body.telegram_chat_id,
        created_by=admin.id,
    )
    db.add(new_user)
    try:
        await db.flush()
        _audit(db, AuditEvent.admin_created, actor_id=admin.id, target_id=new_user.id,
               ip=_client_ip(request),
               meta={"target_username": new_user.username, "role": role.name})
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        logger.error("admin_user_create_conflict",
                     username=body.username,
                     error=str(exc.__cause__ or exc))
        raise HTTPException(status_code=409, detail="username_taken")

    return _user_to_dict(new_user, creator=admin, role_row=role)


@router.get("/users/check-availability")
async def check_user_availability(
    username: str | None = None,
    email: str | None = None,
    admin: AdminUser = Depends(require_permission(Permission.USERS_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    response: dict = {}

    if username is not None:
        candidate = username.strip()
        taken = False
        suggestions: list[str] = []
        if len(candidate) >= 3:
            row = await db.execute(
                select(AdminUser.id).where(AdminUser.username == candidate)
            )
            taken = row.scalar_one_or_none() is not None
            if taken:
                base = re.sub(r"[^a-zA-Z0-9._-]", "", candidate)[:56] or "user"
                for n in range(1, 31):
                    if len(suggestions) >= 3:
                        break
                    probe = f"{base}{n}"
                    exists = await db.execute(
                        select(AdminUser.id).where(AdminUser.username == probe)
                    )
                    if exists.scalar_one_or_none() is None:
                        suggestions.append(probe)
        response["username"] = {
            "available": len(candidate) >= 3 and not taken,
            "taken": taken,
            "suggestions": suggestions,
        }

    if email is not None:
        candidate = email.strip()
        if candidate:
            row = await db.execute(
                select(AdminUser.id).where(AdminUser.email == candidate)
            )
            email_taken = row.scalar_one_or_none() is not None
            response["email"] = {
                "available": not email_taken,
                "taken": email_taken,
            }

    return response


@router.get("/users/{user_id}")
async def get_user(
    user_id: str,
    admin: AdminUser = Depends(require_permission(Permission.USERS_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    Creator = aliased(AdminUser)
    result = await db.execute(
        select(AdminUser, Creator, AdminRoleModel)
        .outerjoin(Creator, AdminUser.created_by == Creator.id)
        .outerjoin(AdminRoleModel, AdminUser.role_id == AdminRoleModel.id)
        .where(AdminUser.id == UUID(user_id))
    )
    row = result.first()
    if not row:
        raise HTTPException(404, "user_not_found")
    user, creator, role_row = row
    return _user_to_dict(user, creator=creator, role_row=role_row)


@router.put("/users/{user_id}")
async def update_user(
    user_id: str,
    body: UpdateUserRequest,
    request: Request,
    admin: AdminUser = Depends(require_permission(Permission.USERS_UPDATE)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AdminUser).where(AdminUser.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "user_not_found")

    editing_self = user.id == admin.id

    if body.role is not None:
        # Role changes always go through the hierarchy gate (blocks self-edit too).
        await assert_can_manage(db, admin, user)
        role = await _resolve_assignable_role(db, body.role, admin)

        # Prevent removing last owner
        if user.role == "owner" and body.role != "owner":
            owner_count = await db.execute(
                select(func.count(AdminUser.id)).where(
                    AdminUser.role == "owner",
                    AdminUser.status == AdminStatus.active,
                )
            )
            if owner_count.scalar() <= 1:
                raise HTTPException(400, "cannot_remove_last_owner")

        user.role = role.name
        user.role_id = role.id
    elif not editing_self:
        # Profile edits on other users still respect the hierarchy.
        await assert_can_manage(db, admin, user)

    if body.display_name is not None:
        user.display_name = body.display_name

    if body.email is not None:
        if body.email != (user.email or ""):
            clash = await db.execute(
                select(AdminUser.id).where(
                    AdminUser.email == body.email,
                    AdminUser.id != user.id,
                )
            )
            if clash.scalar_one_or_none():
                raise HTTPException(status_code=409, detail="email_taken")
        user.email = body.email or None

    if body.telegram_chat_id is not None:
        user.telegram_chat_id = body.telegram_chat_id

    _audit(db, AuditEvent.admin_updated, actor_id=admin.id, target_id=user.id,
           ip=_client_ip(request),
           meta={"target_username": user.username})

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        logger.error("admin_user_update_conflict",
                     target=str(user.id), error=str(exc.__cause__ or exc))
        raise HTTPException(status_code=409, detail="email_taken")

    return _user_to_dict(user)


@router.post("/users/{user_id}/disable")
async def disable_user(
    user_id: str,
    request: Request,
    admin: AdminUser = Depends(require_permission(Permission.USERS_DISABLE)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AdminUser).where(AdminUser.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "user_not_found")

    await assert_can_manage(db, admin, user)

    # Prevent disabling last owner
    if user.role == "owner":
        owner_count = await db.execute(
            select(func.count(AdminUser.id)).where(
                AdminUser.role == "owner",
                AdminUser.status == AdminStatus.active,
            )
        )
        if owner_count.scalar() <= 1:
            raise HTTPException(400, "cannot_disable_last_owner")

    user.status = AdminStatus.disabled

    # Mark all sessions as revoked
    from app.models import AdminSession
    from sqlalchemy import update
    await db.execute(
        update(AdminSession)
        .where(AdminSession.admin_id == user.id, AdminSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )

    _audit(db, AuditEvent.admin_disabled, actor_id=admin.id, target_id=user.id,
           ip=_client_ip(request),
           meta={"target_username": user.username})

    await db.commit()
    return {"status": "disabled"}


@router.post("/users/{user_id}/enable")
async def enable_user(
    user_id: str,
    request: Request,
    admin: AdminUser = Depends(require_permission(Permission.USERS_DISABLE)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AdminUser).where(AdminUser.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "user_not_found")

    await assert_can_manage(db, admin, user)

    user.status = AdminStatus.active

    _audit(db, AuditEvent.admin_updated, actor_id=admin.id, target_id=user.id,
           ip=_client_ip(request),
           meta={"target_username": user.username, "action": "enabled"})

    await db.commit()
    return {"status": "enabled"}


@router.post("/users/{user_id}/unlock")
async def unlock_user(
    user_id: str,
    request: Request,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    actor_level = await get_admin_role_level(db, admin)
    if actor_level is None or actor_level < 60:
        raise HTTPException(403, "unlock_requires_top_three_ranks")

    result = await db.execute(select(AdminUser).where(AdminUser.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "user_not_found")

    was_locked = bool(user.locked_until) or (user.failed_login_count or 0) > 0
    user.locked_until = None
    user.failed_login_count = 0

    from app.security.devices import log_security_event
    from app.models import SecurityEventType
    await log_security_event(
        db, SecurityEventType.account_unlocked, severity="medium",
        admin_id=user.id,
        ip_address=_client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
        path=request.url.path, method="POST",
        reason=f"Suspension revoked by {admin.username}",
        metadata={
            "actor_admin_id": str(admin.id),
            "actor_username": admin.username,
            "target_username": user.username,
            "was_locked": was_locked,
        },
    )

    _audit(db, AuditEvent.admin_updated, actor_id=admin.id, target_id=user.id,
           ip=_client_ip(request),
           meta={"target_username": user.username, "action": "unlocked"})

    await db.commit()
    return {"status": "unlocked", "was_locked": was_locked}


@router.post("/users/{user_id}/revoke-sessions")
async def revoke_sessions(
    user_id: str,
    request: Request,
    admin: AdminUser = Depends(require_permission(Permission.USERS_DISABLE)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AdminUser).where(AdminUser.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "user_not_found")

    await assert_can_manage(db, admin, user)

    from app.models import AdminSession
    from sqlalchemy import update
    await db.execute(
        update(AdminSession)
        .where(AdminSession.admin_id == user.id, AdminSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )

    _audit(db, AuditEvent.admin_updated, actor_id=admin.id, target_id=user.id,
           ip=_client_ip(request),
           meta={"target_username": user.username, "action": "sessions_revoked"})

    await db.commit()
    return {"status": "sessions_revoked"}


@router.post("/users/{user_id}/reset-password")
async def reset_password(
    user_id: str,
    body: ResetPasswordRequest,
    request: Request,
    admin: AdminUser = Depends(require_permission(Permission.USERS_RESET_PASSWORD)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AdminUser).where(AdminUser.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "user_not_found")

    await assert_can_manage(db, admin, user)

    user.password_hash = hash_password(body.new_password)
    user.password_changed_at = datetime.now(timezone.utc)

    # Revoke all sessions
    from app.models import AdminSession
    from sqlalchemy import update
    await db.execute(
        update(AdminSession)
        .where(AdminSession.admin_id == user.id, AdminSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )

    _audit(db, AuditEvent.password_changed, actor_id=admin.id, target_id=user.id,
           ip=_client_ip(request),
           meta={"target_username": user.username})

    await db.commit()
    return {"status": "password_reset"}


# Compatibility alias
@router.get("/admin-users")
async def list_users_compat(
    admin: AdminUser = Depends(require_permission(Permission.USERS_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    return await list_users(admin=admin, db=db)


# Roles
@router.get("/roles")
async def list_roles(
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    user_counts = (
        select(AdminUser.role_id.label("role_id"), func.count().label("cnt"))
        .group_by(AdminUser.role_id)
        .subquery()
    )
    result = await db.execute(
        select(AdminRoleModel, func.coalesce(user_counts.c.cnt, 0))
        .outerjoin(user_counts, user_counts.c.role_id == AdminRoleModel.id)
        .order_by(AdminRoleModel.level.desc(), AdminRoleModel.name)
    )
    roles = result.all()

    items = []
    for role, user_count in roles:
        perm_result = await db.execute(
            select(AdminPermission.key)
            .join(AdminRolePermission, AdminRolePermission.permission_id == AdminPermission.id)
            .where(AdminRolePermission.role_id == role.id)
        )
        perms = [row[0] for row in perm_result.all()]
        items.append({
            "id": str(role.id),
            "name": role.name,
            "description": role.description,
            "is_system": role.is_system,
            "level": role.level,
            "user_count": int(user_count),
            "permissions": perms,
        })
    return {"items": items}


@router.post("/roles")
async def create_role(
    body: CreateRoleRequest,
    request: Request,
    admin: AdminUser = Depends(require_permission(Permission.ROLES_MANAGE)),
    db: AsyncSession = Depends(get_db),
):
    name = body.name.strip().lower()
    if not _ROLE_NAME_RE.match(name):
        raise HTTPException(400, "invalid_role_name")
    if name in _RESERVED_ROLE_NAMES:
        raise HTTPException(400, "reserved_role_name")

    dup = await db.execute(select(AdminRoleModel.id).where(AdminRoleModel.name == name))
    if dup.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="role_name_taken")

    if admin.role != "owner":
        actor_level = await get_admin_role_level(db, admin)
        if body.level >= actor_level:
            raise HTTPException(status_code=403, detail="role_level_above_yours")

    perm_keys = sorted(set(body.permissions))
    perm_rows: list[AdminPermission] = []
    if perm_keys:
        perm_result = await db.execute(
            select(AdminPermission).where(AdminPermission.key.in_(perm_keys))
        )
        perm_rows = list(perm_result.scalars().all())
    if len(perm_rows) != len(perm_keys):
        raise HTTPException(400, "unknown_permission")

    new_role = AdminRoleModel(
        name=name,
        description=body.description,
        is_system=False,
        level=body.level,
    )
    db.add(new_role)
    try:
        await db.flush()
        for perm in perm_rows:
            db.add(AdminRolePermission(role_id=new_role.id, permission_id=perm.id))
        _audit(db, AuditEvent.role_created, actor_id=admin.id,
               ip=_client_ip(request),
               meta={"name": name, "level": body.level})
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        logger.error("role_create_conflict", name=name, error=str(exc.__cause__ or exc))
        raise HTTPException(status_code=409, detail="role_name_taken")

    return {
        "id": str(new_role.id),
        "name": new_role.name,
        "description": new_role.description,
        "is_system": new_role.is_system,
        "level": new_role.level,
        "permissions": [perm.key for perm in perm_rows],
    }


@router.delete("/roles/{role_id}")
async def delete_role(
    role_id: str,
    request: Request,
    admin: AdminUser = Depends(require_permission(Permission.ROLES_MANAGE)),
    db: AsyncSession = Depends(get_db),
):
    try:
        rid = UUID(role_id)
    except ValueError:
        raise HTTPException(400, "invalid_role_id")

    result = await db.execute(select(AdminRoleModel).where(AdminRoleModel.id == rid))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(404, "role_not_found")
    if role.is_system:
        raise HTTPException(403, "system_role_protected")

    in_use = await db.execute(
        select(func.count(AdminUser.id)).where(AdminUser.role_id == rid)
    )
    if in_use.scalar() > 0:
        raise HTTPException(status_code=409, detail="role_in_use")

    await db.execute(delete(AdminRolePermission).where(AdminRolePermission.role_id == rid))
    await db.delete(role)
    _audit(db, AuditEvent.role_deleted, actor_id=admin.id,
           ip=_client_ip(request),
           meta={"name": role.name})
    await db.commit()
    return {"status": "role_deleted"}


@router.get("/permissions")
async def list_permissions(
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AdminPermission).order_by(AdminPermission.category, AdminPermission.key))
    perms = result.scalars().all()
    return {
        "items": [
            {"id": str(p.id), "key": p.key, "description": p.description, "category": p.category}
            for p in perms
        ]
    }
```

```python
// File: backend\app\api\auth.py
import structlog
from datetime import datetime, timedelta, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import JSONResponse
from starlette.websockets import WebSocketDisconnect
from app.security.csrf import issue_csrf_cookie
from app.security.turnstile import verify_turnstile, captcha_accepted
from app.db import get_db
from app.models import (
    AdminUser, AdminStatus, AuthChallenge, OtpPurpose, OtpDelivery,
    AuditEvent, AuditLog, Device,
)
from app.config import get_settings
from app.models_rbac import AdminRole as AdminRoleModel
from app.security.passwords import hash_password, verify_password
from app.security.password_policy import (
    PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, validate_password_strength,
)
from app.security.sessions import create_session, revoke_session
from app.security.encryption import new_encryption_keypair, decrypt_password
from app.security.tokens import (
    create_access_token, create_refresh_token, rotate_refresh_token,
    revoke_refresh_token, block_access_token_jti, create_ws_ticket,
    verify_access_token, verify_ws_ticket,
    create_exchange_code, verify_exchange_code,
    consume_exchange_code, TokenError, TokenReuseDetected,
)
from app.security.rate_limit import (
    login_ip_limiter, login_user_limiter, otp_send_limiter,
    otp_verify_limiter, totp_verify_limiter, setup_limiter,
    forgot_verify_limiter, forgot_reset_limiter,
    RedisBlocklist,
)
from app.security.devices import (
    identify_or_create_device, create_trust, verify_trust,
    count_active_trusted_devices, log_security_event,
)
from app.security.risk import RiskSignals, calculate_risk
from app.security.bot_detection import analyze_request_signals
from app.services.otp_service import (
    create_challenge, get_challenge, set_otp_on_challenge,
    verify_otp, consume_challenge, generate_otp, can_resend_otp,
)
from app.services.totp_service import verify_totp, generate_secret, encrypt_secret
from app.services.telegram_service import send_otp
from app.api.deps import (
    get_current_admin,
    get_current_admin_with_session,
    get_admin_role_level,
)

settings = get_settings()
logger = structlog.get_logger()
router = APIRouter(prefix="/admin/api/auth", tags=["auth"])
# WebSocket auth channel lives OUTSIDE the /admin/api/* prefix so it is not
# caught by DirectAccessGuard (which requires X-Forwarded-By: pages-proxy —
# a header browsers cannot set on a WebSocket handshake).
ws_router = APIRouter(tags=["auth-ws"])

_DUMMY_PASSWORD_HASH = hash_password("::timing-equalizer::")


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str | None = Field(default=None, min_length=1, max_length=256)
    password_cipher: str | None = None
    key_id: str | None = None
    remember_me: bool = False
    legacy_plaintext: bool = False
    turnstile_token: str | None = None

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        return v.strip()

    @field_validator("password", "password_cipher", "key_id")
    @classmethod
    def strip_optionals(cls, v):
        if v is None:
            return v
        return v.strip()


class PublicKeyResponse(BaseModel):
    key_id: str
    public_key: str


class ExchangeRequest(BaseModel):
    exchange_code: str = Field(min_length=8, max_length=2048)


class WebSocketAuthMessage(BaseModel):
    action: str
    method: str | None = None
    code: str | None = None


class SetupRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)
    email: str | None = None
    display_name: str = Field(min_length=1, max_length=160)

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        return v.strip()

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return validate_password_strength(v)


class LoginOtpVerifyRequest(BaseModel):
    challenge_id: str
    code: str = Field(min_length=4, max_length=8)
    remember_me: bool = False


class LoginTotpRequest(BaseModel):
    challenge_id: str
    code: str = Field(min_length=6, max_length=6)
    remember_me: bool = False

    @field_validator("code")
    @classmethod
    def validate_totp_code(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("TOTP code must be 6 digits")
        return v


class ForgotVerifyRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    totp_code: str = Field(min_length=6, max_length=6)

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        return v.strip()


class ForgotResetRequest(BaseModel):
    challenge_id: str
    new_password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return validate_password_strength(v)


class TrustDeviceRequest(BaseModel):
    trust: bool = True


def _audit(db: AsyncSession, event: AuditEvent, admin_id=None, ip=None, ua=None, meta=None):
    db.add(AuditLog(
        event=event,
        actor_admin_id=admin_id,
        ip_address=ip,
        user_agent=ua,
        metadata_=meta or {},
    ))


def _get_lockout_duration(failed_count: int) -> timedelta:
    if failed_count >= settings.MAX_LOGIN_ATTEMPTS:
        return timedelta(minutes=settings.LOCKOUT_MINUTES)
    elif failed_count >= settings.LOCKOUT_SHORT_THRESHOLD:
        return timedelta(seconds=settings.LOCKOUT_SHORT_SECONDS)
    return timedelta(seconds=0)


@router.get("/setup-required")
async def setup_required(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(func.count(AdminUser.id)))
    count = result.scalar()
    return {"required": count == 0}


@router.post("/setup-create")
async def setup_create(body: SetupRequest, request: Request, db: AsyncSession = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"

    allowed, retry_after = await setup_limiter.check_and_record(ip)
    if not allowed:
        raise HTTPException(429, detail={
            "detail": "Too many setup attempts. Please wait before trying again.",
            "type": "rate_limited",
            "retry_after": int(retry_after),
        })

    result = await db.execute(select(func.count(AdminUser.id)))
    count = result.scalar()
    if count > 0:
        raise HTTPException(400, "admins_exist")

    # admin_users.role_id is NOT NULL (002_rbac): resolve or bootstrap the
    # owner role so first-run setup works on a freshly migrated database.
    role_result = await db.execute(
        select(AdminRoleModel).where(AdminRoleModel.name == "owner")
    )
    owner_role = role_result.scalar_one_or_none()
    if not owner_role:
        owner_role = AdminRoleModel(
            name="owner",
            description="Full system access",
            is_system=True,
            level=100,
        )
        db.add(owner_role)
        await db.flush()

    admin = AdminUser(
        username=body.username,
        email=body.email,
        display_name=body.display_name,
        password_hash=hash_password(body.password),
        role="owner",
        role_id=owner_role.id,
        status=AdminStatus.active,
    )
    db.add(admin)
    await db.flush()

    device_token = request.cookies.get(settings.device_cookie_name)
    device, is_new, new_device_token = await identify_or_create_device(
        db, device_token, admin.id,
        ip, request.headers.get("user-agent"),
    )

    token = await create_session(
        db, admin.id, ip,
        request.headers.get("user-agent"),
        device_id=device.id,
    )

    resp = JSONResponse(content={
        "status": "ok",
        "admin": {"id": str(admin.id), "username": admin.username},
    })
    resp.set_cookie(
        "vks_session", token,
        httponly=True, secure=settings.cookie_secure, samesite="lax",
        max_age=12 * 3600,
        path="/",
    )
    issue_csrf_cookie(resp)
    resp.set_cookie(
        settings.device_cookie_name, new_device_token,
        httponly=True, secure=settings.cookie_secure, samesite="lax",
        max_age=365 * 24 * 3600,
        path="/",
    )
    return resp


@router.post("/login")
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "")
    path = request.url.path

    if await RedisBlocklist.is_blocked(f"ip:{ip}"):
        raise HTTPException(429, detail={
            "detail": "Your IP has been temporarily blocked due to suspicious activity.",
            "type": "ip_blocked",
            "retry_after": await RedisBlocklist.get_block_ttl(f"ip:{ip}"),
        })

    allowed, retry_after = await login_ip_limiter.check_and_record(ip)
    if not allowed:
        await log_security_event(
            db, "rate_limited", "medium",
            ip_address=ip, user_agent=ua, path=path, method="POST",
            reason=f"Login IP rate limited: {ip}",
        )
        raise HTTPException(429, detail={
            "detail": "Too many login attempts from this IP. Please wait before trying again.",
            "type": "rate_limited",
            "retry_after": int(retry_after),
        })

    allowed_user, retry_user = await login_user_limiter.check_and_record(body.username)
    if not allowed_user:
        raise HTTPException(429, detail={
            "detail": "Too many failed attempts for this account. Please wait before trying again.",
            "type": "rate_limited",
            "retry_after": int(retry_user),
        })

    # Turnstile CAPTCHA: verify before any DB/RSA work so bots are cheaply
    # rejected. Fail-closed — unlike the rate limiters, an invalid or missing
    # token is a hard 403, never a soft pass.
    if settings.TURNSTILE_ENABLED:
        ts_result = await verify_turnstile(
            body.turnstile_token or "", ip, action=settings.TURNSTILE_EXPECTED_ACTION
        )
        if not captcha_accepted(
            ts_result, ip, expected_action=settings.TURNSTILE_EXPECTED_ACTION
        ):
            await log_security_event(
                db, "login_failure", "medium",
                ip_address=ip, user_agent=ua, path=path, method="POST",
                reason=f"Turnstile rejected: {ts_result.get('error-codes', 'unknown')}",
            )
            raise HTTPException(403, detail={
                "detail": "Security verification failed. Please refresh and try again.",
                "type": "captcha_failed",
            })

    stmt = select(AdminUser).where(AdminUser.username == body.username)
    result = await db.execute(stmt)
    admin = result.scalar_one_or_none()

    # Resolve the plaintext password. New clients encrypt it with the
    # ephemeral RSA key (password_cipher + key_id). Legacy clients send
    # it as plaintext (password + legacy_plaintext) to preserve
    # backward compatibility during migration.
    plain_password: str | None = None
    if body.password_cipher and body.key_id:
        try:
            plain_password = await decrypt_password(body.key_id, body.password_cipher)
        except ValueError:
            plain_password = None
    elif body.legacy_plaintext and body.password:
        plain_password = body.password

    if not admin or not plain_password or not verify_password(plain_password, admin.password_hash):
        if not admin:
            verify_password(plain_password or body.password or "", _DUMMY_PASSWORD_HASH)
        if admin:
            admin.failed_login_count += 1
            lockout_dur = _get_lockout_duration(admin.failed_login_count)
            if lockout_dur > timedelta(seconds=0):
                admin.locked_until = datetime.now(timezone.utc) + lockout_dur
                await log_security_event(
                    db, "login_lockout", "high",
                    admin_id=admin.id, ip_address=ip, user_agent=ua,
                    path=path, method="POST",
                    reason=f"Account locked after {admin.failed_login_count} failures",
                    metadata={"failed_count": admin.failed_login_count, "lockout_seconds": int(lockout_dur.total_seconds())},
                )
            await db.commit()
        _audit(db, AuditEvent.login_failure, admin_id=admin.id if admin else None, ip=ip, ua=ua)
        await log_security_event(
            db, "login_failure", "medium",
            admin_id=admin.id if admin else None,
            ip_address=ip, user_agent=ua, path=path, method="POST",
            reason=f"Failed login for {body.username}",
        )
        raise HTTPException(401, "invalid_credentials")

    if admin.status != AdminStatus.active:
        raise HTTPException(403, "account_disabled")

    now = datetime.now(timezone.utc)
    if admin.locked_until and admin.locked_until > now:
        remaining = int((admin.locked_until - now).total_seconds())
        await log_security_event(
            db, "login_lockout", "high",
            admin_id=admin.id, ip_address=ip, user_agent=ua,
            path=path, method="POST",
            reason="Login attempt on locked account",
            metadata={"remaining_seconds": remaining},
        )
        raise HTTPException(423, detail={
            "detail": (
                f"Account temporarily suspended due to repeated failed password attempts. "
                f"Try again in {max(remaining // 60, 1)} minute(s), or contact an administrator "
                f"to restore access sooner."
            ),
            "type": "account_locked",
            "retry_after": remaining,
        })

    admin.failed_login_count = 0
    admin.locked_until = None
    await db.commit()

    device_token = request.cookies.get(settings.device_cookie_name)
    device, is_new, new_device_token = await identify_or_create_device(
        db, device_token, admin.id,
        ip, ua,
    )

    challenge = await create_challenge(db, admin.id)
    telegram_otp = settings.TELEGRAM_OTP_ENABLED and admin.telegram_chat_id
    methods = []
    if telegram_otp:
        methods.append("telegram_otp")
    if admin.totp_enabled:
        methods.append("totp")

    if telegram_otp:
        otp_code = generate_otp(settings.TELEGRAM_OTP_LENGTH)
        sent = await send_otp(admin.telegram_chat_id, otp_code)
        if sent:
            await set_otp_on_challenge(db, challenge.id, otp_code, OtpDelivery.telegram)

    _audit(db, AuditEvent.login_success, admin_id=admin.id, ip=ip, ua=ua)
    await log_security_event(
        db, "login_success", "low",
        admin_id=admin.id, device_id=device.id,
        ip_address=ip, user_agent=ua, path=path, method="POST",
        reason="Password verified, awaiting second factor",
    )

    admin.last_login_at = now
    await db.commit()

    return {
        "status": "second_factor_required",
        "challenge_id": str(challenge.id),
        "methods": methods,
        "remember_me": body.remember_me,
        "ws_ticket": create_ws_ticket(str(challenge.id)),
    }


@router.post("/login-otp-send")
async def login_otp_send(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.json()
    challenge_id = body.get("challenge_id")
    if not challenge_id:
        raise HTTPException(400, "challenge_id_required")

    ip = request.client.host if request.client else "unknown"

    allowed, retry_after = await otp_send_limiter.check_and_record(f"otp:{challenge_id}")
    if not allowed:
        raise HTTPException(429, detail={
            "detail": "Please wait before requesting a new code.",
            "type": "resend_cooldown",
            "retry_after": int(retry_after),
        })

    challenge = await get_challenge(db, UUID(challenge_id))
    if not challenge:
        raise HTTPException(400, "invalid_challenge")

    admin = (await db.execute(select(AdminUser).where(AdminUser.id == challenge.admin_id))).scalar_one_or_none()
    if not admin or not admin.telegram_chat_id:
        raise HTTPException(400, "telegram_not_configured")

    can_send, wait = await can_resend_otp(db, challenge.id, settings.TELEGRAM_OTP_RESEND_SECONDS)
    if not can_send:
        raise HTTPException(429, detail={
            "detail": "Please wait before requesting a new code.",
            "type": "resend_cooldown",
            "retry_after": int(wait),
        })

    otp_code = generate_otp(settings.TELEGRAM_OTP_LENGTH)
    sent = await send_otp(admin.telegram_chat_id, otp_code)
    if not sent:
        raise HTTPException(502, "telegram_send_failed")

    await set_otp_on_challenge(db, challenge.id, otp_code, OtpDelivery.telegram)
    _audit(db, AuditEvent.otp_sent, admin_id=admin.id, ip=ip)
    await db.commit()

    return {"status": "sent", "cooldown_seconds": settings.TELEGRAM_OTP_RESEND_SECONDS}


@router.post("/login-otp-verify")
async def login_otp_verify(body: LoginOtpVerifyRequest, request: Request, db: AsyncSession = Depends(get_db)):
    challenge = await get_challenge(db, UUID(body.challenge_id))
    if not challenge:
        raise HTTPException(400, "invalid_challenge")

    ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "")

    allowed, retry_after = await otp_verify_limiter.check_and_record(f"otp_verify:{body.challenge_id}")
    if not allowed:
        raise HTTPException(429, detail={
            "detail": "Too many verification attempts. Please wait before trying again.",
            "type": "verify_cooldown",
            "retry_after": int(retry_after),
        })

    valid = await verify_otp(db, challenge.id, body.code)
    if not valid:
        await log_security_event(
            db, "otp_failure", "medium",
            admin_id=challenge.admin_id, ip_address=ip, user_agent=ua,
            reason="Invalid OTP code",
        )
        raise HTTPException(401, "invalid_otp")

    admin = (await db.execute(select(AdminUser).where(AdminUser.id == challenge.admin_id))).scalar_one_or_none()

    device_token = request.cookies.get(settings.device_cookie_name)
    device, is_new, new_device_token = await identify_or_create_device(
        db, device_token, admin.id, ip, ua,
    )

    if admin.totp_enabled:
        return {"status": "totp_required", "challenge_id": str(challenge.id)}

    await consume_challenge(db, challenge.id)
    token = await create_session(
        db, admin.id, ip, ua, body.remember_me, device_id=device.id,
    )
    _audit(db, AuditEvent.otp_verified, admin_id=admin.id, ip=ip)
    await log_security_event(
        db, "session_created", "low",
        admin_id=admin.id, device_id=device.id,
        ip_address=ip, user_agent=ua,
        reason="Session created after OTP verification",
    )

    resp = JSONResponse(content={
        "status": "ok",
        "admin": {"id": str(admin.id), "username": admin.username, "role": admin.role},
    })
    resp.set_cookie(
        "vks_session", token,
        httponly=True, secure=settings.cookie_secure, samesite="lax",
        max_age=12 * 3600 if body.remember_me else 2 * 3600,
        path="/",
    )
    issue_csrf_cookie(resp)
    resp.set_cookie(
        settings.device_cookie_name, new_device_token,
        httponly=True, secure=settings.cookie_secure, samesite="lax",
        max_age=365 * 24 * 3600,
        path="/",
    )
    return resp


@router.post("/login-totp")
async def login_totp(body: LoginTotpRequest, request: Request, db: AsyncSession = Depends(get_db)):
    challenge = await get_challenge(db, UUID(body.challenge_id))
    if not challenge:
        raise HTTPException(400, "invalid_challenge")
    if not challenge.otp_verified_at:
        raise HTTPException(400, "otp_not_verified")

    ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "")

    allowed, retry_after = await totp_verify_limiter.check_and_record(f"totp:{challenge.admin_id}")
    if not allowed:
        raise HTTPException(429, detail={
            "detail": "Too many verification attempts. Please wait before trying again.",
            "type": "verify_cooldown",
            "retry_after": int(retry_after),
        })

    admin = (await db.execute(select(AdminUser).where(AdminUser.id == challenge.admin_id))).scalar_one_or_none()
    if not admin or not admin.totp_enabled or not admin.totp_secret_ciphertext:
        raise HTTPException(400, "totp_not_enabled")

    from app.services.totp_service import decrypt_secret
    secret = decrypt_secret(admin.totp_secret_ciphertext)
    if not verify_totp(secret, body.code):
        challenge.totp_attempts += 1
        await db.commit()
        await log_security_event(
            db, "totp_failure", "medium",
            admin_id=admin.id, ip_address=ip, user_agent=ua,
            reason="Invalid TOTP code",
        )
        raise HTTPException(401, "invalid_totp")

    device_token = request.cookies.get(settings.device_cookie_name)
    device, is_new, new_device_token = await identify_or_create_device(
        db, device_token, admin.id, ip, ua,
    )

    await consume_challenge(db, challenge.id)
    token = await create_session(
        db, admin.id, ip, ua, body.remember_me, device_id=device.id,
    )
    _audit(db, AuditEvent.totp_verified, admin_id=admin.id, ip=ip)
    await log_security_event(
        db, "session_created", "low",
        admin_id=admin.id, device_id=device.id,
        ip_address=ip, user_agent=ua,
        reason="Session created after TOTP verification",
    )

    resp = JSONResponse(content={
        "status": "ok",
        "admin": {"id": str(admin.id), "username": admin.username, "role": admin.role},
    })
    resp.set_cookie(
        "vks_session", token,
        httponly=True, secure=settings.cookie_secure, samesite="lax",
        max_age=12 * 3600 if body.remember_me else 2 * 3600,
        path="/",
    )
    issue_csrf_cookie(resp)
    resp.set_cookie(
        settings.device_cookie_name, new_device_token,
        httponly=True, secure=settings.cookie_secure, samesite="lax",
        max_age=365 * 24 * 3600,
        path="/",
    )
    return resp


@router.post("/trust-device")
async def trust_device_endpoint(
    body: TrustDeviceRequest,
    request: Request,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "")

    device_token = request.cookies.get(settings.device_cookie_name)
    if not device_token:
        raise HTTPException(400, "no_device_cookie")

    from app.security.devices import get_device_by_token
    device = await get_device_by_token(db, device_token)
    if not device or device.admin_id != admin.id:
        raise HTTPException(404, "device_not_found")

    if body.trust:
        count = await count_active_trusted_devices(db, admin.id)
        if count >= settings.MAX_TRUSTED_DEVICES:
            raise HTTPException(400, "max_trusted_devices_reached")

        trust_secret, trust = await create_trust(db, device.id, admin.id, ip, ua)
        await log_security_event(
            db, "device_trusted", "low",
            admin_id=admin.id, device_id=device.id,
            ip_address=ip, user_agent=ua,
            reason="Device trusted by user",
        )

        resp = JSONResponse(content={"status": "trusted", "device_id": str(device.id)})
        resp.set_cookie(
            settings.trusted_device_cookie_name, trust_secret,
            httponly=True, secure=settings.cookie_secure, samesite="lax",
            max_age=settings.TRUST_EXPIRY_DAYS * 24 * 3600,
            path="/",
        )
        return resp
    else:
        from app.security.devices import revoke_all_trust_for_device
        await revoke_all_trust_for_device(db, device.id)
        resp = JSONResponse(content={"status": "trust_removed"})
        resp.delete_cookie(settings.trusted_device_cookie_name, path="/")
        return resp


@router.get("/session")
async def get_session(
    deps: tuple = Depends(get_current_admin_with_session),
    db: AsyncSession = Depends(get_db),
):
    admin, session = deps
    now = datetime.now(timezone.utc)

    if session is not None and session.absolute_expires_at is not None and session.created_at is not None:
        remember_me = (session.absolute_expires_at - session.created_at) > timedelta(hours=6)
    else:
        remember_me = True

    return {
        "id": str(admin.id),
        "username": admin.username,
        "email": admin.email,
        "display_name": admin.display_name,
        "role": admin.role,
        "role_level": await get_admin_role_level(db, admin),
        "totp_enabled": admin.totp_enabled,
        "telegram_chat_id": admin.telegram_chat_id,
        "session": {
            "created_at": session.created_at.isoformat() if session and session.created_at else None,
            "expires_at": session.expires_at.isoformat() if session and session.expires_at else None,
            "absolute_expires_at": (
                session.absolute_expires_at.isoformat()
                if session and session.absolute_expires_at else None
            ),
            "remember_me": remember_me,
            "server_time": now.isoformat(),
        },
    }


@router.post("/logout")
async def logout(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("vks_session")
    refresh_token = request.cookies.get("refresh_token")
    ip = request.client.host if request.client else "unknown"

    if token:
        await revoke_session(db, token)

    if refresh_token:
        await revoke_refresh_token(refresh_token)

    # Block the current access token so it cannot be reused until expiry.
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            claims = verify_access_token(auth_header[7:])
            await block_access_token_jti(claims["jti"])
        except TokenError:
            pass

    _audit(db, AuditEvent.logout, ip=ip)
    await log_security_event(
        db, "session_revoked", "low",
        ip_address=ip, reason="User logout",
    )

    resp = JSONResponse(content={"status": "ok"})
    resp.delete_cookie("vks_session")
    # Clear both the new widened path and the legacy path, so a browser that
    # still holds a cookie issued under the old path is cleaned up too.
    resp.delete_cookie("refresh_token", path="/api/admin/api/auth")
    resp.delete_cookie("refresh_token", path="/api/admin/api/auth/refresh")
    resp.delete_cookie(settings.trusted_device_cookie_name, path="/")
    return resp


@router.get("/public-key")
async def public_key():
    key_id, public_pem = await new_encryption_keypair()
    return PublicKeyResponse(key_id=key_id, public_key=public_pem)


@router.post("/exchange")
async def exchange(body: ExchangeRequest, request: Request, db: AsyncSession = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "")

    try:
        claims = verify_exchange_code(body.exchange_code)
        admin_id = claims["sub"]
        await consume_exchange_code(body.exchange_code)
    except TokenError:
        raise HTTPException(401, "invalid_exchange_code")

    stmt = select(AdminUser).where(AdminUser.id == admin_id)
    admin = (await db.execute(stmt)).scalar_one_or_none()
    if not admin or admin.status != AdminStatus.active:
        raise HTTPException(401, "invalid_exchange_code")

    role_level = await get_admin_role_level(db, admin)

    access_token = create_access_token(
        str(admin.id), admin.username, admin.role, role_level,
    )
    refresh_token, _ = await create_refresh_token(
        str(admin.id), remember_me=True,
    )

    await log_security_event(
        db, "session_created", "low",
        admin_id=admin.id, ip_address=ip, user_agent=ua,
        reason="Session created after WebSocket 2FA verification",
    )

    resp = JSONResponse(content={
        "access_token": access_token,
        "expires_in": settings.JWT_ACCESS_TTL_MINUTES * 60,
        "token_type": "Bearer",
        "admin": {"id": str(admin.id), "username": admin.username, "role": admin.role},
    })
    resp.set_cookie(
        "refresh_token", refresh_token,
        httponly=True, secure=settings.cookie_secure, samesite="strict",
        max_age=settings.JWT_REFRESH_TTL_DAYS * 24 * 3600,
        path="/api/admin/api/auth",
    )
    return resp


@router.post("/refresh")
async def refresh(request: Request):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(401, "refresh_token_required")

    try:
        new_refresh_token, user_id = await rotate_refresh_token(refresh_token)
    except TokenReuseDetected:
        raise HTTPException(401, "refresh_token_reused")
    except TokenError:
        raise HTTPException(401, "refresh_token_invalid")

    from app.db import async_session as _async_session
    async with _async_session() as db:
        stmt = select(AdminUser).where(AdminUser.id == user_id)
        admin = (await db.execute(stmt)).scalar_one_or_none()
        if not admin or admin.status != AdminStatus.active:
            raise HTTPException(401, "admin_disabled")

        role_level = await get_admin_role_level(db, admin)
        access_token = create_access_token(
            str(admin.id), admin.username, admin.role, role_level,
        )

    resp = JSONResponse(content={
        "access_token": access_token,
        "expires_in": settings.JWT_ACCESS_TTL_MINUTES * 60,
        "token_type": "Bearer",
    })
    resp.set_cookie(
        "refresh_token", new_refresh_token,
        httponly=True, secure=settings.cookie_secure, samesite="strict",
        max_age=settings.JWT_REFRESH_TTL_DAYS * 24 * 3600,
        path="/api/admin/api/auth",
    )
    return resp


@ws_router.websocket("/ws/auth")
async def websocket_auth(websocket: WebSocket):
    ticket = websocket.query_params.get("ticket")
    if not ticket:
        await websocket.close(code=4401)
        return

    try:
        claims = verify_ws_ticket(ticket)
    except TokenError:
        await websocket.close(code=4403)
        return

    challenge_id = claims["sub"]
    await websocket.accept()
    await websocket.send_json({"event": "connected", "challenge_id": challenge_id})

    ip = websocket.client.host if websocket.client else "unknown"

    from app.db import async_session as session_factory
    from app.models import AdminUser as AdminUserModel
    from sqlalchemy import select as sselect
    from app.services.otp_service import get_challenge as _get_challenge
    from app.services.totp_service import decrypt_secret as _decrypt_secret

    try:
        while True:
            raw = await websocket.receive()
            if raw.get("type") == "websocket.disconnect":
                break
            if raw.get("type") != "websocket.receive":
                continue
            text = raw.get("text")
            if not text:
                continue
            try:
                import json
                msg = json.loads(text)
            except Exception:
                continue

            action = msg.get("action")
            method = msg.get("method")
            code = msg.get("code")

            if action == "verify" and method and code:
                allowed, _ = await otp_verify_limiter.check_and_record(f"otp_verify:{challenge_id}")
                if not allowed:
                    await websocket.send_json({
                        "event": "error", "code": "rate_limited",
                        "retry_after": 30,
                    })
                    continue

                async with session_factory() as db:
                    challenge = await _get_challenge(db, UUID(challenge_id))
                    if not challenge:
                        await websocket.send_json({"event": "error", "code": "challenge_expired"})
                        continue
                    admin_row = (await db.execute(
                        sselect(AdminUserModel).where(AdminUserModel.id == challenge.admin_id)
                    )).scalar_one_or_none()
                    if not admin_row:
                        await websocket.send_json({"event": "error", "code": "invalid_challenge"})
                        continue

                    if method == "telegram_otp":
                        valid = await verify_otp(db, challenge.id, code)
                        if not valid:
                            await log_security_event(
                                db, "otp_failure", "medium",
                                admin_id=challenge.admin_id, ip_address=ip,
                                reason="Invalid OTP code (WebSocket)",
                            )
                            await websocket.send_json({"event": "error", "code": "invalid_code"})
                            continue
                        if admin_row.totp_enabled:
                            await websocket.send_json({"event": "state", "state": "awaiting_totp"})
                        else:
                            await consume_challenge(db, challenge.id)
                            exchange_code = create_exchange_code(str(admin_row.id))
                            await websocket.send_json({
                                "event": "auth_success",
                                "exchange_code": exchange_code,
                                "admin": {
                                    "id": str(admin_row.id),
                                    "username": admin_row.username,
                                    "role": admin_row.role,
                                },
                            })
                            await websocket.close()
                            break

                    elif method == "totp":
                        if not challenge.otp_verified_at:
                            await websocket.send_json({"event": "error", "code": "otp_not_verified"})
                            continue
                        if not admin_row.totp_enabled or not admin_row.totp_secret_ciphertext:
                            await websocket.send_json({"event": "error", "code": "totp_not_enabled"})
                            continue
                        secret = _decrypt_secret(admin_row.totp_secret_ciphertext)
                        if not verify_totp(secret, code):
                            await log_security_event(
                                db, "totp_failure", "medium",
                                admin_id=admin_row.id, ip_address=ip,
                                reason="Invalid TOTP code (WebSocket)",
                            )
                            await websocket.send_json({"event": "error", "code": "invalid_code"})
                            continue
                        await consume_challenge(db, challenge.id)
                        exchange_code = create_exchange_code(str(admin_row.id))
                        await websocket.send_json({
                            "event": "auth_success",
                            "exchange_code": exchange_code,
                            "admin": {
                                "id": str(admin_row.id),
                                "username": admin_row.username,
                                "role": admin_row.role,
                            },
                        })
                        await websocket.close()
                        break

    except WebSocketDisconnect:
        pass
    except Exception:
        try:
            await websocket.close(code=1011)
        except Exception:
            pass


@router.post("/password/forgot-verify")
async def forgot_verify(body: ForgotVerifyRequest, request: Request, db: AsyncSession = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"

    allowed, retry_after = await forgot_verify_limiter.check_and_record(ip)
    if not allowed:
        raise HTTPException(429, detail={
            "detail": "Too many attempts. Please wait before trying again.",
            "type": "rate_limited",
            "retry_after": int(retry_after),
        })

    stmt = select(AdminUser).where(AdminUser.username == body.username)
    admin = (await db.execute(stmt)).scalar_one_or_none()
    if not admin:
        raise HTTPException(400, "invalid_credentials")
    if not admin.totp_enabled or not admin.totp_secret_ciphertext:
        raise HTTPException(400, "totp_not_configured")

    from app.services.totp_service import decrypt_secret
    secret = decrypt_secret(admin.totp_secret_ciphertext)
    if not verify_totp(secret, body.totp_code):
        raise HTTPException(401, "invalid_totp")

    challenge = await create_challenge(db, admin.id, OtpPurpose.password_reset, ttl_seconds=300)
    return {"status": "verified", "challenge_id": str(challenge.id)}


@router.post("/password/forgot-reset")
async def forgot_reset(body: ForgotResetRequest, request: Request, db: AsyncSession = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"

    allowed, retry_after = await forgot_reset_limiter.check_and_record(ip)
    if not allowed:
        raise HTTPException(429, detail={
            "detail": "Too many attempts. Please wait before trying again.",
            "type": "rate_limited",
            "retry_after": int(retry_after),
        })

    challenge = await get_challenge(db, UUID(body.challenge_id))
    if not challenge or challenge.otp_purpose != OtpPurpose.password_reset:
        raise HTTPException(400, "invalid_challenge")

    admin = (await db.execute(select(AdminUser).where(AdminUser.id == challenge.admin_id))).scalar_one_or_none()
    if not admin:
        raise HTTPException(400, "admin_not_found")

    admin.password_hash = hash_password(body.new_password)
    admin.password_changed_at = datetime.now(timezone.utc)
    await consume_challenge(db, challenge.id)
    _audit(db, AuditEvent.password_changed, admin_id=admin.id)

    from app.security.sessions import revoke_all_sessions
    await revoke_all_sessions(db, admin.id)

    return {"status": "ok"}
```

```python
// File: backend\app\api\deps.py
import hashlib
from uuid import UUID
from fastapi import Request, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.config import get_settings
from app.models import (
    AdminUser, AdminSession, AdminRole as AdminRoleEnum,
    AdminStatus, Device,
)
from app.models_rbac import AdminRole, AdminRolePermission, AdminPermission, Permission
from app.security.sessions import get_session, touch_session
from app.security.tokens import (
    verify_access_token, is_access_token_blocked,
    TokenError,
)

settings = get_settings()


def _extract_bearer_token(request: Request) -> str | None:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


def _extract_device_token(request: Request) -> str | None:
    return request.cookies.get(settings.device_cookie_name)


async def _resolve_admin_from_jwt(request: Request, db: AsyncSession) -> AdminUser | None:
    token = _extract_bearer_token(request)
    if not token:
        return None
    try:
        claims = verify_access_token(token)
    except TokenError:
        return None
    if await is_access_token_blocked(claims["jti"]):
        return None
    stmt = select(AdminUser).where(AdminUser.id == claims["sub"])
    result = await db.execute(stmt)
    admin = result.scalar_one_or_none()
    if not admin or admin.status != AdminStatus.active:
        return None
    return admin


async def _resolve_admin_from_session(request: Request, db: AsyncSession) -> AdminUser | None:
    token = request.cookies.get("vks_session")
    if not token:
        return None
    session = await get_session(db, token)
    if not session:
        return None
    stmt = select(AdminUser).where(AdminUser.id == session.admin_id)
    result = await db.execute(stmt)
    admin = result.scalar_one_or_none()
    if not admin or admin.status != AdminStatus.active:
        return None
    await touch_session(db, session)
    return admin


async def get_current_admin(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AdminUser:
    admin = await _resolve_admin_from_jwt(request, db)
    if admin is None:
        admin = await _resolve_admin_from_session(request, db)
    if admin is None:
        raise HTTPException(status_code=401, detail="not_authenticated")
    return admin


async def get_current_admin_session_row(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AdminSession:
    token = request.cookies.get("vks_session")
    if not token:
        raise HTTPException(status_code=401, detail="not_authenticated")
    session = await get_session(db, token)
    if not session:
        raise HTTPException(status_code=401, detail="session_expired")
    return session


async def get_current_admin_with_session(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> tuple[AdminUser, AdminSession]:
    token = request.cookies.get("vks_session")
    session = None
    if token:
        session = await get_session(db, token)

    if session is None:
        admin = await _resolve_admin_from_jwt(request, db)
        if admin is None:
            raise HTTPException(status_code=401, detail="not_authenticated")
        return admin, None

    stmt = select(AdminUser).where(AdminUser.id == session.admin_id)
    result = await db.execute(stmt)
    admin = result.scalar_one_or_none()
    if not admin or admin.status != AdminStatus.active:
        raise HTTPException(status_code=401, detail="admin_not_found")
    await touch_session(db, session)
    return admin, session


def require_owner(
    admin: AdminUser = Depends(get_current_admin),
) -> AdminUser:
    if admin.role != AdminRoleEnum.owner:
        raise HTTPException(status_code=403, detail="owner_required")
    return admin


def require_manager(
    admin: AdminUser = Depends(get_current_admin),
) -> AdminUser:
    if admin.role not in (AdminRoleEnum.owner, AdminRoleEnum.admin):
        raise HTTPException(status_code=403, detail="manager_required")
    return admin


async def _get_admin_permission_keys(db: AsyncSession, admin: AdminUser) -> set[str]:
    stmt = (
        select(AdminPermission.key)
        .join(AdminRolePermission, AdminRolePermission.permission_id == AdminPermission.id)
        .join(AdminRole, AdminRole.id == AdminRolePermission.role_id)
        .where(AdminRole.id == admin.role_id)
    )
    result = await db.execute(stmt)
    return {row[0] for row in result.all()}


def require_permission(permission_key: str):
    async def _check(
        admin: AdminUser = Depends(get_current_admin),
        db: AsyncSession = Depends(get_db),
    ) -> AdminUser:
        if admin.role == AdminRoleEnum.owner:
            return admin
        perms = await _get_admin_permission_keys(db, admin)
        if permission_key not in perms:
            raise HTTPException(status_code=403, detail=f"permission_denied:{permission_key}")
        return admin
    return _check


async def get_admin_role_level(db: AsyncSession, admin: AdminUser) -> int:
    from app.models_rbac import AdminRole as AdminRoleModel

    if admin.role_id is not None:
        result = await db.execute(
            select(AdminRoleModel.level).where(AdminRoleModel.id == admin.role_id)
        )
        level = result.scalar_one_or_none()
        if level is not None:
            return level
    return 100 if admin.role == AdminRoleEnum.owner else 0


async def assert_can_manage(db: AsyncSession, actor: AdminUser, target: AdminUser) -> int:
    """Hierarchy gate for acting on another user. Owner bypasses; otherwise
    the actor's role level must be strictly above the target's."""
    if target.id == actor.id:
        raise HTTPException(status_code=400, detail="cannot_manage_self")
    if actor.role == AdminRoleEnum.owner:
        return 100

    actor_level = await get_admin_role_level(db, actor)
    target_level = await get_admin_role_level(db, target)
    if actor_level <= target_level:
        raise HTTPException(status_code=403, detail="insufficient_role_rank")
    return actor_level
```

```python
// File: backend\app\api\public_contact.py
import structlog
import secrets
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_db
from app.models import (
    ContactMessage, WebsiteUser, MessageChannel, MessageStatus,
    MessagePriority, MessageAttachment,
)
from app.security.rate_limit import contact_limiter
from app.security.turnstile import captcha_accepted, verify_turnstile
from app.services.storage_service import StorageError, get_storage

logger = structlog.get_logger()
router = APIRouter(prefix="/vks/api/contact", tags=["public"])

MAX_FILES = 5

# Frontend sends "standard"/"urgent"; enum stores low/normal/high/urgent.
_PRIORITY_MAP = {
    "low": "low",
    "standard": "normal",
    "normal": "normal",
    "high": "high",
    "urgent": "urgent",
}


def _generate_reference() -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d")
    rand = secrets.token_hex(4).upper()
    return f"VKS-{ts}-{rand}"


@router.post("")
async def submit_contact(
    request: Request,
    name: str = Form(...),
    email: EmailStr = Form(...),
    phone: Optional[str] = Form(None),
    subject: Optional[str] = Form(None),
    project_type: Optional[str] = Form(None),
    priority: Optional[str] = Form(None),
    message: str = Form(...),
    honeypot: Optional[str] = Form(None),
    turnstile_token: Optional[str] = Form(None),
    documents: List[UploadFile] = File(default=[]),
    db: AsyncSession = Depends(get_db),
):
    if honeypot:
        return {"status": "accepted"}

    settings = get_settings()
    ip = request.client.host if request.client else "unknown"
    allowed, wait = await contact_limiter.check_and_record(f"contact:{ip}")
    if not allowed:
        raise HTTPException(429, "rate_limited")

    # ── Turnstile CAPTCHA ────────────────────────────────────────────
    # Ordered after the honeypot and rate limit (both free) but before any
    # attachment read, storage call or DB work, so a bot is rejected while the
    # request is still cheap. Fail-closed: a missing or invalid token is a hard
    # 403, never a soft pass — same posture as the admin login.
    if settings.TURNSTILE_CONTACT_REQUIRED:
        ts_result = await verify_turnstile(
            turnstile_token or "",
            ip,
            action=settings.TURNSTILE_CONTACT_ACTION,
        )
        if not captcha_accepted(
            ts_result, ip, expected_action=settings.TURNSTILE_CONTACT_ACTION
        ):
            logger.warning(
                "contact_turnstile_rejected",
                ip_address=ip,
                error_codes=ts_result.get("error-codes", "unknown"),
            )
            raise HTTPException(
                403,
                "Security check failed. Please tick the verification box and try again.",
            )

    # ── validate attachments before touching the database ──────────
    allowed_ext = settings.allowed_attachment_extensions
    skipped: list[dict] = []
    pending: list[tuple[str, str, bytes]] = []  # (filename, content_type, data)

    for idx, doc in enumerate(documents or []):
        filename = doc.filename or "file"
        if idx >= MAX_FILES:
            skipped.append({"filename": filename, "reason": "too_many_files"})
            continue
        data = await doc.read()
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if not ext or ext not in allowed_ext:
            skipped.append({"filename": filename, "reason": "unsupported_type"})
            continue
        if len(data) > settings.MAX_ATTACHMENT_BYTES:
            skipped.append({"filename": filename, "reason": "too_large"})
            continue
        if len(data) == 0:
            skipped.append({"filename": filename, "reason": "empty_file"})
            continue
        pending.append((filename, doc.content_type or "application/octet-stream", data))

    # ── upsert website user ─────────────────────────────────────────
    user = None
    stmt = select(WebsiteUser).where(WebsiteUser.email == email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if user:
        user.last_seen_at = datetime.now(timezone.utc)
        user.message_count += 1
        if name:
            user.name = name
        if phone:
            user.phone = phone
    else:
        user = WebsiteUser(
            name=name,
            email=email,
            phone=phone,
        )
        db.add(user)
    await db.flush()

    effective_subject = subject or (f"{project_type} inquiry" if project_type else None) or "Contact Form"
    msg_priority = MessagePriority(_PRIORITY_MAP.get((priority or "").lower(), "normal"))

    msg = ContactMessage(
        public_reference=_generate_reference(),
        website_user_id=user.id if user else None,
        channel=MessageChannel.contact_form,
        status=MessageStatus.new,
        priority=msg_priority,
        subject=effective_subject[:240],
        body=message,
        sender_name=name,
        sender_email=email,
        sender_phone=phone,
        source_page=request.headers.get("referer", ""),
        ip_address=ip,
        user_agent=request.headers.get("user-agent", ""),
    )
    db.add(msg)
    await db.flush()

    # ── store attachments in MinIO and index them ──────────────────
    if pending:
        storage = get_storage()
        try:
            await storage.ensure_bucket()
        except StorageError as exc:
            logger.error("storage_bucket_unavailable", error=str(exc))
            raise HTTPException(503, "storage_unavailable")

        for filename, content_type, data in pending:
            try:
                object_key, size_bytes, sha256_hex = await storage.upload_attachment(
                    msg.id, filename, content_type, data
                )
            except StorageError as exc:
                logger.error("attachment_upload_failed",
                             error=str(exc), filename=filename)
                skipped.append({"filename": filename, "reason": "upload_failed"})
                continue
            db.add(MessageAttachment(
                message_id=msg.id,
                object_key=object_key,
                original_filename=filename[:255],
                content_type=content_type[:160] or "application/octet-stream",
                size_bytes=size_bytes,
                sha256_hex=sha256_hex,
            ))

    await db.commit()

    logger.info("contact_submitted",
                reference=msg.public_reference,
                email=str(email),
                attachments=len(pending) - sum(1 for s in skipped if s["reason"] == "upload_failed"))

    return {
        "status": "accepted",
        "reference": msg.public_reference,
        "skipped": skipped,
    }
```

```python
// File: backend\app\config.py
from pydantic_settings import BaseSettings
from functools import lru_cache
from pydantic import model_validator

import json


_INSECURE_DEFAULTS = frozenset({
    "",
    "change-me-in-production",
    "change-me",
    "changeme",
    "secret",
    "totp_encryption_key",
})

from pathlib import Path

_JWS_PRIVATE_FILENAME = "jws_private.pem"
_JWS_PUBLIC_FILENAME = "jws_public.pem"
_TURNSTILE_KEYS_FILENAME = "turnstile.json"


def _default_keys_dir() -> Path:
    # backend/app/config.py -> repo root -> .keys/
    return Path(__file__).resolve().parent.parent.parent / ".keys"


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    PRODUCTION: bool = False

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@db:5432/vijaykrsha"

    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_ADMIN_CHAT_ID: str = ""
    TELEGRAM_OTP_ENABLED: bool = True
    TELEGRAM_OTP_TTL_SECONDS: int = 300
    TELEGRAM_OTP_RESEND_SECONDS: int = 60
    TELEGRAM_OTP_LENGTH: int = 6

    TOTP_ENCRYPTION_KEY: str = "change-me-in-production"
    S3_ENDPOINT: str = "http://storage:9000"
    S3_REGION: str = "us-east-1"
    S3_BUCKET: str = "vijaykrsha-private"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_USE_SSL: bool = False
    MAX_ATTACHMENT_BYTES: int = 26_214_400  # 25 MiB per file
    MAX_CONTACT_BODY_BYTES: int = 146_800_640  # 5 x 25 MiB + form overhead
    ALLOWED_ATTACHMENT_EXTENSIONS: str = (
        "pdf,doc,docx,xls,xlsx,csv,txt,png,jpg,jpeg,gif,webp"
    )

    SESSION_IDLE_MINUTES: int = 30
    SESSION_ABSOLUTE_HOURS: int = 12

    CORS_ORIGINS: str = "https://vijaykrsha.online,https://vijaykrsha-website.pages.dev"

    OTP_PEPPER: str = "vijaykrsha-otp-pepper-change-me"

    # Redis
    REDIS_URL: str = "redis://redis-prod:6379/0"

    # Cloudflare Turnstile (admin login CAPTCHA)
    TURNSTILE_ENABLED: bool = True
    TURNSTILE_SITE_KEY: str = ""
    TURNSTILE_SECRET_KEY: str = ""
    TURNSTILE_EXPECTED_ACTION: str = "admin_login"
    TURNSTILE_EXPECTED_HOSTNAMES: str = "vijaykrsha.online,www.vijaykrsha.online"
    # Public contact form CAPTCHA. Kept separate from TURNSTILE_ENABLED so the
    # lead form and admin login can be enforced independently. Uses its own
    # widget/action (see TURNSTILE_CONTACT_ACTION) so a token minted for one
    # form cannot be replayed against the other.
    #
    # Each Turnstile widget has its OWN secret, and siteverify rejects a token
    # verified with the wrong one — so these two secrets must never be set to
    # the same value.
    TURNSTILE_CONTACT_REQUIRED: bool = True
    TURNSTILE_CONTACT_ACTION: str = "contact_form"
    # Env override for the contact widget secret. When empty (the default)
    # the secret comes from .keys/turnstile.json instead — see
    # turnstile_secret_for(). Same env-first-then-.keys/ precedence as
    # JWT_SIGNING_PRIVATE_KEY -> .keys/jws_private.pem.
    TURNSTILE_CONTACT_SECRET_KEY: str = ""

    # Rate limiting
    RATE_LIMIT_LOGIN_IP: int = 10
    RATE_LIMIT_LOGIN_IP_WINDOW: int = 60
    RATE_LIMIT_LOGIN_USER: int = 5
    RATE_LIMIT_LOGIN_USER_WINDOW: int = 600
    RATE_LIMIT_OTP_SEND: int = 3
    RATE_LIMIT_OTP_SEND_WINDOW: int = 600
    RATE_LIMIT_OTP_VERIFY: int = 5
    RATE_LIMIT_OTP_VERIFY_WINDOW: int = 600
    RATE_LIMIT_TOTP_VERIFY: int = 5
    RATE_LIMIT_TOTP_VERIFY_WINDOW: int = 300
    RATE_LIMIT_API_READ: int = 120
    RATE_LIMIT_API_READ_WINDOW: int = 60
    RATE_LIMIT_API_WRITE: int = 30
    RATE_LIMIT_API_WRITE_WINDOW: int = 60
    RATE_LIMIT_SETUP: int = 1
    RATE_LIMIT_SETUP_WINDOW: int = 600

    # Lockout
    MAX_LOGIN_ATTEMPTS: int = 5
    LOCKOUT_MINUTES: int = 30
    LOCKOUT_SHORT_SECONDS: int = 30
    LOCKOUT_SHORT_THRESHOLD: int = 3

    # Request validation
    MAX_JSON_BODY_KB: int = 64

    # JWT / token rotation
    JWT_SIGNING_PRIVATE_KEY: str = ""
    JWT_SIGNING_PUBLIC_KEY: str = ""
    JWT_ACCESS_TTL_MINUTES: int = 15
    JWT_REFRESH_TTL_DAYS: int = 7
    # Directory holding jws_private.pem/jws_public.pem. Empty → repo-root/.keys/.
    # In docker set KEYS_DIR=/app/.keys and bind-mount ./.keys there.
    KEYS_DIR: str = ""

    # Sessions
    MAX_CONCURRENT_SESSIONS: int = 5

    # Device trust
    MAX_TRUSTED_DEVICES: int = 5
    TRUST_EXPIRY_DAYS: int = 90

    # Risk scoring
    RISK_THRESHOLD_SUSPICIOUS: int = 30
    RISK_THRESHOLD_CHALLENGE: int = 50
    RISK_THRESHOLD_BLOCK_TEMP: int = 70
    RISK_THRESHOLD_BLOCK_PERM: int = 90

    @model_validator(mode="after")
    def check_insecure_defaults(self) -> "Settings":
        if not self.PRODUCTION:
            return self
        insecure: list[str] = []
        if self.TOTP_ENCRYPTION_KEY in _INSECURE_DEFAULTS:
            insecure.append("TOTP_ENCRYPTION_KEY")
        elif len(self.TOTP_ENCRYPTION_KEY) < 32:
            insecure.append("TOTP_ENCRYPTION_KEY (too short, need >= 32 chars)")
        if self.OTP_PEPPER in _INSECURE_DEFAULTS or self.OTP_PEPPER.startswith("vijaykrsha-otp-pepper"):
            insecure.append("OTP_PEPPER")
        elif len(self.OTP_PEPPER) < 24:
            insecure.append("OTP_PEPPER (too short, need >= 24 chars)")
        if self.S3_ACCESS_KEY == "minioadmin" or self.S3_SECRET_KEY == "minioadmin":
            insecure.append("S3_ACCESS_KEY/S3_SECRET_KEY (minioadmin default)")
        if not self.JWT_SIGNING_PRIVATE_KEY and not self.JWT_SIGNING_PUBLIC_KEY:
            keys_dir = self.keys_dir_path
            if not (
                (keys_dir / _JWS_PRIVATE_FILENAME).exists()
                and (keys_dir / _JWS_PUBLIC_FILENAME).exists()
            ):
                insecure.append(
                    "JWT_SIGNING_PRIVATE_KEY/JWT_SIGNING_PUBLIC_KEY (neither set, "
                    f"and no persisted PEM pair under {keys_dir})"
                )
        elif (
            not self.JWT_SIGNING_PRIVATE_KEY.startswith("-----BEGIN")
            or not self.JWT_SIGNING_PUBLIC_KEY.startswith("-----BEGIN")
        ):
            insecure.append(
                "JWT_SIGNING_PRIVATE_KEY/JWT_SIGNING_PUBLIC_KEY (set but not valid PEM; "
                "generate real keys, not placeholders)"
            )
        # Cloudflare Turnstile verification is fail-closed: an empty secret
        # does not degrade, it makes every login and contact submission
        # return 403. Refuse to boot so this surfaces as a startup error
        # instead of "the container looks healthy but nobody can log in".
        registry = self.keys_dir_path / _TURNSTILE_KEYS_FILENAME
        for label, required, action in (
            (
                "TURNSTILE_SECRET_KEY",
                self.TURNSTILE_ENABLED,
                self.TURNSTILE_EXPECTED_ACTION,
            ),
            (
                "TURNSTILE_CONTACT_SECRET_KEY",
                self.TURNSTILE_CONTACT_REQUIRED,
                self.TURNSTILE_CONTACT_ACTION,
            ),
        ):
            if required and not self.turnstile_secret_for(action):
                insecure.append(
                    f"{label}: no secret resolves for action '{action}' "
                    f"(set {label} in the environment or add the entry to {registry})"
                )
        if insecure:
            raise RuntimeError(
                "Refusing to start in production with insecure defaults: "
                + "; ".join(insecure)
                + ". Generate strong values before setting PRODUCTION=true."
            )
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def keys_dir_path(self) -> Path:
        if self.KEYS_DIR:
            return Path(self.KEYS_DIR)
        return _default_keys_dir()

    def _turnstile_registry(self) -> dict:
        """Read .keys/turnstile.json. Missing, unreadable or malformed yields
        {} — every caller already treats an empty secret as fail-closed, and
        the production guard below surfaces it as a startup error rather than
        a silently-broken 403 later."""
        try:
            raw = (
                self.keys_dir_path / _TURNSTILE_KEYS_FILENAME
            ).read_text(encoding="utf-8")
        except OSError:
            return {}
        try:
            data = json.loads(raw)
        except ValueError:
            return {}
        return data if isinstance(data, dict) else {}

    def turnstile_secret_for(self, action: str) -> str:
        """Resolve the Cloudflare Turnstile secret for one widget action.

        Env vars win (explicit overrides), then .keys/turnstile.json — the
        same precedence as JWT_SIGNING_PRIVATE_KEY -> .keys/jws_private.pem.

        Two widgets means two distinct secrets: siteverify returns
        success=false when the secret does not match the widget that minted
        the token, so resolving this correctly is load-bearing — getting it
        wrong rejects every submission on that form.
        """
        if action == self.TURNSTILE_EXPECTED_ACTION and self.TURNSTILE_SECRET_KEY:
            return self.TURNSTILE_SECRET_KEY
        if action == self.TURNSTILE_CONTACT_ACTION and self.TURNSTILE_CONTACT_SECRET_KEY:
            return self.TURNSTILE_CONTACT_SECRET_KEY
        entry = self._turnstile_registry().get(action)
        if isinstance(entry, dict):
            secret = entry.get("secret_key")
            if isinstance(secret, str):
                return secret.strip()
        return ""

    @property
    def cookie_secure(self) -> bool:
        return self.PRODUCTION

    @property
    def device_cookie_name(self) -> str:
        return "__Host-device" if self.PRODUCTION else "vks_device"

    @property
    def trusted_device_cookie_name(self) -> str:
        return "__Host-trusted-device" if self.PRODUCTION else "vks_trusted_device"

    @property
    def allowed_attachment_extensions(self) -> frozenset[str]:
        return frozenset(
            e.strip().lower() for e in self.ALLOWED_ATTACHMENT_EXTENSIONS.split(",") if e.strip()
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

```python
// File: backend\app\db.py
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.config import get_settings

settings = get_settings()
engine = create_async_engine(settings.DATABASE_URL, echo=False, pool_pre_ping=True)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
```

```python
// File: backend\app\main.py
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.config import get_settings
from app.api import (
    auth, public_contact, admin_messages, admin_settings, admin_trash,
    admin_users, admin_totp, admin_devices, admin_security,
)
from app.security.middleware import RequestValidationMiddleware
from app.security.csrf import CSRFMiddleware
from app.security.rate_limit import close_redis

settings = get_settings()

app = FastAPI(
    title="vijaykrsha.online API",
    version="0.2.0",
    docs_url="/admin/api/docs" if not settings.PRODUCTION else None,
    redoc_url=None,
    openapi_url="/admin/api/openapi.json" if not settings.PRODUCTION else None,
)


class DirectAccessGuard(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path.startswith("/admin/api/") or path.startswith("/vks/"):
            if request.headers.get("X-Forwarded-By") != "pages-proxy":
                return JSONResponse({"detail": "Not Found"}, status_code=404)
        response = await call_next(request)
        if path.startswith("/admin/api/"):
            # Admin API responses must never be cached by browsers or shared
            # proxies: a cached /me or dashboard payload could otherwise be
            # resurrected via Back/BFCache after logout.
            response.headers["Cache-Control"] = (
                "no-store, no-cache, must-revalidate, max-age=0"
            )
            response.headers["Pragma"] = "no-cache"
        return response


app.add_middleware(DirectAccessGuard)
app.add_middleware(RequestValidationMiddleware)
app.add_middleware(CSRFMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-RateLimit-RetryAfter"],
)

app.include_router(auth.router)
app.include_router(auth.ws_router)
app.include_router(public_contact.router)
app.include_router(admin_messages.router)
app.include_router(admin_settings.router)
app.include_router(admin_trash.router)
app.include_router(admin_users.router)
app.include_router(admin_totp.router)
app.include_router(admin_devices.router)
app.include_router(admin_security.router)


@app.get("/admin/api/health")
async def health():
    return {"status": "ok"}


# ── Trash cleanup worker ─────────────────────────────────────────
import asyncio
import structlog

logger = structlog.get_logger()


async def _trash_cleanup_loop():
    """Periodically delete expired trash items."""
    while True:
        await asyncio.sleep(900)  # 15 minutes
        try:
            from app.db import async_session
            from app.models import ContactMessage, MessageAttachment, MessageNote, ContactMessageTag
            from sqlalchemy import select
            from datetime import datetime, timezone

            async with async_session() as db:
                expired = (await db.execute(
                    select(ContactMessage).where(
                        ContactMessage.deleted_at.isnot(None),
                        ContactMessage.trash_expires_at <= datetime.now(timezone.utc),
                    ).limit(100)
                )).scalars().all()

                if not expired:
                    continue

                from app.services.storage_service import get_storage
                storage = get_storage()
                deleted = 0
                for msg in expired:
                    try:
                        attachments = (await db.execute(
                            select(MessageAttachment).where(MessageAttachment.message_id == msg.id)
                        )).scalars().all()
                        for att in attachments:
                            try:
                                await storage.delete_attachment(att.object_key)
                            except Exception:
                                logger.warning("cleanup_attachment_delete_failed", attachment_id=str(att.id))
                        for att in attachments:
                            await db.delete(att)
                        notes = (await db.execute(
                            select(MessageNote).where(MessageNote.message_id == msg.id)
                        )).scalars().all()
                        for note in notes:
                            await db.delete(note)
                        await db.delete(msg)
                        deleted += 1
                    except Exception:
                        logger.error("cleanup_message_failed", message_id=str(msg.id))

                if deleted:
                    await db.commit()
                    logger.info("trash_cleanup_completed", deleted=deleted)
        except Exception:
            logger.error("trash_cleanup_cycle_failed")


@app.on_event("startup")
async def start_trash_cleanup():
    asyncio.create_task(_trash_cleanup_loop())


@app.on_event("shutdown")
async def shutdown_event():
    await close_redis()
```

```python
// File: backend\app\models.py
import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Boolean, Integer, BigInteger, SmallInteger,
    DateTime, Enum, ForeignKey, CheckConstraint, UniqueConstraint, Index,
    JSON, LargeBinary,
)
from sqlalchemy.dialects.postgresql import UUID, INET, CITEXT, JSONB
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


def utcnow():
    return datetime.now(timezone.utc)


class AdminRole(str, enum.Enum):
    owner = "owner"
    admin = "admin"
    operator = "operator"
    viewer = "viewer"


class AdminStatus(str, enum.Enum):
    active = "active"
    suspended = "suspended"
    disabled = "disabled"
    pending = "pending"


class MessageStatus(str, enum.Enum):
    new = "new"
    in_progress = "in_progress"
    waiting = "waiting"
    resolved = "resolved"
    spam = "spam"
    archived = "archived"


class MessagePriority(str, enum.Enum):
    low = "low"
    normal = "normal"
    high = "high"
    urgent = "urgent"


class MessageChannel(str, enum.Enum):
    contact_form = "contact_form"
    email = "email"
    phone = "phone"
    whatsapp = "whatsapp"
    telegram = "telegram"
    other = "other"


class OtpPurpose(str, enum.Enum):
    login = "login"
    password_reset = "password_reset"
    admin_action = "admin_action"


class OtpDelivery(str, enum.Enum):
    telegram = "telegram"
    email = "email"


class AuditEvent(str, enum.Enum):
    login_success = "login_success"
    login_failure = "login_failure"
    logout = "logout"
    otp_sent = "otp_sent"
    otp_verified = "otp_verified"
    totp_verified = "totp_verified"
    message_viewed = "message_viewed"
    message_updated = "message_updated"
    message_deleted = "message_deleted"
    message_tag_removed = "message_tag_removed"
    settings_updated = "settings_updated"
    admin_created = "admin_created"
    admin_updated = "admin_updated"
    admin_disabled = "admin_disabled"
    password_changed = "password_changed"
    totp_enabled = "totp_enabled"
    totp_disabled = "totp_disabled"
    role_created = "role_created"
    role_deleted = "role_deleted"
    message_trashed = "message_trashed"
    message_restored = "message_restored"
    message_permanently_deleted = "message_permanently_deleted"
    trash_retention_changed = "trash_retention_changed"
    message_pinned = "message_pinned"
    message_unpinned = "message_unpinned"
    message_flagged = "message_flagged"
    message_unflagged = "message_unflagged"


class DeviceState(str, enum.Enum):
    unknown = "unknown"
    verified = "verified"
    trusted = "trusted"
    suspicious = "suspicious"
    blocked = "blocked"
    revoked = "revoked"


class SecurityEventType(str, enum.Enum):
    login_success = "login_success"
    login_failure = "login_failure"
    login_lockout = "login_lockout"
    otp_failure = "otp_failure"
    otp_rate_limit = "otp_rate_limit"
    totp_failure = "totp_failure"
    new_device = "new_device"
    device_trusted = "device_trusted"
    device_revoked = "device_revoked"
    device_blocked = "device_blocked"
    session_created = "session_created"
    session_revoked = "session_revoked"
    rate_limited = "rate_limited"
    bot_suspected = "bot_suspected"
    suspicious_request = "suspicious_request"
    account_locked = "account_locked"
    account_unlocked = "account_unlocked"


class SecuritySeverity(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # VARCHAR (not CITEXT): logins must match the exact stored case.
    username = Column(String(64), nullable=False, unique=True, index=True)
    email = Column(CITEXT, unique=True)
    display_name = Column(String(160), nullable=False)
    password_hash = Column(Text, nullable=False)
    role = Column(String(64), nullable=False, default="admin")
    role_id = Column(UUID(as_uuid=True), ForeignKey("admin_roles.id"), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=True)
    status = Column(Enum(AdminStatus), nullable=False, default=AdminStatus.active)
    telegram_chat_id = Column(Text)
    telegram_username = Column(String(64))
    totp_enabled = Column(Boolean, nullable=False, default=False)
    totp_secret_ciphertext = Column(LargeBinary)
    totp_enabled_at = Column(DateTime(timezone=True))
    last_login_at = Column(DateTime(timezone=True))
    password_changed_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    failed_login_count = Column(Integer, nullable=False, default=0)
    locked_until = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    sessions = relationship("AdminSession", back_populates="admin", cascade="all, delete-orphan")
    challenges = relationship("AuthChallenge", back_populates="admin", cascade="all, delete-orphan")
    devices = relationship("Device", back_populates="admin", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("length(username) BETWEEN 3 AND 64"),
    )


class AdminSession(Base):
    __tablename__ = "admin_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="CASCADE"), nullable=False)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="SET NULL"), nullable=True)
    session_hash = Column(String(64), nullable=False, unique=True, index=True)
    ip_address = Column(INET)
    user_agent = Column(Text)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    last_seen_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    absolute_expires_at = Column(DateTime(timezone=True))
    revoked_at = Column(DateTime(timezone=True))

    admin = relationship("AdminUser", back_populates="sessions")
    device = relationship("Device", back_populates="sessions")

    __table_args__ = (
        Index("idx_sessions_admin", "admin_id", "revoked_at", "expires_at"),
    )


class AuthChallenge(Base):
    __tablename__ = "auth_challenges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="CASCADE"), nullable=False)
    challenge_hash = Column(String(64), nullable=False, unique=True, index=True)
    otp_hash = Column(String(64))
    otp_delivery = Column(Enum(OtpDelivery))
    otp_purpose = Column(Enum(OtpPurpose), nullable=False, default=OtpPurpose.login)
    telegram_message_id = Column(BigInteger)
    otp_attempts = Column(Integer, nullable=False, default=0)
    totp_attempts = Column(Integer, nullable=False, default=0)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    otp_verified_at = Column(DateTime(timezone=True))
    totp_verified_at = Column(DateTime(timezone=True))
    consumed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    admin = relationship("AdminUser", back_populates="challenges")


class WebsiteUser(Base):
    __tablename__ = "website_users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(160))
    email = Column(CITEXT, index=True)
    phone = Column(String(32))
    organization = Column(String(160))
    country_code = Column(String(2))
    first_seen_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    last_seen_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    message_count = Column(Integer, nullable=False, default=0)
    is_blocked = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)


class ContactMessage(Base):
    __tablename__ = "contact_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    public_reference = Column(String(24), nullable=False, unique=True, index=True)
    website_user_id = Column(UUID(as_uuid=True), ForeignKey("website_users.id", ondelete="SET NULL"))
    channel = Column(Enum(MessageChannel), nullable=False, default=MessageChannel.contact_form)
    status = Column(Enum(MessageStatus), nullable=False, default=MessageStatus.new)
    priority = Column(Enum(MessagePriority), nullable=False, default=MessagePriority.normal)
    subject = Column(String(240))
    body = Column(Text, nullable=False)
    sender_name = Column(String(160))
    sender_email = Column(CITEXT)
    sender_phone = Column(String(32))
    source_page = Column(String(500))
    ip_address = Column(INET)
    user_agent = Column(Text)
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="SET NULL"))
    first_viewed_at = Column(DateTime(timezone=True))
    resolved_at = Column(DateTime(timezone=True))
    deleted_at = Column(DateTime(timezone=True))
    trash_expires_at = Column(DateTime(timezone=True))
    deleted_by = Column(UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="SET NULL"))
    is_pinned = Column(Boolean, nullable=False, default=False)
    pinned_at = Column(DateTime(timezone=True))
    pinned_by = Column(UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="SET NULL"))
    is_flagged = Column(Boolean, nullable=False, default=False)
    flagged_at = Column(DateTime(timezone=True))
    flagged_by = Column(UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    website_user = relationship("WebsiteUser")
    assignee = relationship("AdminUser", foreign_keys=[assigned_to])
    attachments = relationship("MessageAttachment", back_populates="message", cascade="all, delete-orphan")
    notes = relationship("MessageNote", back_populates="message", cascade="all, delete-orphan")
    tags = relationship("MessageTag", secondary="contact_message_tags", back_populates="messages")

    __table_args__ = (
        Index("idx_messages_created", "created_at"),
        Index("idx_messages_status_priority", "status", "priority", "created_at"),
        Index("idx_messages_assigned", "assigned_to", "status"),
    )


class MessageAttachment(Base):
    __tablename__ = "message_attachments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(UUID(as_uuid=True), ForeignKey("contact_messages.id", ondelete="CASCADE"), nullable=False)
    object_key = Column(Text, nullable=False, unique=True)
    original_filename = Column(String(255), nullable=False)
    content_type = Column(String(160), nullable=False)
    size_bytes = Column(BigInteger, nullable=False)
    sha256_hex = Column(String(64), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    message = relationship("ContactMessage", back_populates="attachments")


class MessageTag(Base):
    __tablename__ = "message_tags"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(CITEXT, nullable=False, unique=True)
    color = Column(String(32))
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    messages = relationship("ContactMessage", secondary="contact_message_tags", back_populates="tags")


class ContactMessageTag(Base):
    __tablename__ = "contact_message_tags"

    message_id = Column(UUID(as_uuid=True), ForeignKey("contact_messages.id", ondelete="CASCADE"), primary_key=True)
    tag_id = Column(UUID(as_uuid=True), ForeignKey("message_tags.id", ondelete="CASCADE"), primary_key=True)


class MessageNote(Base):
    __tablename__ = "message_notes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(UUID(as_uuid=True), ForeignKey("contact_messages.id", ondelete="CASCADE"), nullable=False)
    author_id = Column(UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="RESTRICT"), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    message = relationship("ContactMessage", back_populates="notes")
    author = relationship("AdminUser")


class AdminSetting(Base):
    __tablename__ = "admin_settings"

    id = Column(SmallInteger, primary_key=True, default=1)
    telegram_otp_required = Column(Boolean, nullable=False, default=True)
    default_totp_enabled = Column(Boolean, nullable=False, default=False)
    otp_length = Column(SmallInteger, nullable=False, default=6)
    otp_ttl_seconds = Column(Integer, nullable=False, default=300)
    otp_resend_seconds = Column(Integer, nullable=False, default=60)
    max_login_attempts = Column(SmallInteger, nullable=False, default=5)
    session_idle_minutes = Column(Integer, nullable=False, default=30)
    trash_retention_days = Column(Integer, nullable=False, default=30)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="SET NULL"))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    event = Column(Enum(AuditEvent), nullable=False)
    actor_admin_id = Column(UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="SET NULL"))
    target_message_id = Column(UUID(as_uuid=True), ForeignKey("contact_messages.id", ondelete="SET NULL"))
    target_admin_id = Column(UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="SET NULL"))
    ip_address = Column(INET)
    user_agent = Column(Text)
    metadata_ = Column("metadata", JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    __table_args__ = (
        Index("idx_audit_logs_created", "created_at"),
    )


class Device(Base):
    __tablename__ = "devices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_hash = Column(String(64), nullable=False, unique=True, index=True)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="CASCADE"), nullable=False)
    first_seen_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    last_seen_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    first_ip = Column(INET)
    last_ip = Column(INET)
    user_agent = Column(Text)
    browser_name = Column(String(64))
    browser_version = Column(String(32))
    os_name = Column(String(64))
    os_version = Column(String(32))
    device_type = Column(String(32))
    country = Column(String(2))
    state = Column(Enum(DeviceState), nullable=False, default=DeviceState.unknown)
    risk_score = Column(Integer, nullable=False, default=0)
    last_login_at = Column(DateTime(timezone=True))
    last_activity_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    admin = relationship("AdminUser", back_populates="devices")
    sessions = relationship("AdminSession", back_populates="device")
    trusted = relationship("TrustedDevice", back_populates="device", uselist=False)

    __table_args__ = (
        Index("idx_devices_admin", "admin_id"),
        Index("idx_devices_hash", "device_hash"),
    )


class TrustedDevice(Base):
    __tablename__ = "trusted_devices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, unique=True)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="CASCADE"), nullable=False)
    trust_hash = Column(String(64), nullable=False, unique=True, index=True)
    trusted_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    last_used_at = Column(DateTime(timezone=True))
    ip_address = Column(INET)
    user_agent = Column(Text)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    device = relationship("Device", back_populates="trusted")

    __table_args__ = (
        Index("idx_trusted_devices_admin", "admin_id"),
    )


class SecurityEvent(Base):
    __tablename__ = "security_events"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    event_type = Column(Enum(SecurityEventType), nullable=False, index=True)
    severity = Column(Enum(SecuritySeverity), nullable=False, default=SecuritySeverity.low)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="SET NULL"), index=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("admin_sessions.id", ondelete="SET NULL"))
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="SET NULL"))
    ip_address = Column(INET, index=True)
    user_agent = Column(Text)
    path = Column(Text)
    method = Column(String(8))
    risk_score = Column(Integer, nullable=False, default=0)
    reason = Column(Text)
    metadata_ = Column("metadata", JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, index=True)

    __table_args__ = (
        Index("idx_security_events_type_created", "event_type", "created_at"),
    )
```

```python
// File: backend\app\models_rbac.py
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Boolean, DateTime, ForeignKey, Integer, UniqueConstraint, Index,
)
from sqlalchemy.dialects.postgresql import UUID
from app.models import Base


def utcnow():
    return datetime.now(timezone.utc)


class AdminRole(Base):
    __tablename__ = "admin_roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(64), nullable=False, unique=True, index=True)
    description = Column(Text)
    is_system = Column(Boolean, nullable=False, default=False)
    level = Column(Integer, nullable=False, default=40)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)


class AdminPermission(Base):
    __tablename__ = "admin_permissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key = Column(String(128), nullable=False, unique=True, index=True)
    description = Column(Text)
    category = Column(String(64))


class AdminRolePermission(Base):
    __tablename__ = "admin_role_permissions"

    role_id = Column(UUID(as_uuid=True), ForeignKey("admin_roles.id", ondelete="CASCADE"), primary_key=True)
    permission_id = Column(UUID(as_uuid=True), ForeignKey("admin_permissions.id", ondelete="CASCADE"), primary_key=True)


# Permission constants
class Permission:
    DASHBOARD_VIEW = "dashboard.view"

    MESSAGES_VIEW = "messages.view"
    MESSAGES_UPDATE = "messages.update"
    MESSAGES_DELETE = "messages.delete"
    MESSAGES_NOTES = "messages.notes"
    MESSAGES_TAGS = "messages.tags"
    MESSAGES_RESTORE = "messages.restore"
    MESSAGES_EMPTY_TRASH = "messages.empty_trash"

    USERS_VIEW = "users.view"
    USERS_CREATE = "users.create"
    USERS_UPDATE = "users.update"
    USERS_DISABLE = "users.disable"
    USERS_DELETE = "users.delete"
    USERS_RESET_PASSWORD = "users.reset_password"
    USERS_MANAGE_2FA = "users.manage_2fa"

    SETTINGS_VIEW = "settings.view"
    SETTINGS_UPDATE = "settings.update"

    AUDIT_LOGS_VIEW = "audit_logs.view"

    ROLES_VIEW = "roles.view"
    ROLES_MANAGE = "roles.manage"

    ALL = [
        DASHBOARD_VIEW,
        MESSAGES_VIEW, MESSAGES_UPDATE, MESSAGES_DELETE, MESSAGES_NOTES, MESSAGES_TAGS,
        MESSAGES_RESTORE, MESSAGES_EMPTY_TRASH,
        USERS_VIEW, USERS_CREATE, USERS_UPDATE, USERS_DISABLE, USERS_DELETE,
        USERS_RESET_PASSWORD, USERS_MANAGE_2FA,
        SETTINGS_VIEW, SETTINGS_UPDATE,
        AUDIT_LOGS_VIEW,
        ROLES_VIEW, ROLES_MANAGE,
    ]


# Role-permission mappings
ROLE_PERMISSIONS = {
    "owner": Permission.ALL,
    "admin": [
        Permission.DASHBOARD_VIEW,
        Permission.MESSAGES_VIEW, Permission.MESSAGES_UPDATE, Permission.MESSAGES_NOTES, Permission.MESSAGES_TAGS,
        Permission.MESSAGES_RESTORE, Permission.MESSAGES_EMPTY_TRASH,
        Permission.USERS_VIEW, Permission.USERS_CREATE, Permission.USERS_UPDATE, Permission.USERS_DISABLE,
        Permission.USERS_RESET_PASSWORD,
        Permission.SETTINGS_VIEW, Permission.AUDIT_LOGS_VIEW,
        Permission.ROLES_VIEW, Permission.ROLES_MANAGE,
    ],
    "manager": [
        Permission.DASHBOARD_VIEW,
        Permission.MESSAGES_VIEW, Permission.MESSAGES_UPDATE, Permission.MESSAGES_NOTES, Permission.MESSAGES_TAGS,
        Permission.MESSAGES_RESTORE,
        Permission.USERS_VIEW, Permission.USERS_DISABLE,
        Permission.SETTINGS_VIEW,
        Permission.ROLES_VIEW, Permission.ROLES_MANAGE,
    ],
    "support": [
        Permission.DASHBOARD_VIEW,
        Permission.MESSAGES_VIEW, Permission.MESSAGES_UPDATE, Permission.MESSAGES_NOTES,
    ],
    "viewer": [
        Permission.DASHBOARD_VIEW,
        Permission.MESSAGES_VIEW,
    ],
}
```

```python
// File: backend\app\schemas\__init__.py

```

```python
// File: backend\app\security\__init__.py

```

```python
// File: backend\app\security\bot_detection.py
from fastapi import Request
from app.security.risk import RiskSignals


_BOT_UA_PATTERNS = (
    "python-requests", "python-urllib", "python-httpx", "aiohttp",
    "curl/", "wget/", "go-http-client", "java/",
    "okhttp/", "apache-httpclient", "libcurl",
    "headless", "phantom", "selenium", "puppeteer", "playwright",
    "bot", "spider", "crawler", "scraper",
)


def analyze_request_signals(request: Request) -> RiskSignals:
    signals = RiskSignals()
    ua = request.headers.get("user-agent", "")
    accept = request.headers.get("accept", "")
    sec_fetch_site = request.headers.get("sec-fetch-site", "")
    sec_fetch_mode = request.headers.get("sec-fetch-mode", "")
    sec_fetch_dest = request.headers.get("sec-fetch-dest", "")
    sec_ch_ua = request.headers.get("sec-ch-ua", "")

    if not ua:
        signals.known_bad_ua = True
    else:
        ua_lower = ua.lower()
        for pattern in _BOT_UA_PATTERNS:
            if pattern in ua_lower:
                signals.automation_indicators = True
                signals.known_bad_ua = True
                break

    has_sec_fetch = bool(sec_fetch_site or sec_fetch_mode or sec_fetch_dest)
    if not has_sec_fetch and not ua:
        signals.missing_browser_headers = True
    elif not has_sec_fetch and ua:
        ua_lower = ua.lower()
        is_browser = any(b in ua_lower for b in ("chrome", "firefox", "safari", "edge"))
        if is_browser:
            signals.missing_browser_headers = True

    if not accept:
        signals.missing_accept = True

    if sec_ch_ua and ua:
        ua_lower = ua.lower()
        if "chrome" in sec_ch_ua.lower() and "chrome" not in ua_lower:
            signals.ua_sec_ch_ua_mismatch = True
        elif "firefox" in sec_ch_ua.lower() and "firefox" not in ua_lower:
            signals.ua_sec_ch_ua_mismatch = True

    return signals
```

```python
// File: backend\app\security\csrf.py
import secrets
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from app.config import get_settings

settings = get_settings()

CSRF_COOKIE_NAME = "vks_csrf"
CSRF_HEADER_NAME = "x-csrf-token"
CSRF_ORIGINAL_ORIGIN_HEADER = "x-original-origin"

_UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})

# Pre-auth endpoints: no authenticated session exists yet, so cross-site
# forgery of these requests grants nothing without valid credentials.
_CSRF_EXEMPT_PATHS = frozenset({
    "/admin/api/auth/login",
    "/admin/api/auth/login-otp-send",
    "/admin/api/auth/login-otp-verify",
    "/admin/api/auth/login-totp",
    "/admin/api/auth/setup-required",
    "/admin/api/auth/setup-create",
    "/admin/api/auth/password/forgot-verify",
    "/admin/api/auth/password/forgot-reset",
    "/admin/api/auth/public-key",
    "/admin/api/auth/exchange",
    "/admin/api/auth/refresh",
})


def issue_csrf_cookie(response, token: str | None = None) -> str:
    token = token or secrets.token_urlsafe(32)
    response.set_cookie(
        CSRF_COOKIE_NAME, token,
        httponly=False,  # JS must read it to echo into X-CSRF-Token
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=12 * 3600,
        path="/",
    )
    return token


class CSRFMiddleware(BaseHTTPMiddleware):
    """Defense-in-depth for cookie-authenticated admin APIs.

    Two layers on every unsafe /admin/api/* request:
      1. Double-submit: X-CSRF-Token header must match the vks_csrf cookie.
      2. Origin validation: X-Original-Origin (set by the trusted Pages
         proxy) or a direct browser Origin header must be allowlisted.
    """

    async def dispatch(self, request, call_next):
        method = request.method.upper()
        path = request.url.path

        if method in _UNSAFE_METHODS and path.startswith("/admin/api/") \
                and path not in _CSRF_EXEMPT_PATHS:
            cookie_token = request.cookies.get(CSRF_COOKIE_NAME)
            header_token = request.headers.get(CSRF_HEADER_NAME)
            if not cookie_token or not header_token \
                    or not secrets.compare_digest(cookie_token, header_token):
                return JSONResponse(
                    {"detail": "csrf_validation_failed"},
                    status_code=403,
                )

            origin = (
                request.headers.get(CSRF_ORIGINAL_ORIGIN_HEADER)
                or request.headers.get("origin")
            )
            if origin and origin not in settings.cors_origin_list:
                return JSONResponse(
                    {"detail": "origin_not_allowed"},
                    status_code=403,
                )

        response = await call_next(request)

        if method in ("GET", "HEAD") and path.startswith("/admin/api/") \
                and not request.cookies.get(CSRF_COOKIE_NAME):
            issue_csrf_cookie(response)

        return response
```

```python
// File: backend\app\security\devices.py
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import (
    Device, DeviceState, TrustedDevice, AdminSession,
    AdminUser, SecurityEvent, SecurityEventType, SecuritySeverity,
)
from app.config import get_settings

settings = get_settings()

_BOT_PATTERNS = (
    "bot", "spider", "crawler", "scraper", "headless", "phantom",
    "selenium", "puppeteer", "playwright", "curl", "wget",
    "python-requests", "python-urllib", "httpx", "aiohttp",
    "go-http-client", "java/", "okhttp",
)


def _hash_device(device_token: str) -> str:
    return hashlib.sha256(device_token.encode()).hexdigest()


def _hash_trust(trust_secret: str) -> str:
    return hashlib.sha256(trust_secret.encode()).hexdigest()


def _parse_user_agent(ua: str) -> dict:
    result = {
        "browser_name": None,
        "browser_version": None,
        "os_name": None,
        "os_version": None,
        "device_type": "desktop",
    }
    if not ua:
        return result

    ua_lower = ua.lower()

    for pattern in _BOT_PATTERNS:
        if pattern in ua_lower:
            result["device_type"] = "bot"
            return result

    if "mobile" in ua_lower or "android" in ua_lower:
        result["device_type"] = "mobile"
    elif "tablet" in ua_lower or "ipad" in ua_lower:
        result["device_type"] = "tablet"

    if "chrome/" in ua_lower and "edg/" not in ua_lower:
        result["browser_name"] = "Chrome"
        try:
            idx = ua_lower.index("chrome/") + 7
            end = ua_lower.index(" ", idx) if " " in ua_lower[idx:] else len(ua)
            result["browser_version"] = ua[idx:end].split(".")[0]
        except (ValueError, IndexError):
            pass
    elif "edg/" in ua_lower:
        result["browser_name"] = "Edge"
        try:
            idx = ua_lower.index("edg/") + 4
            end = ua_lower.index(" ", idx) if " " in ua_lower[idx:] else len(ua)
            result["browser_version"] = ua[idx:end].split(".")[0]
        except (ValueError, IndexError):
            pass
    elif "firefox/" in ua_lower:
        result["browser_name"] = "Firefox"
        try:
            idx = ua_lower.index("firefox/") + 8
            end = ua_lower.index(" ", idx) if " " in ua_lower[idx:] else len(ua)
            result["browser_version"] = ua[idx:end].split(".")[0]
        except (ValueError, IndexError):
            pass
    elif "safari/" in ua_lower and "chrome" not in ua_lower:
        result["browser_name"] = "Safari"

    if "windows" in ua_lower:
        result["os_name"] = "Windows"
        if "windows nt 10" in ua_lower:
            result["os_version"] = "10"
        elif "windows nt 11" in ua_lower or ("windows nt 10" in ua_lower and "build/22" in ua_lower):
            result["os_version"] = "11"
    elif "mac os" in ua_lower or "macos" in ua_lower:
        result["os_name"] = "macOS"
    elif "linux" in ua_lower and "android" not in ua_lower:
        result["os_name"] = "Linux"
    elif "android" in ua_lower:
        result["os_name"] = "Android"
        try:
            idx = ua_lower.index("android ") + 8
            end = ua_lower.index(";", idx) if ";" in ua_lower[idx:] else len(ua)
            result["os_version"] = ua[idx:end].strip().split(".")[0]
        except (ValueError, IndexError):
            pass
    elif "iphone" in ua_lower or "ipad" in ua_lower:
        result["os_name"] = "iOS"

    return result


async def identify_or_create_device(
    db: AsyncSession,
    device_token: str | None,
    admin_id: UUID,
    ip_address: str | None,
    user_agent: str | None,
) -> tuple[Device, bool, str]:
    is_new = False
    if device_token:
        device_hash = _hash_device(device_token)
        stmt = select(Device).where(Device.device_hash == device_hash)
        result = await db.execute(stmt)
        device = result.scalar_one_or_none()

        if device and device.admin_id == admin_id:
            device.last_seen_at = datetime.now(timezone.utc)
            device.last_ip = ip_address
            if user_agent:
                device.user_agent = user_agent
                parsed = _parse_user_agent(user_agent)
                device.browser_name = parsed["browser_name"]
                device.browser_version = parsed["browser_version"]
                device.os_name = parsed["os_name"]
                device.os_version = parsed["os_version"]
                device.device_type = parsed["device_type"]
            device.last_activity_at = datetime.now(timezone.utc)
            await db.commit()
            new_token = device_token
            return device, False, new_token

    new_token = secrets.token_urlsafe(32)
    new_hash = _hash_device(new_token)
    parsed = _parse_user_agent(user_agent or "")

    device = Device(
        device_hash=new_hash,
        admin_id=admin_id,
        first_ip=ip_address,
        last_ip=ip_address,
        user_agent=user_agent,
        browser_name=parsed["browser_name"],
        browser_version=parsed["browser_version"],
        os_name=parsed["os_name"],
        os_version=parsed["os_version"],
        device_type=parsed["device_type"],
        state=DeviceState.unknown,
        last_activity_at=datetime.now(timezone.utc),
    )
    db.add(device)
    await db.flush()
    is_new = True

    if is_new:
        db.add(SecurityEvent(
            event_type=SecurityEventType.new_device,
            severity=SecuritySeverity.low,
            admin_id=admin_id,
            device_id=device.id,
            ip_address=ip_address,
            user_agent=user_agent,
            risk_score=0,
            reason="New device registered",
        ))

    return device, is_new, new_token


async def get_device_by_token(
    db: AsyncSession,
    device_token: str,
) -> Device | None:
    device_hash = _hash_device(device_token)
    stmt = select(Device).where(Device.device_hash == device_hash)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def revoke_device(db: AsyncSession, device_id: UUID) -> None:
    stmt = update(Device).where(Device.id == device_id).values(
        state=DeviceState.revoked,
        updated_at=datetime.now(timezone.utc),
    )
    await db.execute(stmt)

    await db.execute(
        update(AdminSession).where(
            AdminSession.device_id == device_id,
            AdminSession.revoked_at.is_(None),
        ).values(revoked_at=datetime.now(timezone.utc))
    )

    await db.execute(
        update(TrustedDevice).where(
            TrustedDevice.device_id == device_id,
            TrustedDevice.revoked_at.is_(None),
        ).values(revoked_at=datetime.now(timezone.utc))
    )
    await db.commit()


async def block_device(db: AsyncSession, device_id: UUID) -> None:
    stmt = update(Device).where(Device.id == device_id).values(
        state=DeviceState.blocked,
        updated_at=datetime.now(timezone.utc),
    )
    await db.execute(stmt)
    await db.commit()


async def unblock_device(db: AsyncSession, device_id: UUID) -> None:
    stmt = update(Device).where(Device.id == device_id).values(
        state=DeviceState.unknown,
        updated_at=datetime.now(timezone.utc),
    )
    await db.execute(stmt)
    await db.commit()


async def create_trust(
    db: AsyncSession,
    device_id: UUID,
    admin_id: UUID,
    ip_address: str | None,
    user_agent: str | None,
) -> tuple[str, TrustedDevice]:
    trust_secret = secrets.token_urlsafe(32)
    trust_hash = _hash_trust(trust_secret)

    existing = await db.execute(
        select(TrustedDevice).where(
            TrustedDevice.device_id == device_id,
            TrustedDevice.revoked_at.is_(None),
        )
    )
    existing_trust = existing.scalar_one_or_none()
    if existing_trust:
        existing_trust.trust_hash = trust_hash
        existing_trust.trusted_at = datetime.now(timezone.utc)
        existing_trust.expires_at = datetime.now(timezone.utc) + timedelta(days=settings.TRUST_EXPIRY_DAYS)
        existing_trust.ip_address = ip_address
        existing_trust.user_agent = user_agent
        await db.commit()
        return trust_secret, existing_trust

    trust = TrustedDevice(
        device_id=device_id,
        admin_id=admin_id,
        trust_hash=trust_hash,
        ip_address=ip_address,
        user_agent=user_agent,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.TRUST_EXPIRY_DAYS),
    )
    db.add(trust)

    await db.execute(
        update(Device).where(Device.id == device_id).values(
            state=DeviceState.trusted,
            updated_at=datetime.now(timezone.utc),
        )
    )
    await db.commit()
    return trust_secret, trust


async def verify_trust(
    db: AsyncSession,
    trust_secret: str,
) -> TrustedDevice | None:
    trust_hash = _hash_trust(trust_secret)
    stmt = select(TrustedDevice).where(
        TrustedDevice.trust_hash == trust_hash,
        TrustedDevice.revoked_at.is_(None),
        TrustedDevice.expires_at > datetime.now(timezone.utc),
    )
    result = await db.execute(stmt)
    trust = result.scalar_one_or_none()
    if trust:
        trust.last_used_at = datetime.now(timezone.utc)
        await db.commit()
    return trust


async def revoke_trust(db: AsyncSession, trust_id: UUID) -> None:
    stmt = update(TrustedDevice).where(
        TrustedDevice.id == trust_id,
        TrustedDevice.revoked_at.is_(None),
    ).values(revoked_at=datetime.now(timezone.utc))
    await db.execute(stmt)
    await db.commit()


async def revoke_all_trust_for_device(db: AsyncSession, device_id: UUID) -> None:
    stmt = update(TrustedDevice).where(
        TrustedDevice.device_id == device_id,
        TrustedDevice.revoked_at.is_(None),
    ).values(revoked_at=datetime.now(timezone.utc))
    await db.execute(stmt)
    await db.commit()


async def count_active_trusted_devices(db: AsyncSession, admin_id: UUID) -> int:
    result = await db.execute(
        select(func.count(TrustedDevice.id)).where(
            TrustedDevice.admin_id == admin_id,
            TrustedDevice.revoked_at.is_(None),
            TrustedDevice.expires_at > datetime.now(timezone.utc),
        )
    )
    return result.scalar() or 0


async def log_security_event(
    db: AsyncSession,
    event_type: SecurityEventType,
    severity: SecuritySeverity = SecuritySeverity.low,
    admin_id: UUID | None = None,
    session_id: UUID | None = None,
    device_id: UUID | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    path: str | None = None,
    method: str | None = None,
    risk_score: int = 0,
    reason: str = "",
    metadata: dict | None = None,
) -> None:
    event = SecurityEvent(
        event_type=event_type,
        severity=severity,
        admin_id=admin_id,
        session_id=session_id,
        device_id=device_id,
        ip_address=ip_address,
        user_agent=user_agent,
        path=path,
        method=method,
        risk_score=risk_score,
        reason=reason,
        metadata_=metadata or {},
    )
    db.add(event)
    await db.commit()
```

```python
// File: backend\app\security\encryption.py
import uuid

from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.backends import default_backend

from app.config import get_settings
from app.security.rate_limit import get_redis

settings = get_settings()

ENCRYPTION_KEY_TTL = 300


async def new_encryption_keypair() -> tuple[str, str]:
    """Generate an ephemeral RSA-2048 key pair, store the private key in
    Redis, and return (key_id, public_key_pem)."""
    r = await get_redis()
    key_id = str(uuid.uuid4())

    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend(),
    )
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )

    await r.setex(f"auth:enc_key:{key_id}", ENCRYPTION_KEY_TTL, private_pem)
    return key_id, public_pem.decode()


async def decrypt_password(key_id: str, cipher_b64: str) -> str:
    """Retrieve the ephemeral private key and decrypt the RSA-OAEP payload.
    The key is deleted after a single use."""
    r = await get_redis()
    key = f"auth:enc_key:{key_id}"
    private_pem = await r.get(key)
    if not private_pem:
        raise ValueError("encryption_key_expired")
    await r.delete(key)

    import base64

    private_key = serialization.load_pem_private_key(
        private_pem.encode() if isinstance(private_pem, str) else private_pem,
        password=None,
        backend=default_backend(),
    )
    try:
        ciphertext = base64.b64decode(cipher_b64)
        plaintext = private_key.decrypt(
            ciphertext,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None,
            ),
        )
    except Exception:
        raise ValueError("password_decryption_failed")
    return plaintext.decode("utf-8")
```

```python
// File: backend\app\security\middleware.py
import re
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from app.config import get_settings

settings = get_settings()

_BODY_LIMITS: dict[str, int] = {
    "/admin/api/auth/login": 16 * 1024,
    "/admin/api/auth/login-otp-send": 16 * 1024,
    "/admin/api/auth/login-otp-verify": 16 * 1024,
    "/admin/api/auth/login-totp": 16 * 1024,
    "/admin/api/auth/setup-create": 16 * 1024,
    "/admin/api/auth/password/forgot-verify": 16 * 1024,
    "/admin/api/auth/password/forgot-reset": 16 * 1024,
    "/vks/api/contact": 32 * 1024,
}

# The public contact form is the only write endpoint that legitimately
# uploads binary content, so it may speak multipart/form-data.
_MULTIPART_LIMITS: dict[str, int] = {
    "/vks/api/contact": settings.MAX_CONTACT_BODY_BYTES,
}

_DEFAULT_BODY_LIMIT = settings.MAX_JSON_BODY_KB * 1024

_NULL_BYTE_RE = re.compile(r"[\x00]")


def _content_length(value: str | None) -> int:
    """Parse a Content-Length header, returning 0 for absent/invalid values."""
    if not value:
        return 0
    try:
        size = int(value.strip())
    except (TypeError, ValueError):
        return 0
    return size if size > 0 else 0


class RequestValidationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        method = request.method

        if _NULL_BYTE_RE.search(path):
            return JSONResponse({"detail": "Bad Request"}, status_code=400)

        if method in {"POST", "PUT", "PATCH"}:
            content_type = request.headers.get("content-type", "")
            multipart_limit = (
                _MULTIPART_LIMITS.get(path)
                if content_type.startswith("multipart/form-data")
                else None
            )
            if multipart_limit is not None:
                limit = multipart_limit
            else:
                if not content_type.startswith("application/json"):
                    # A request with no body (e.g. POST /admin/api/auth/refresh,
                    # which authenticates via a cookie) carries no Content-Type
                    # and must not be forced to claim a JSON payload.
                    has_body = (
                        bool(request.headers.get("transfer-encoding", "").strip())
                        or _content_length(request.headers.get("content-length")) > 0
                    )
                    if has_body:
                        return JSONResponse(
                            {"detail": "Content-Type must be application/json"},
                            status_code=415,
                        )
                limit = _BODY_LIMITS.get(path, _DEFAULT_BODY_LIMIT)

            content_length = request.headers.get("content-length")
            if content_length:
                try:
                    size = int(content_length)
                except ValueError:
                    return JSONResponse({"detail": "Bad Request"}, status_code=400)

                if size > limit:
                    if limit >= 1024 * 1024:
                        pretty = f"{limit / (1024 * 1024):.0f}MB"
                    else:
                        pretty = f"{limit // 1024}KB"
                    return JSONResponse(
                        {"detail": f"Request body too large (max {pretty})"},
                        status_code=413,
                    )

        response: Response = await call_next(request)
        return response
```

```python
// File: backend\app\security\password_policy.py
import re

PASSWORD_MIN_LENGTH = 12
PASSWORD_MAX_LENGTH = 256

_UPPER_RE = re.compile(r"[A-Z]")
_LOWER_RE = re.compile(r"[a-z]")
_DIGIT_RE = re.compile(r"[0-9]")
_SPECIAL_RE = re.compile(r"[^A-Za-z0-9]")


def validate_password_strength(v: str) -> str:
    """Canonical password policy enforced on every password-set path.

    Keep in sync with src/lib/passwordValidation.ts (frontend mirror, UX only).
    """
    if len(v) < PASSWORD_MIN_LENGTH:
        raise ValueError(f"Password must be at least {PASSWORD_MIN_LENGTH} characters long")
    if len(v) > PASSWORD_MAX_LENGTH:
        raise ValueError("Password must be at most 256 characters long")
    if not _UPPER_RE.search(v):
        raise ValueError("Password must contain an uppercase letter")
    if not _LOWER_RE.search(v):
        raise ValueError("Password must contain a lowercase letter")
    if not _DIGIT_RE.search(v):
        raise ValueError("Password must contain a number")
    if not _SPECIAL_RE.search(v):
        raise ValueError("Password must contain a special character")
    if v != v.strip():
        raise ValueError("Password must not have leading or trailing whitespace")
    return v
```

```python
// File: backend\app\security\passwords.py
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

_ph = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
)


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password: str, hash_: str) -> bool:
    try:
        return _ph.verify(hash_, password)
    except VerifyMismatchError:
        return False
    except Exception:
        return False
```

```python
// File: backend\app\security\rate_limit.py
import time
import hashlib
from typing import Optional
import redis.asyncio as redis
from app.config import get_settings

settings = get_settings()

_pool: Optional[redis.Redis] = None


async def get_redis() -> redis.Redis:
    global _pool
    if _pool is None:
        _pool = redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            max_connections=20,
        )
    return _pool


async def close_redis():
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None


def _prefix_key(scope: str, key: str) -> str:
    return f"rl:{scope}:{key}"


class RedisRateLimiter:
    def __init__(
        self,
        max_requests: int,
        window_seconds: int,
        scope: str = "global",
    ):
        self.max_requests = max_requests
        self.window = window_seconds
        self.scope = scope

    async def check_and_record(self, key: str) -> tuple[bool, float]:
        r = await get_redis()
        redis_key = _prefix_key(self.scope, key)
        now = time.time()
        window_start = now - self.window

        pipe = r.pipeline()
        pipe.zremrangebyscore(redis_key, 0, window_start)
        pipe.zadd(redis_key, {str(now): now})
        pipe.zcard(redis_key)
        pipe.expire(redis_key, self.window + 10)
        results = await pipe.execute()

        count = results[2]
        if count > self.max_requests:
            members = await r.zrange(redis_key, 0, 0, withscores=True)
            if members:
                oldest_time = members[0][1]
                retry_after = self.window - (now - oldest_time)
                return False, max(retry_after, 1.0)
            return False, float(self.window)

        return True, 0.0

    async def check(self, key: str) -> tuple[bool, float]:
        r = await get_redis()
        redis_key = _prefix_key(self.scope, key)
        now = time.time()
        window_start = now - self.window

        pipe = r.pipeline()
        pipe.zremrangebyscore(redis_key, 0, window_start)
        pipe.zcard(redis_key)
        results = await pipe.execute()

        count = results[1]
        if count >= self.max_requests:
            members = await r.zrange(redis_key, 0, 0, withscores=True)
            if members:
                oldest_time = members[0][1]
                retry_after = self.window - (now - oldest_time)
                return False, max(retry_after, 1.0)
            return False, float(self.window)

        return True, 0.0

    async def record(self, key: str) -> None:
        r = await get_redis()
        redis_key = _prefix_key(self.scope, key)
        now = time.time()
        pipe = r.pipeline()
        pipe.zadd(redis_key, {str(now): now})
        pipe.expire(redis_key, self.window + 10)
        await pipe.execute()


class RedisBlocklist:
    BLOCK_PREFIX = "block"

    @classmethod
    async def block(cls, identifier: str, ttl_seconds: int = 900) -> None:
        r = await get_redis()
        key = f"{cls.BLOCK_PREFIX}:{identifier}"
        await r.setex(key, ttl_seconds, "1")

    @classmethod
    async def is_blocked(cls, identifier: str) -> bool:
        r = await get_redis()
        key = f"{cls.BLOCK_PREFIX}:{identifier}"
        return await r.exists(key) > 0

    @classmethod
    async def unblock(cls, identifier: str) -> None:
        r = await get_redis()
        key = f"{cls.BLOCK_PREFIX}:{identifier}"
        await r.delete(key)

    @classmethod
    async def get_block_ttl(cls, identifier: str) -> int:
        r = await get_redis()
        key = f"{cls.BLOCK_PREFIX}:{identifier}"
        ttl = await r.ttl(key)
        return max(ttl, 0)


login_ip_limiter = RedisRateLimiter(
    max_requests=settings.RATE_LIMIT_LOGIN_IP,
    window_seconds=settings.RATE_LIMIT_LOGIN_IP_WINDOW,
    scope="login_ip",
)
login_user_limiter = RedisRateLimiter(
    max_requests=settings.RATE_LIMIT_LOGIN_USER,
    window_seconds=settings.RATE_LIMIT_LOGIN_USER_WINDOW,
    scope="login_user",
)
otp_send_limiter = RedisRateLimiter(
    max_requests=settings.RATE_LIMIT_OTP_SEND,
    window_seconds=settings.RATE_LIMIT_OTP_SEND_WINDOW,
    scope="otp_send",
)
otp_verify_limiter = RedisRateLimiter(
    max_requests=settings.RATE_LIMIT_OTP_VERIFY,
    window_seconds=settings.RATE_LIMIT_OTP_VERIFY_WINDOW,
    scope="otp_verify",
)
totp_verify_limiter = RedisRateLimiter(
    max_requests=settings.RATE_LIMIT_TOTP_VERIFY,
    window_seconds=settings.RATE_LIMIT_TOTP_VERIFY_WINDOW,
    scope="totp_verify",
)
api_read_limiter = RedisRateLimiter(
    max_requests=settings.RATE_LIMIT_API_READ,
    window_seconds=settings.RATE_LIMIT_API_READ_WINDOW,
    scope="api_read",
)
api_write_limiter = RedisRateLimiter(
    max_requests=settings.RATE_LIMIT_API_WRITE,
    window_seconds=settings.RATE_LIMIT_API_WRITE_WINDOW,
    scope="api_write",
)
setup_limiter = RedisRateLimiter(
    max_requests=settings.RATE_LIMIT_SETUP,
    window_seconds=settings.RATE_LIMIT_SETUP_WINDOW,
    scope="setup",
)
contact_limiter = RedisRateLimiter(
    max_requests=5,
    window_seconds=300,
    scope="contact",
)
forgot_verify_limiter = RedisRateLimiter(
    max_requests=3,
    window_seconds=300,
    scope="forgot_verify",
)
forgot_reset_limiter = RedisRateLimiter(
    max_requests=5,
    window_seconds=600,
    scope="forgot_reset",
)
```

```python
// File: backend\app\security\risk.py
import time
from dataclasses import dataclass, field
from typing import Optional
from app.config import get_settings

settings = get_settings()


@dataclass
class RiskSignals:
    request_rate_high: bool = False
    failed_logins: int = 0
    missing_browser_headers: bool = False
    impossible_sequence: bool = False
    endpoint_enumeration: bool = False
    automation_indicators: bool = False
    many_accounts_from_device: int = 0
    many_devices_from_ip: int = 0
    repeated_credential_attacks: int = 0
    known_bad_ua: bool = False
    missing_accept: bool = False
    ua_sec_ch_ua_mismatch: bool = False


@dataclass
class RiskResult:
    score: int = 0
    level: str = "NORMAL"
    signals: RiskSignals = field(default_factory=RiskSignals)

    @property
    def should_challenge(self) -> bool:
        return self.score >= settings.RISK_THRESHOLD_CHALLENGE

    @property
    def should_block_temp(self) -> bool:
        return self.score >= settings.RISK_THRESHOLD_BLOCK_TEMP

    @property
    def should_block_perm(self) -> bool:
        return self.score >= settings.RISK_THRESHOLD_BLOCK_PERM

    @property
    def is_suspicious(self) -> bool:
        return self.score >= settings.RISK_THRESHOLD_SUSPICIOUS


def calculate_risk(signals: RiskSignals) -> RiskResult:
    score = 0

    if signals.request_rate_high:
        score += 10
    if signals.failed_logins >= 3:
        score += 15
    if signals.missing_browser_headers:
        score += 20
    if signals.impossible_sequence:
        score += 15
    if signals.endpoint_enumeration:
        score += 20
    if signals.automation_indicators:
        score += 25
    if signals.many_accounts_from_device > 3:
        score += 20
    if signals.many_devices_from_ip > 10:
        score += 30
    if signals.repeated_credential_attacks > 10:
        score += 40
    if signals.known_bad_ua:
        score += 25
    if signals.missing_accept:
        score += 10
    if signals.ua_sec_ch_ua_mismatch:
        score += 15

    if score >= settings.RISK_THRESHOLD_BLOCK_PERM:
        level = "BLOCK_PERM"
    elif score >= settings.RISK_THRESHOLD_BLOCK_TEMP:
        level = "BLOCK_TEMP"
    elif score >= settings.RISK_THRESHOLD_CHALLENGE:
        level = "CHALLENGE"
    elif score >= settings.RISK_THRESHOLD_SUSPICIOUS:
        level = "SUSPICIOUS"
    else:
        level = "NORMAL"

    return RiskResult(score=score, level=level, signals=signals)
```

```python
// File: backend\app\security\sessions.py
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import AdminSession, AdminUser
from app.config import get_settings

settings = get_settings()


def _hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session_token() -> tuple[str, str]:
    token = secrets.token_urlsafe(48)
    return token, _hash_session_token(token)


async def create_session(
    db: AsyncSession,
    admin_id: UUID,
    ip_address: str | None,
    user_agent: str | None,
    remember_me: bool = False,
    device_id: UUID | None = None,
) -> str:
    token, token_hash = create_session_token()
    idle = timedelta(minutes=settings.SESSION_IDLE_MINUTES)
    if remember_me:
        absolute = timedelta(hours=settings.SESSION_ABSOLUTE_HOURS)
    else:
        absolute = timedelta(hours=2)

    existing = await db.execute(
        select(AdminSession).where(
            AdminSession.admin_id == admin_id,
            AdminSession.revoked_at.is_(None),
            AdminSession.expires_at > datetime.now(timezone.utc),
        )
    )
    active_count = len(existing.scalars().all())

    if active_count >= settings.MAX_CONCURRENT_SESSIONS:
        oldest = await db.execute(
            select(AdminSession).where(
                AdminSession.admin_id == admin_id,
                AdminSession.revoked_at.is_(None),
            ).order_by(AdminSession.created_at.asc()).limit(1)
        )
        oldest_session = oldest.scalar_one_or_none()
        if oldest_session:
            oldest_session.revoked_at = datetime.now(timezone.utc)

    now = datetime.now(timezone.utc)
    session = AdminSession(
        admin_id=admin_id,
        device_id=device_id,
        session_hash=token_hash,
        ip_address=ip_address,
        user_agent=user_agent,
        expires_at=now + min(idle, absolute),
        absolute_expires_at=now + absolute,
    )
    db.add(session)
    await db.commit()
    return token


async def get_session(db: AsyncSession, token: str) -> AdminSession | None:
    token_hash = _hash_session_token(token)
    stmt = (
        select(AdminSession)
        .where(
            AdminSession.session_hash == token_hash,
            AdminSession.revoked_at.is_(None),
            AdminSession.expires_at > datetime.now(timezone.utc),
        )
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def touch_session(db: AsyncSession, session: AdminSession) -> None:
    session.last_seen_at = datetime.now(timezone.utc)
    idle = timedelta(minutes=settings.SESSION_IDLE_MINUTES)
    if session.absolute_expires_at is not None:
        absolute_limit = session.absolute_expires_at
    else:
        # Legacy rows created before 006 migration.
        absolute_limit = session.created_at + timedelta(hours=settings.SESSION_ABSOLUTE_HOURS)
    session.expires_at = min(
        datetime.now(timezone.utc) + idle,
        absolute_limit,
    )
    await db.commit()


async def revoke_session(db: AsyncSession, token: str) -> None:
    token_hash = _hash_session_token(token)
    stmt = update(AdminSession).where(
        AdminSession.session_hash == token_hash,
        AdminSession.revoked_at.is_(None),
    ).values(revoked_at=datetime.now(timezone.utc))
    await db.execute(stmt)
    await db.commit()


async def revoke_all_sessions(db: AsyncSession, admin_id: UUID) -> None:
    stmt = update(AdminSession).where(
        AdminSession.admin_id == admin_id,
        AdminSession.revoked_at.is_(None),
    ).values(revoked_at=datetime.now(timezone.utc))
    await db.execute(stmt)
    await db.commit()


async def revoke_other_sessions(db: AsyncSession, admin_id: str | UUID, current_token: str) -> None:
    """Revoke every active session for the admin except the one holding current_token."""
    current_hash = _hash_session_token(current_token)
    stmt = update(AdminSession).where(
        AdminSession.admin_id == admin_id,
        AdminSession.session_hash != current_hash,
        AdminSession.revoked_at.is_(None),
    ).values(revoked_at=datetime.now(timezone.utc))
    await db.execute(stmt)
    await db.commit()
```

```python
// File: backend\app\security\tokens.py
import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import jwt
from jwt.exceptions import InvalidTokenError
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

from app.config import get_settings
from app.security.rate_limit import get_redis

settings = get_settings()

ACCESS_TOKEN_TTL = timedelta(minutes=15)
REFRESH_TOKEN_TTL = timedelta(days=7)
REFRESH_TOKEN_TTL_SHORT = timedelta(hours=2)
WS_TICKET_TTL = timedelta(seconds=30)
EXCHANGE_CODE_TTL = timedelta(seconds=30)

ACCESS_ALGORITHM = "RS256"

def _keys_dir() -> Path:
    # Same resolution as Settings.keys_dir_path; read lazily so tests / env
    # tweaks after import are respected.
    if settings.KEYS_DIR:
        return Path(settings.KEYS_DIR)
    return Path(__file__).resolve().parent.parent.parent.parent / ".keys"


def _private_key_file() -> Path:
    return _keys_dir() / "jws_private.pem"


def _public_key_file() -> Path:
    return _keys_dir() / "jws_public.pem"


_signing_key: Optional[str] = None
_verify_key: Optional[str] = None


class TokenError(Exception):
    pass


class TokenReuseDetected(TokenError):
    pass


class TokenExpired(TokenError):
    pass


class InvalidToken(TokenError):
    pass


def _ensure_keys() -> None:
    """Return the PEM private/public key strings, generating and persisting an
    RSA-2048 pair on first use if not already present or provided via env."""
    global _signing_key, _verify_key

    if _signing_key and _verify_key:
        return

    env_priv = (settings.JWT_SIGNING_PRIVATE_KEY or "").strip()
    env_pub = (settings.JWT_SIGNING_PUBLIC_KEY or "").strip()

    if env_priv and env_priv.startswith("-----BEGIN") and env_pub and env_pub.startswith("-----BEGIN"):
        _signing_key = env_priv
        _verify_key = env_pub
        return

    if _private_key_file().exists() and _public_key_file().exists():
        _signing_key = _private_key_file().read_text()
        _verify_key = _public_key_file().read_text()
        return

    if settings.PRODUCTION:
        # Fail fast rather than minting a fresh keypair in prod — that would
        # silently invalidate every live token/session/WS ticket. check_insecure_defaults()
        # should have refused boot already; this is the runtime backstop.
        raise RuntimeError(
            f"No RS256 PEM pair found under {_keys_dir()} in production. "
            "Populate .keys/ or set JWT_SIGNING_PRIVATE_KEY/PUBLIC_KEY."
        )

    keys_dir = _keys_dir()
    keys_dir.mkdir(parents=True, exist_ok=True)
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend(),
    )
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()

    _private_key_file().write_text(private_pem)
    _public_key_file().write_text(public_pem)
    try:
        os.chmod(_private_key_file(), 0o600)
    except Exception:
        pass

    _signing_key = private_pem
    _verify_key = public_pem


def _signing_key_str() -> str:
    _ensure_keys()
    assert _signing_key is not None
    return _signing_key


def _verify_key_str() -> str:
    _ensure_keys()
    assert _verify_key is not None
    return _verify_key


def _base_claims(sub: str, audience: str, ttl: timedelta, token_type: str) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "sub": str(sub),
        "aud": audience,
        "iat": now,
        "nbf": now,
        "exp": now + ttl,
        "type": token_type,
        "jti": secrets.token_urlsafe(16),
    }


def create_access_token(
    admin_id: str,
    username: str,
    role: str,
    role_level: int,
    session_id: str | None = None,
) -> str:
    claims = _base_claims(admin_id, "access", ACCESS_TOKEN_TTL, "access")
    claims.update({
        "username": username,
        "role": role,
        "role_level": role_level,
    })
    if session_id:
        claims["sid"] = str(session_id)
    return jwt.encode(claims, _signing_key_str(), algorithm=ACCESS_ALGORITHM)


def verify_access_token(token: str) -> dict:
    try:
        claims = jwt.decode(
            token,
            _verify_key_str(),
            algorithms=[ACCESS_ALGORITHM],
            audience="access",
            options={"require": ["sub", "exp", "jti", "type"]},
        )
    except jwt.ExpiredSignatureError:
        raise TokenExpired()
    except InvalidTokenError:
        raise InvalidToken()
    if claims.get("type") != "access":
        raise InvalidToken()
    return claims


def _hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def create_refresh_token(
    admin_id: str,
    remember_me: bool = False,
    family: Optional[str] = None,
) -> tuple[str, str]:
    r = await get_redis()
    token = secrets.token_urlsafe(48)
    token_hash = _hash_refresh_token(token)
    family = family or secrets.token_urlsafe(16)

    ttl = REFRESH_TOKEN_TTL if remember_me else REFRESH_TOKEN_TTL_SHORT
    now = datetime.now(timezone.utc)
    expires_at = now + ttl

    pipe = r.pipeline()
    pipe.hset(f"refresh:{token_hash}", mapping={
        "user_id": str(admin_id),
        "family": family,
        "used": "0",
        "issued_at": int(now.timestamp()),
        "expires_at": int(expires_at.timestamp()),
    })
    pipe.expire(f"refresh:{token_hash}", int(ttl.total_seconds()))
    pipe.sadd(f"refresh_family:{family}", token_hash)
    pipe.expire(f"refresh_family:{family}", int(ttl.total_seconds()))
    await pipe.execute()

    return token, family


async def rotate_refresh_token(refresh_token: str) -> tuple[str, str]:
    r = await get_redis()
    token_hash = _hash_refresh_token(refresh_token)
    data = await r.hgetall(f"refresh:{token_hash}")
    if not data:
        raise InvalidToken()

    now = datetime.now(timezone.utc)
    expires_at = datetime.fromtimestamp(int(data["expires_at"]), tz=timezone.utc)
    if expires_at <= now:
        await r.delete(f"refresh:{token_hash}")
        raise TokenExpired()

    if data.get("used") == "1":
        await _revoke_family(r, data["family"])
        raise TokenReuseDetected()

    user_id = data["user_id"]
    family = data["family"]
    remember_me = (expires_at - datetime.fromtimestamp(int(data["issued_at"]), tz=timezone.utc)) > timedelta(hours=6)

    pipe = r.pipeline()
    pipe.hset(f"refresh:{token_hash}", "used", "1")
    pipe.expire(f"refresh:{token_hash}", 60)
    await pipe.execute()

    new_token, _ = await create_refresh_token(user_id, remember_me=remember_me, family=family)
    return new_token, user_id


async def _revoke_family(r, family: str) -> None:
    member_hashes = await r.smembers(f"refresh_family:{family}")
    for member_hash in member_hashes:
        await r.delete(f"refresh:{member_hash}")
    await r.delete(f"refresh_family:{family}")


async def revoke_refresh_token(refresh_token: str) -> None:
    r = await get_redis()
    token_hash = _hash_refresh_token(refresh_token)
    data = await r.hgetall(f"refresh:{token_hash}")
    if data:
        await _revoke_family(r, data["family"])


async def revoke_refresh_family(family: str) -> None:
    r = await get_redis()
    await _revoke_family(r, family)


async def revoke_all_refresh_tokens(admin_id: str) -> None:
    r = await get_redis()
    cursor = 0
    while True:
        cursor, keys = await r.scan(cursor=cursor, match="refresh:*", count=200)
        for key in keys:
            data = await r.hgetall(key)
            if data and data.get("user_id") == str(admin_id):
                await _revoke_family(r, data["family"])
        if cursor == 0:
            break


async def block_access_token_jti(jti: str, ttl_seconds: int = 900) -> None:
    r = await get_redis()
    await r.setex(f"access_block:{jti}", ttl_seconds, "1")


async def is_access_token_blocked(jti: str) -> bool:
    r = await get_redis()
    return await r.exists(f"access_block:{jti}") > 0


def create_ws_ticket(challenge_id: str) -> str:
    claims = _base_claims(challenge_id, "ws_auth", WS_TICKET_TTL, "ws_ticket")
    return jwt.encode(claims, _signing_key_str(), algorithm=ACCESS_ALGORITHM)


def verify_ws_ticket(ticket: str) -> dict:
    try:
        claims = jwt.decode(
            ticket,
            _verify_key_str(),
            algorithms=[ACCESS_ALGORITHM],
            audience="ws_auth",
            options={"require": ["sub", "exp", "jti", "type"]},
        )
    except jwt.ExpiredSignatureError:
        raise TokenExpired()
    except InvalidTokenError:
        raise InvalidToken()
    if claims.get("type") != "ws_ticket":
        raise InvalidToken()
    return claims


def create_exchange_code(admin_id: str) -> str:
    claims = _base_claims(admin_id, "auth_exchange", EXCHANGE_CODE_TTL, "exchange")
    return jwt.encode(claims, _signing_key_str(), algorithm=ACCESS_ALGORITHM)


def verify_exchange_code(code: str) -> dict:
    try:
        claims = jwt.decode(
            code,
            _verify_key_str(),
            algorithms=[ACCESS_ALGORITHM],
            audience="auth_exchange",
            options={"require": ["sub", "exp", "jti", "type"]},
        )
    except jwt.ExpiredSignatureError:
        raise TokenExpired()
    except InvalidTokenError:
        raise InvalidToken()
    if claims.get("type") != "exchange":
        raise InvalidToken()
    return claims


async def consume_exchange_code(code: str) -> str:
    r = await get_redis()
    jti = hashlib.sha256(code.encode()).hexdigest()
    key = f"auth:exchange:{jti}"
    if await r.set(key, "1", nx=True, ex=int(EXCHANGE_CODE_TTL.total_seconds())):
        return code
    raise InvalidToken()
```

```python
// File: backend\app\security\turnstile.py
"""Cloudflare Turnstile server-side validation.

Verifies a Turnstile token against Cloudflare's Siteverify endpoint. This
must run on the backend — a client-side-only check is trivially forgeable.
Tokens are single-use and short-lived (5 minutes), so the frontend must
request a fresh token for every login attempt.

The site runs one widget per form (admin_login, contact_form), and each
widget has its own secret. Siteverify rejects a token verified with a secret
that does not match the widget that minted it, so every call must pass the
`action` it intends to assert — this is what makes a token minted for one
form unplayable against another.
"""

from __future__ import annotations

import httpx

from app.config import get_settings

settings = get_settings()

_SITEVERIFY_URL = (
    "https://challenges.cloudflare.com/turnstile/v0/siteverify"
)


async def verify_turnstile(
    token: str,
    remote_ip: str | None = None,
    *,
    action: str | None = None,
) -> dict:
    """Verify a Turnstile token. Returns the parsed Siteverify response,
    always with a "success" key. Fail-closed: any error => success False.

    `action` selects which widget's secret to verify against. Each widget has
    its own secret and siteverify rejects a token that was minted by a
    different widget, so callers must pass the action they intend to assert in
    `captcha_accepted` — the two sides must agree or every request fails.
    Defaults to the admin_login action when omitted.
    """
    if action is not None:
        secret = settings.turnstile_secret_for(action)
    else:
        secret = settings.turnstile_secret_for(settings.TURNSTILE_EXPECTED_ACTION)
    if not secret:
        # Misconfiguration must never silently allow logins.
        return {"success": False, "error-codes": ["missing-input-secret"]}
    if not token or len(token) > 2048:
        return {"success": False, "error-codes": ["missing-input-response"]}

    payload: dict = {
        "secret": secret,
        "response": token,
    }
    if remote_ip and remote_ip not in ("unknown", "testclient"):
        payload["remoteip"] = remote_ip

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(_SITEVERIFY_URL, data=payload)
        return resp.json()
    except Exception:
        return {"success": False, "error-codes": ["internal-error"]}


def captcha_accepted(
    result: dict,
    remote_ip: str | None = None,
    expected_action: str | None = None,
) -> bool:
    """Full acceptance check: success + action + (prod-only) hostname.

    `expected_action` defaults to the global TURNSTILE_EXPECTED_ACTION so the
    admin login call site is unchanged. Pass it explicitly for endpoints that
    use their own widget/action, so a token minted for one form cannot be
    replayed against another.
    """
    if not isinstance(result, dict) or not result.get("success"):
        return False
    if expected_action is None:
        expected_action = settings.TURNSTILE_EXPECTED_ACTION
    if result.get("action") and result.get("action") != expected_action:
        return False
    # Hostname is only pinned in production; in dev the ngrok domain and
    # localhost change frequently, so we don't hard-fail on it there.
    if settings.PRODUCTION:
        allowed = {
            h.strip() for h in settings.TURNSTILE_EXPECTED_HOSTNAMES.split(",") if h.strip()
        }
        hostname = result.get("hostname", "")
        if allowed and hostname not in allowed:
            return False
    return True
```

```python
// File: backend\app\services\__init__.py

```

```python
// File: backend\app\services\otp_service.py
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from uuid import UUID
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import AuthChallenge, OtpPurpose, OtpDelivery
from app.config import get_settings

settings = get_settings()


def generate_otp(length: int = 6) -> str:
    return "".join(str(secrets.randbelow(10)) for _ in range(length))


def _hash_otp(otp: str) -> str:
    pepper = settings.OTP_PEPPER
    return hashlib.sha256(f"{pepper}:{otp}".encode()).hexdigest()


async def create_challenge(
    db: AsyncSession,
    admin_id: UUID,
    purpose: OtpPurpose = OtpPurpose.login,
    ttl_seconds: int = 300,
) -> AuthChallenge:
    challenge = secrets.token_urlsafe(32)
    challenge_hash = hashlib.sha256(challenge.encode()).hexdigest()

    auth_challenge = AuthChallenge(
        admin_id=admin_id,
        challenge_hash=challenge_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds),
        otp_purpose=purpose,
    )
    db.add(auth_challenge)
    await db.commit()
    return auth_challenge


async def get_challenge(db: AsyncSession, challenge_id: UUID) -> AuthChallenge | None:
    stmt = select(AuthChallenge).where(
        AuthChallenge.id == challenge_id,
        AuthChallenge.consumed_at.is_(None),
        AuthChallenge.expires_at > datetime.now(timezone.utc),
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_challenge_by_hash(db: AsyncSession, challenge_hash: str) -> AuthChallenge | None:
    stmt = select(AuthChallenge).where(
        AuthChallenge.challenge_hash == challenge_hash,
        AuthChallenge.consumed_at.is_(None),
        AuthChallenge.expires_at > datetime.now(timezone.utc),
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def set_otp_on_challenge(
    db: AsyncSession,
    challenge_id: UUID,
    otp: str,
    delivery: OtpDelivery,
    telegram_message_id: int | None = None,
) -> None:
    otp_hash = _hash_otp(otp)
    stmt = update(AuthChallenge).where(AuthChallenge.id == challenge_id).values(
        otp_hash=otp_hash,
        otp_delivery=delivery,
        telegram_message_id=telegram_message_id,
        otp_attempts=0,
    )
    await db.execute(stmt)
    await db.commit()


async def verify_otp(db: AsyncSession, challenge_id: UUID, otp: str) -> bool:
    challenge = await get_challenge(db, challenge_id)
    if not challenge:
        return False
    if not challenge.otp_hash:
        return False
    if challenge.otp_attempts >= 5:
        return False

    otp_hash = _hash_otp(otp)
    if challenge.otp_hash != otp_hash:
        challenge.otp_attempts += 1
        await db.commit()
        return False

    challenge.otp_verified_at = datetime.now(timezone.utc)
    await db.commit()
    return True


async def consume_challenge(db: AsyncSession, challenge_id: UUID) -> None:
    stmt = update(AuthChallenge).where(AuthChallenge.id == challenge_id).values(
        consumed_at=datetime.now(timezone.utc)
    )
    await db.execute(stmt)
    await db.commit()


async def can_resend_otp(db: AsyncSession, challenge_id: UUID, cooldown_seconds: int = 60) -> tuple[bool, float]:
    challenge = await get_challenge(db, challenge_id)
    if not challenge:
        return False, 0.0
    if not challenge.created_at:
        return True, 0.0

    elapsed = (datetime.now(timezone.utc) - challenge.created_at).total_seconds()
    if elapsed < cooldown_seconds:
        return False, cooldown_seconds - elapsed
    return True, 0.0
```

```python
// File: backend\app\services\storage_service.py
"""S3/MinIO storage for contact-message attachments.

The stack already ships a MinIO service (docker-compose: "storage") and boto3
is a declared dependency. Files are buffered in memory before upload — safe
because MAX_ATTACHMENT_BYTES caps each file at 25 MiB.
"""
import asyncio
import hashlib
import re
import uuid
from typing import Iterator, Tuple

import boto3
from botocore.client import Config as BotoConfig
from botocore.exceptions import ClientError

from app.config import get_settings

_DOWNLOAD_CHUNK = 64 * 1024


def sanitize_filename(name: str) -> str:
    """Reduce a client-supplied filename to a safe basename."""
    name = name.replace("\\", "/").split("/")[-1]
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._")
    return name[:120] or "file"


class StorageError(Exception):
    pass


class StorageService:
    def __init__(self):
        settings = get_settings()
        self._bucket = settings.S3_BUCKET
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT,
            region_name=settings.S3_REGION,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            use_ssl=settings.S3_USE_SSL,
            config=BotoConfig(signature_version="s3v4"),
        )

    # ── bucket bootstrap ────────────────────────────────────────────
    def _ensure_bucket_sync(self) -> None:
        try:
            self._client.head_bucket(Bucket=self._bucket)
        except ClientError:
            try:
                self._client.create_bucket(Bucket=self._bucket)
            except ClientError as exc:
                raise StorageError(f"cannot create bucket {self._bucket}: {exc}") from exc

    async def ensure_bucket(self) -> None:
        await asyncio.to_thread(self._ensure_bucket_sync)

    # ── upload ──────────────────────────────────────────────────────
    def _put_sync(self, object_key: str, data: bytes, content_type: str) -> None:
        try:
            self._client.put_object(
                Bucket=self._bucket,
                Key=object_key,
                Body=data,
                ContentType=content_type,
            )
        except ClientError as exc:
            raise StorageError(f"upload failed for {object_key}: {exc}") from exc

    async def upload_attachment(
        self, message_id: uuid.UUID, filename: str, content_type: str, data: bytes
    ) -> Tuple[str, int, str]:
        """Store bytes and return (object_key, size_bytes, sha256_hex)."""
        safe = sanitize_filename(filename)
        object_key = f"contact/{message_id}/{uuid.uuid4().hex}/{safe}"
        size = len(data)
        sha256 = hashlib.sha256(data).hexdigest()
        await asyncio.to_thread(self._put_sync, object_key, data, content_type or "application/octet-stream")
        return object_key, size, sha256

    # ── download ────────────────────────────────────────────────────
    def _get_sync(self, object_key: str):
        resp = self._client.get_object(Bucket=self._bucket, Key=object_key)
        return resp["Body"]

    async def open_attachment(self, object_key: str):
        """Return a chunk iterator over the stored object."""
        body = await asyncio.to_thread(self._get_sync, object_key)

        def _iter() -> Iterator[bytes]:
            while True:
                chunk = body.read(_DOWNLOAD_CHUNK)
                if not chunk:
                    break
                yield chunk

        # Return the running iterator — the bare generator function would
        # make StreamingResponse fail with "'function' object is not iterable"
        # after response headers were already sent (empty 200).
        return _iter()

    # ── delete ──────────────────────────────────────────────────────
    def _delete_sync(self, object_key: str) -> None:
        try:
            self._client.delete_object(Bucket=self._bucket, Key=object_key)
        except ClientError as exc:
            raise StorageError(f"delete failed for {object_key}: {exc}") from exc

    async def delete_attachment(self, object_key: str) -> None:
        """Remove an object from storage."""
        await asyncio.to_thread(self._delete_sync, object_key)


_storage: StorageService | None = None


def get_storage() -> StorageService:
    global _storage
    if _storage is None:
        _storage = StorageService()
    return _storage
```

```python
// File: backend\app\services\telegram_service.py
import httpx
import structlog
from app.config import get_settings

settings = get_settings()
logger = structlog.get_logger()


async def send_otp(chat_id: str, otp_code: str) -> bool:
    if not settings.TELEGRAM_BOT_TOKEN:
        logger.warning("telegram_bot_token_not_configured")
        return False
    if not chat_id:
        logger.warning("telegram_chat_id_not_set")
        return False

    text = (
        f"🔐 <b>vijaykrsha.online</b>\n\n"
        f"Your verification code: <code>{otp_code}</code>\n\n"
        f"This code expires in {settings.TELEGRAM_OTP_TTL_SECONDS // 60} minutes.\n"
        f"⚠️ Do NOT share this code with anyone."
    )
    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok"):
                    logger.info("otp_sent", chat_id=chat_id)
                    return True
            logger.error("otp_send_failed", status=resp.status_code, body=resp.text)
            return False
        except Exception as e:
            logger.error("otp_send_exception", error=str(e))
            return False
```

```python
// File: backend\app\services\totp_service.py
import io
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import pyotp
from app.config import get_settings

settings = get_settings()

PENDING_TOTP_TTL_SECONDS = 600


def _derive_key() -> bytes:
    password = settings.TOTP_ENCRYPTION_KEY.encode()
    salt = b"vijaykrsha-totp-salt-v1"
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=480000,
    )
    return base64.urlsafe_b64encode(kdf.derive(password))


_fernet = Fernet(_derive_key())


def generate_secret() -> str:
    return pyotp.random_base32()


def encrypt_secret(secret: str) -> bytes:
    return _fernet.encrypt(secret.encode())


def decrypt_secret(ciphertext: bytes) -> str:
    return _fernet.decrypt(ciphertext).decode()


def verify_totp(secret: str, code: str) -> bool:
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)


def get_provisioning_uri(secret: str, username: str) -> str:
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=username, issuer_name="vijaykrsha.online")


def _pending_key(admin_id: str) -> str:
    return f"totp_pending:{admin_id}"


async def store_pending_secret(admin_id: str, secret: str) -> None:
    """Store the enrollment secret server-side (encrypted, short TTL).

    The client never round-trips the secret back on enable; only the code.
    """
    from app.security.rate_limit import get_redis
    r = await get_redis()
    ciphertext = encrypt_secret(secret).decode()
    await r.setex(_pending_key(admin_id), PENDING_TOTP_TTL_SECONDS, ciphertext)


async def get_pending_secret(admin_id: str) -> str | None:
    from app.security.rate_limit import get_redis
    r = await get_redis()
    val = await r.get(_pending_key(admin_id))
    if not val:
        return None
    return decrypt_secret(val.encode())


async def clear_pending_secret(admin_id: str) -> None:
    from app.security.rate_limit import get_redis
    r = await get_redis()
    await r.delete(_pending_key(admin_id))
```

```dockerfile
# File: backend\Dockerfile
FROM python:3.12-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml .
RUN pip install --no-cache-dir .
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```dockerfile
# File: backend\Dockerfile.dev
FROM python:3.12-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml .
RUN pip install --no-cache-dir .
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

```toml
# File: backend\pyproject.toml
[project]
name = "vijaykrsha-backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi",
    "uvicorn[standard]",
    "sqlalchemy[asyncio]",
    "asyncpg",
    "alembic",
    "pydantic-settings",
    "pydantic[email]",
    "argon2-cffi",
    "pyotp",
    "cryptography",
    "boto3",
    "httpx",
    "python-multipart",
    "structlog",
    "redis[hiredis]>=5.0.0",
    "user-agents",
    "pyjwt[crypto]>=2.8.0",
]

[project.optional-dependencies]
dev = [
    "pytest",
    "pytest-asyncio",
    "httpx",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
```

```python
// File: backend\tests\test_audit_helpers.py
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
```

```python
// File: backend\tests\test_route_order.py
from fastapi.routing import APIRoute

from app.api.admin_messages import router as messages_router
from app.api.admin_trash import router as trash_router


def _first_route(router, path: str, method: str):
    for r in router.routes:
        if isinstance(r, APIRoute) and r.path == path and method in r.methods:
            return r
    return None


def _assert_resolves_to(router, path: str, method: str, expected: str):
    route = _first_route(router, path, method)
    assert route is not None, f"no route registered for {method} {path}"
    assert (
        route.endpoint.__name__ == expected
    ), f"{method} {path} resolved to {route.endpoint.__name__!r}, expected {expected!r}"


def test_bulk_trash_not_shadowed_by_single_trash():
    _assert_resolves_to(messages_router, "/admin/api/messages/bulk/trash", "POST", "bulk_trash")


def test_bulk_pin_flag_not_shadowed_by_single_message_patch():
    _assert_resolves_to(messages_router, "/admin/api/messages/bulk", "PATCH", "bulk_pin_flag")


def test_bulk_restore_not_shadowed_by_single_restore():
    _assert_resolves_to(trash_router, "/admin/api/trash/bulk/restore", "POST", "bulk_restore")
```

```yaml
# File: docker-compose.dev.yml
services:
  database-dev:
    image: postgres:16-alpine
    container_name: vijaykrsha-online-database-dev
    restart: unless-stopped
    environment:
      POSTGRES_DB: vijaykrsha_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_DEV_PASSWORD}
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:26003:5432"
    networks:
      - dev-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d vijaykrsha_dev"]
      interval: 5s
      timeout: 5s
      retries: 5

  storage-dev:
    image: minio/minio:latest
    container_name: vijaykrsha-online-storage-dev
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_DEV_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_DEV_SECRET_KEY}
    volumes:
      - minio_dev_data:/data
    ports:
      - "127.0.0.1:26005:9000"
    networks:
      - dev-network

  redis-dev:
    image: redis:7-alpine
    container_name: vijaykrsha-online-redis-dev
    restart: unless-stopped
    command: redis-server --maxmemory 64mb --maxmemory-policy allkeys-lru
    ports:
      - "127.0.0.1:26004:6379"
    networks:
      - dev-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend-dev:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    container_name: vijaykrsha-online-backend-dev
    restart: unless-stopped
    depends_on:
      database-dev:
        condition: service_healthy
      storage-dev:
        condition: service_started
      redis-dev:
        condition: service_healthy
    ports:
      - "26001:8000"
    env_file:
      - ./env/.env.dev
    environment:
      KEYS_DIR: "/app/.keys"
    volumes:
      - ./.keys:/app/.keys
    networks:
      - dev-network

  frontend-dev:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        # Vite inlines VITE_* at build time — pass via env/.env.dev if a
        # dev-specific widget is ever needed. When empty (the ./src/lib/
        # defaults are the real site keys anyway).
        VITE_TURNSTILE_SITE_KEY: ${VITE_TURNSTILE_SITE_KEY:-}
        VITE_TURNSTILE_CONTACT_SITE_KEY: ${VITE_TURNSTILE_CONTACT_SITE_KEY:-}
    container_name: vijaykrsha-online-frontend-dev
    restart: unless-stopped
    ports:
      # Dev HTTPS-only on host :26002 (mkcert TLS, no cloudflared). The host
      # port maps straight to the container's 443 listener from
      # nginx.ssl.conf; there is deliberately no plain-HTTP host mapping
      # anymore. The Dockerfile still bakes the :80 vhost (nginx.conf) so the
      # standalone `docker compose up` frontend keeps working over HTTP.
      - "26002:443"
    volumes:
      # nginx.ssl.conf is glob-included by the base nginx conf.d/*.conf, so
      # this mount is what turns the 443 listener on. ./dev-tls holds the
      # mkcert-generated cert/key (gitignored).
      - ./nginx.ssl.conf:/etc/nginx/conf.d/ssl.conf:ro
      - ./dev-tls:/etc/nginx/dev-tls:ro
    depends_on:
      - backend-dev
    networks:
      - dev-network

volumes:
  postgres_dev_data:
  minio_dev_data:

networks:
  dev-network:
    name: vijaykrsha-dev
```

```yaml
# File: docker-compose.prod.yml
services:
  database-prod:
    image: postgres:16-alpine
    container_name: vijaykrsha-online-database-prod
    restart: unless-stopped
    environment:
      POSTGRES_DB: vijaykrsha
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PROD_PASSWORD:?POSTGRES_PROD_PASSWORD must be set}
    volumes:
      - vijaykrshaonline_pgdata:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:26022:5432"
    networks:
      - prod-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d vijaykrsha"]
      interval: 5s
      timeout: 5s
      retries: 5

  storage-prod:
    image: minio/minio:latest
    container_name: vijaykrsha-online-storage-prod
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_PROD_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_PROD_SECRET_KEY}
    volumes:
      - vijaykrshaonline_miniodata:/data
    ports:
      - "127.0.0.1:26024:9000"
    networks:
      - prod-network

  redis-prod:
    image: redis:7-alpine
    container_name: vijaykrsha-online-redis-prod
    restart: unless-stopped
    command: redis-server --maxmemory 128mb --maxmemory-policy allkeys-lru
    ports:
      - "127.0.0.1:26023:6379"
    networks:
      - prod-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend-prod:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: vijaykrsha-online-backend-prod
    restart: unless-stopped
    depends_on:
      database-prod:
        condition: service_healthy
      storage-prod:
        condition: service_started
      redis-prod:
        condition: service_healthy
    ports:
      - "26021:8000"
    env_file:
      - ./env/.env.prod
    environment:
      PRODUCTION: "true"
      KEYS_DIR: "/app/.keys"
    # Cloudflare Turnstile secrets are deliberately NOT listed here — they come
    # from the gitignored registry at .keys/turnstile.json, already visible via
    # the KEYS_DIR bind mount above. Adding them under `environment:` with a
    # shell-interpolated default would resolve to an empty string when the
    # shell var is unset and silently OVERRIDE the file, which fails Turnstile
    # verification closed and rejects every login and contact submission.
    # To override per-environment instead, set (both required for their
    # respective form to work in production):
    #   TURNSTILE_ENABLED=true
    #   TURNSTILE_SECRET_KEY=<admin-login secret>
    #   TURNSTILE_CONTACT_SECRET_KEY=<contact-form secret>
    #   TURNSTILE_CONTACT_REQUIRED=true
    volumes:
      - ./.keys:/app/.keys
    networks:
      - prod-network

  # Public API edge for api.vijaykrsha.online. The Cloudflare tunnel
  # terminates TLS on Cloudflare's edge and forwards to this container's
  # published loopback port. Serves API routes under /vega/api/* only;
  # every other path returns a plain nginx 404, never a frontend document.
  api-gateway-prod:
    image: nginx:1.27-alpine
    container_name: vijaykrsha-online-api-gateway-prod
    restart: unless-stopped
    depends_on:
      - backend-prod
    ports:
      - "127.0.0.1:26025:80"
    volumes:
      - ./nginx.api-gateway.prod.conf:/etc/nginx/conf.d/default.conf:ro
    # Proves nginx is really serving the /vega/api mount. Without this, a
    # stopped gateway is invisible: `restart: unless-stopped` will not revive a
    # manually-stopped container, and Cloudflare answers 502 for every API
    # request while the backend itself is perfectly healthy.
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O /dev/null http://127.0.0.1/vega/api/admin/api/auth/public-key || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
    networks:
      - prod-network

volumes:
  vijaykrshaonline_pgdata:
    external: true
  vijaykrshaonline_miniodata:
    external: true

networks:
  prod-network:
    name: vijaykrsha-prod
```

```yaml
# File: docker-compose.yml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: vijaykrsha
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  storage:
    image: minio/minio:latest
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY:-minioadmin}
    volumes:
      - miniodata:/data
    ports:
      - "127.0.0.1:9000:9000"
      - "127.0.0.1:9001:9001"
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --maxmemory 128mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
      storage:
        condition: service_healthy
      redis:
        condition: service_healthy
    ports:
      - "127.0.0.1:8000:8000"
    volumes:
      # Same mount as docker-compose.prod.yml — the backend reads the
      # Turnstile secret registry (turnstile.json) and the JWS PEMs from
      # KEYS_DIR, so without this the dev container cannot see .keys/ and
      # every CAPTCHA-protected endpoint fails closed.
      - ./.keys:/app/.keys
    environment:
      DATABASE_URL: postgresql+asyncpg://postgres:${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}@db:5432/vijaykrsha
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
      TELEGRAM_ADMIN_CHAT_ID: ${TELEGRAM_ADMIN_CHAT_ID}
      TOTP_ENCRYPTION_KEY: ${TOTP_ENCRYPTION_KEY:?TOTP_ENCRYPTION_KEY must be set}
      OTP_PEPPER: ${OTP_PEPPER:-vijaykrsha-otp-pepper-change-me}
      REDIS_URL: redis://redis:6379/0
      S3_ENDPOINT: http://storage:9000
      S3_ACCESS_KEY: ${MINIO_ACCESS_KEY:-minioadmin}
      S3_SECRET_KEY: ${MINIO_SECRET_KEY:-minioadmin}
      CORS_ORIGINS: ${CORS_ORIGINS:-http://localhost:5173,https://vijaykrsha.online}
      KEYS_DIR: /app/.keys
      # Cloudflare Turnstile. Both secrets default to .keys/turnstile.json, so
      # these are optional overrides (a bare `docker compose up` must still
      # work) rather than required — the production guard in app/config.py
      # refuses to boot if a required widget ends up with no secret at all.
      TURNSTILE_ENABLED: ${TURNSTILE_ENABLED:-true}
      TURNSTILE_SECRET_KEY: ${TURNSTILE_SECRET_KEY:-}
      TURNSTILE_CONTACT_SECRET_KEY: ${TURNSTILE_CONTACT_SECRET_KEY:-}
      TURNSTILE_CONTACT_REQUIRED: ${TURNSTILE_CONTACT_REQUIRED:-true}

  frontend:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        # Vite inlines VITE_* at build time, so the public Turnstile site
        # keys must be passed here rather than as runtime environment vars.
        VITE_TURNSTILE_SITE_KEY: ${VITE_TURNSTILE_SITE_KEY:-}
        VITE_TURNSTILE_CONTACT_SITE_KEY: ${VITE_TURNSTILE_CONTACT_SITE_KEY:-}
    restart: unless-stopped
    ports:
      - "3000:80"
    depends_on:
      - backend

volumes:
  pgdata:
  miniodata:
```

```dockerfile
# File: Dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
# Vite inlines VITE_* vars at build time, so they must be present in the build
# stage — setting them only in the runtime environment has no effect.
ARG VITE_TURNSTILE_SITE_KEY=""
ARG VITE_TURNSTILE_CONTACT_SITE_KEY=""
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY
ENV VITE_TURNSTILE_CONTACT_SITE_KEY=$VITE_TURNSTILE_CONTACT_SITE_KEY
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```typescript
// File: functions\api\[[path]].ts
export interface Env {
  API_ORIGIN: string;
}

// Public API host serves the backend only, mounted under this prefix.
// The prod gateway (nginx.api-gateway.prod.conf) strips /vega/api/ and
// forwards the remainder, so /vega/api/admin/api/auth/login reaches the
// backend's /admin/api/auth route.
const API_MOUNT = "/vega/api";

const ALLOWED_ORIGINS = [
  "https://vijaykrsha.online",
  "https://vijaykrsha-website.pages.dev",
];

function corsHeaders(origin: string | null): Record<string, string> {
  // Only reflect an allowlisted origin. Unknown origins get NO CORS headers,
  // so browsers block any cross-origin read of the response.
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return {};
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token",
    "Access-Control-Expose-Headers": "X-RateLimit-RetryAfter",
    "Access-Control-Max-Age": "86400",
  };
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request } = context;
  const origin = request.headers.get("Origin");

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\//, "/");

  // Build the upstream by concatenation, not URL(path, base): `path` always
  // begins with "/", so the URL constructor would resolve it as an absolute
  // path and silently discard the /vega/api mount prefix.
  const apiOrigin = (context.env.API_ORIGIN || "https://api.vijaykrsha.online").replace(
    /\/+$/,
    ""
  );
  const backendUrl = new URL(`${apiOrigin}${API_MOUNT}${path}`);
  backendUrl.search = url.search;

  const proxyRequest = new Request(backendUrl.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: "follow",
  });

  proxyRequest.headers.delete("Origin");
  proxyRequest.headers.delete("Referer");
  // Trust headers are set only by this proxy; never accept client-supplied ones.
  proxyRequest.headers.delete("X-Forwarded-By");
  proxyRequest.headers.delete("X-Original-Origin");
  proxyRequest.headers.set("X-Forwarded-By", "pages-proxy");
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    proxyRequest.headers.set("X-Original-Origin", origin);
  }

  const response = await fetch(proxyRequest);
  const newResponse = new Response(response.body, response);

  // Deterministic Set-Cookie passthrough: the Response copy-constructor may
  // or may not preserve multiplicity depending on runtime. Strip whatever
  // survived the copy and re-append each upstream cookie exactly once.
  if (typeof response.headers.getSetCookie === "function") {
    const upstreamCookies = response.headers.getSetCookie();
    if (upstreamCookies.length > 0) {
      newResponse.headers.delete("set-cookie");
      for (const cookie of upstreamCookies) {
        newResponse.headers.append("set-cookie", cookie);
      }
    }
  }

  for (const [key, value] of Object.entries(corsHeaders(origin))) {
    newResponse.headers.set(key, value);
  }

  return newResponse;
};
```

```html
<!-- File: index.html -->
<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="apple-touch-icon" href="/favicon.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vijay Kumar Sharma — Legal &amp; Technology Solutions for Businesses</title>
    <meta name="description" content="Vijay Kumar Sharma — Legal researcher, contract drafter, and data analyst helping businesses and startups navigate complex legal and technology challenges. Based in India." />
    <meta name="author" content="Vijay Kumar Sharma" />
    <!-- FOUC prevention: set theme before paint -->
    <script src="/theme-init.js"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

```conf
# File: nginx.api-gateway.prod.conf
# Production API gateway for vega-api.vijaykrsha.online
#
# This vhost serves the backend API ONLY. It must never serve frontend
# documents, so there is deliberately no `try_files` and no SPA fallback
# anywhere in this file. Any path that is not a real API route falls
# through to `location / { return 404; }` and gets nginx's stock 404 page
# rather than index.html.
#
# Path mapping:
#   /vega/api/<rest>  ->  backend /<rest>
# so /vega/api/admin/api/auth/login reaches the backend's
# /admin/api/auth route, and /vega/api/vks/api/contact reaches
# /vks/api/contact.

# Only these origins are reflected into X-Original-Origin. Anything else
# is not forwarded, which makes CSRFMiddleware reject the request.
map $http_origin $vks_trusted_origin {
    default                    "";
    "https://vijaykrsha.online"        $http_origin;
    "https://vijaykrsha-website.pages.dev" $http_origin;
}

upstream vks_backend_prod {
    server backend-prod:8000;
    keepalive 32;
}

server {
    listen 80;
    server_name vega-api.vijaykrsha.online;

    # Do not advertise the gateway version.
    server_tokens off;

    gzip on;
    gzip_vary on;
    gzip_min_length 256;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml text/javascript image/svg+xml;

    # Baseline hardening. No CORS headers are emitted here: CORS for the
    # browser-facing path is handled by the Cloudflare Pages function, which
    # already allowlists origins and reflects credentials.
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # ── Admin + public API ────────────────────────────────────────────
    location /vega/api/ {
        proxy_pass http://vks_backend_prod/;

        proxy_http_version 1.1;
        proxy_set_header Connection "";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # DirectAccessGuard (backend/app/main.py) rejects /admin/api/* and
        # /vks/* unless this header is present. It is a trust marker, so
        # strip any client-supplied copy first and set our own. Same for
        # X-Original-Origin, which CSRFMiddleware validates.
        proxy_set_header X-Forwarded-By "pages-proxy";
        proxy_set_header X-Original-Origin $vks_trusted_origin;

        # Admin API responses must never be cached by browsers or shared
        # proxies; the backend also sets no-store, this is belt-and-braces.
        proxy_hide_header Cache-Control;
        proxy_set_header Cache-Control "";

        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        proxy_connect_timeout 10;

        client_max_body_size 160m;
        client_body_timeout 300s;

        proxy_buffering off;
    }

    # ── WebSocket ────────────────────────────────────────────────────
    location /ws/ {
        proxy_pass http://vks_backend_prod/ws/;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-By "pages-proxy";
        proxy_set_header X-Original-Origin $vks_trusted_origin;

        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # ── Everything else ──────────────────────────────────────────────
    # Hard 404. This is what keeps frontend pages off the API host: there
    # is no index directive, no root, and no fallback to a SPA. Returning
    # 404 with no body makes nginx emit its default error page.
    location / {
        return 404;
    }
}
```

```conf
# File: nginx.conf
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 256;

    # --- Security headers ---
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com wss://vega-api.vijaykrsha.online; frame-src 'self' https://challenges.cloudflare.com; media-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'" always;

    # Dev-container parity with the Cloudflare Pages function: /api/* is
    # proxied to the backend with the /api prefix stripped, and the
    # X-Forwarded-By header satisfies DirectAccessGuard.
    location /api/ {
        proxy_pass http://backend-dev:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto http;
        proxy_set_header X-Forwarded-By pages-proxy;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        client_max_body_size 160m;
    }

    location /ws/ {
        proxy_pass http://backend-dev:8000/ws/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto http;
        proxy_set_header X-Forwarded-By pages-proxy;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    location / {
        # HTML documents and SPA fallback must never be cached: prevents the
        # Back button restoring an authenticated admin view after logout.
        add_header Cache-Control "no-store" always;
        # nginx discards ALL parent-level add_header directives when a location
        # defines its own, so repeat the security header set here explicitly.
        add_header Strict-Transport-Security "max-age=31536000" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "DENY" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com wss://vega-api.vijaykrsha.online; frame-src 'self' https://challenges.cloudflare.com; media-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'" always;
        try_files $uri $uri/ /index.html;
    }

    # Static assets are content-hashed by Vite, so immutable caching is safe.
    # Security headers are repeated here: nginx does not merge add_header
    # directives from parent blocks when a location defines its own.
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Strict-Transport-Security "max-age=31536000" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "DENY" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com wss://vega-api.vijaykrsha.online; frame-src 'self' https://challenges.cloudflare.com; media-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'" always;
    }
}
```

```json
{
  "name": "vijaykrsha-website",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "deploy": "python deploy.py",
    "deploy:docker": "python deploy.py --target docker",
    "deploy:cloudflare": "python deploy.py --target cloudflare",
    "deploy:both": "python deploy.py --target both",
    "deploy:docker:clean": "python deploy.py --target docker --clean",
    "deploy:cf": "python deploy.py --target cloudflare",
    "build:cf": "python cloudflare.py"
  },
  "dependencies": {
    "lucide-react": "^1.32.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-router-dom": "^7.6.1"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.7",
    "@types/react": "^19.1.8",
    "@types/react-dom": "^19.1.6",
    "@vitejs/plugin-react": "^4.5.2",
    "tailwindcss": "^4.1.7",
    "typescript": "~5.8.3",
    "vite": "^6.3.5"
  }
}
```

```
// File: public\_headers
# Documents and assets share these cache rules; the CSP below applies to every
# route via the catch-all.
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com wss://vega-api.vijaykrsha.online; frame-src 'self' https://challenges.cloudflare.com; media-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'

/
  Cache-Control: no-store
/index.html
  Cache-Control: no-store
/vega/*
  Cache-Control: no-store
/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

```
// File: public\_redirects
/* /index.html 200
```

```json
{
  "src": "/logo/logo.png.gz",
  "fps": 10,
  "frames": 15,
  "frameWidth": 200,
  "frameHeight": 200,
  "opacity": 0.80,
  "blendMode": "normal",
  "loop": true
}
```

```javascript
// File: public\theme-init.js
(function () {
  var stored = null;
  try {
    stored = localStorage.getItem("theme");
  } catch (e) {
    /* storage unavailable */
  }
  if (stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.classList.add("dark");
  }
})();
```

```sql
-- File: rbac_migration.sql

-- Create admin_roles
CREATE TABLE IF NOT EXISTS admin_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(64) NOT NULL UNIQUE,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create admin_permissions
CREATE TABLE IF NOT EXISTS admin_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(128) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(64)
);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON admin_permissions(category);

-- Create admin_role_permissions
CREATE TABLE IF NOT EXISTS admin_role_permissions (
    role_id UUID NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES admin_permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Seed roles
INSERT INTO admin_roles (name, description, is_system) VALUES
    ('owner', 'Full system access', true),
    ('admin', 'Administrative access', false),
    ('manager', 'Message management', false),
    ('support', 'Support agent', false),
    ('viewer', 'Read-only access', false)
ON CONFLICT (name) DO NOTHING;

-- Seed permissions
INSERT INTO admin_permissions (key, description, category) VALUES
    ('dashboard.view', 'View dashboard', 'dashboard'),
    ('messages.view', 'View messages', 'messages'),
    ('messages.update', 'Update message status/priority', 'messages'),
    ('messages.delete', 'Delete messages', 'messages'),
    ('messages.notes', 'Add internal notes', 'messages'),
    ('messages.tags', 'Manage tags', 'messages'),
    ('users.view', 'View user list', 'users'),
    ('users.create', 'Create users', 'users'),
    ('users.update', 'Update user details', 'users'),
    ('users.disable', 'Disable/enable users', 'users'),
    ('users.delete', 'Delete users', 'users'),
    ('users.reset_password', 'Reset user passwords', 'users'),
    ('users.manage_2fa', 'Reset user TOTP', 'users'),
    ('settings.view', 'View settings', 'settings'),
    ('settings.update', 'Update settings', 'settings'),
    ('audit_logs.view', 'View audit logs', 'audit'),
    ('roles.view', 'View roles', 'roles'),
    ('roles.manage', 'Create/edit roles', 'roles')
ON CONFLICT (key) DO NOTHING;

-- Seed role-permission mappings: owner gets ALL
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r, admin_permissions p
WHERE r.name = 'owner'
ON CONFLICT DO NOTHING;

-- admin permissions
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r, admin_permissions p
WHERE r.name = 'admin' AND p.key IN (
    'dashboard.view',
    'messages.view', 'messages.update', 'messages.notes', 'messages.tags',
    'users.view', 'users.create', 'users.update', 'users.disable',
    'users.reset_password',
    'settings.view', 'audit_logs.view'
)
ON CONFLICT DO NOTHING;

-- manager permissions
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r, admin_permissions p
WHERE r.name = 'manager' AND p.key IN (
    'dashboard.view',
    'messages.view', 'messages.update', 'messages.notes', 'messages.tags',
    'settings.view'
)
ON CONFLICT DO NOTHING;

-- support permissions
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r, admin_permissions p
WHERE r.name = 'support' AND p.key IN (
    'dashboard.view',
    'messages.view', 'messages.update', 'messages.notes'
)
ON CONFLICT DO NOTHING;

-- viewer permissions
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r, admin_permissions p
WHERE r.name = 'viewer' AND p.key IN (
    'dashboard.view',
    'messages.view'
)
ON CONFLICT DO NOTHING;

-- Add role_id to admin_users
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admin_users' AND column_name='role_id') THEN
        ALTER TABLE admin_users ADD COLUMN role_id UUID REFERENCES admin_roles(id);
    END IF;
END $$;

-- Migrate existing role enum values to role_id
UPDATE admin_users SET role_id = (
    SELECT id FROM admin_roles WHERE name = admin_users.role::text
) WHERE role_id IS NULL;

-- Make role_id NOT NULL
DO $$
BEGIN
    ALTER TABLE admin_users ALTER COLUMN role_id SET NOT NULL;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'role_id already NOT NULL';
END $$;

-- Update alembic version
INSERT INTO alembic_version (version_num) VALUES ('002_rbac')
ON CONFLICT DO NOTHING;
```

```markdown
<!-- File: README.md -->
# vijaykrsha-website

Personal website for Vijay Kumar Sharma — Legal & Tech Freelancer.

Built with **Vite + React 19 + TypeScript + Tailwind CSS v4**.

## Quick Start

```bash
npm install
npm run dev        # → http://localhost:5173
```

## Build

```bash
npm run build      # → /dist
npm run preview    # preview production build
```

## Docker

```bash
docker compose up --build   # → http://localhost:8080
```

## Deploy to Cloudflare Pages

1. Push to GitHub/GitLab
2. Cloudflare → Workers & Pages → Import repository
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add custom domain: `vijaykrsha.online`

## Project Structure

```
src/
├── config/site.ts          # All site content (single source of truth)
├── context/ThemeContext.tsx # Dark/light theme with localStorage
├── components/Layout.tsx   # Header + nav + footer
├── pages/
│   ├── Home.tsx            # Hero + highlight cards
│   ├── About.tsx           # Qualifications + expertise
│   ├── Freelance.tsx       # Services + working principles
│   ├── Portfolio.tsx       # Project showcase
│   ├── Contact.tsx         # Contact info + NDA notice
│   └── NotFound.tsx        # 404 page
├── App.tsx                 # Router setup
├── main.tsx                # Entry point
└── index.css               # Tailwind v4 + color palette
```

## Theme

Soft muted palette with dark/light toggle:

| Mode | Background | Surface | Accent | Text |
|------|-----------|---------|--------|------|
| Light | `#fdfbf7` | `#f7f3eb` | `#a78bfa` | `#161b26` |
| Dark | `#0f1219` | `#161b26` | `#a78bfa` | `#f7f3eb` |

## License

Private. All rights reserved.
```

```tsx
// File: src\App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import About from "@/pages/About";
import Freelance from "@/pages/Freelance";
import Portfolio from "@/pages/Portfolio";
import Apps from "@/pages/Apps";
import Contact from "@/pages/Contact";
import NotFound from "@/pages/NotFound";
import AdminLogin from "@/pages/AdminLogin";
import Setup from "@/pages/admin/Setup";
import ProtectedRoute from "@/components/admin/ProtectedRoute";
import AdminLayout from "@/pages/admin/AdminLayout";
import { AuthProvider } from "@/contexts/AuthContext";
import Dashboard from "@/pages/admin/Dashboard";
import Inbox from "@/pages/admin/Inbox";
import Settings from "@/pages/admin/Settings";
import UsersPage from "@/pages/admin/Users";
import RolesPage from "@/pages/admin/Roles";
import AuditLogs from "@/pages/admin/AuditLogs";
import Trash from "@/pages/admin/Trash";

export default function App() {
  return (
    <Routes>
      {/* Public admin routes — AuthProvider is scoped to the admin area so the
          public site (/, /about, /contact, …) never mounts it and never probes
          the session endpoint. AdminLogin still needs the context for
          login/exchange, but no bootstrap probe fires here — that lives in
          ProtectedRoute only. */}
      <Route
        path="/vega/admin/login"
        element={
          <AuthProvider>
            <AdminLogin />
          </AuthProvider>
        }
      />
      <Route path="/vega/admin/setup" element={<Setup />} />

      {/* Protected admin routes — AuthProvider is scoped here so the public
          site (/, /about, /contact, …) never mounts it and never probes the
          admin session endpoint. */}
      <Route
        path="/vega/admin"
        element={
          <AuthProvider>
            <ProtectedRoute />
          </AuthProvider>
        }
      >
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="trash" element={<Trash />} />
          <Route
            path="messages/:id"
            element={<Navigate to="/vega/admin/inbox" replace />}
          />
          <Route path="settings" element={<Settings />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="roles" element={<RolesPage />} />
          <Route
            path="admin-users"
            element={<Navigate to="/vega/admin/users" replace />}
          />
          <Route path="audit-logs" element={<AuditLogs />} />
        </Route>
      </Route>

      {/* Public site routes */}
      <Route
        path="*"
        element={
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/freelance" element={<Freelance />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/apps" element={<Apps />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  );
}
```

```tsx
// File: src\components\admin\DeleteMessageDialog.tsx
import { Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface DeleteMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
}

export default function DeleteMessageDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel,
  danger = false,
  loading = false,
  onConfirm,
}: DeleteMessageDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-sm neu-btn"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm neu-btn font-medium flex items-center gap-2 ${
              danger ? "text-red-500" : ""
            }`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {loading ? "Working..." : confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

```tsx
// File: src\components\admin\ProtectedRoute.tsx
import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Skeleton } from "../ui/skeleton";

function AdminFrameSkeleton() {
  const collapsed = (() => {
    const saved = localStorage.getItem("admin-sidebar-collapsed");
    if (saved !== null) return saved === "true";
    return window.innerWidth < 768;
  })();

  return (
    <div className="admin-theme flex h-screen overflow-hidden bg-background text-foreground">
      <aside
        className={`${
          collapsed ? "w-16" : "w-64"
        } neu-flat border-0 flex flex-col shrink-0 m-2 rounded-2xl`}
      >
        {/* Header */}
        <div
          className={`flex items-center border-b border-border/50 min-h-[57px] ${
            collapsed ? "flex-col py-3 px-2 gap-2" : "flex-row gap-2 px-3 py-5"
          }`}
        >
          <Skeleton className={`${collapsed ? "h-8 w-8" : "h-7 w-7"} rounded-xl`} />
          {!collapsed && <Skeleton className="h-4 w-40" />}
          {!collapsed && <Skeleton className="ml-auto h-4 w-4 rounded-lg" />}
        </div>
        {collapsed && <Skeleton className="mx-auto h-4 w-4 rounded-lg" />}

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${
                collapsed ? "justify-center" : ""
              }`}
            >
              <Skeleton className="h-5 w-5 rounded-lg shrink-0" />
              {!collapsed && (
                <Skeleton
                  className="h-3.5 flex-1"
                  style={{ maxWidth: 60 + (i % 3) * 25 }}
                />
              )}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-border/50 px-2 py-3 space-y-2">
          <div
            className={`flex items-center gap-3 px-3 py-2 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
            {!collapsed && <Skeleton className="h-3.5 flex-1 max-w-[90px]" />}
          </div>
          <div
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <Skeleton className="h-4 w-4 rounded-lg shrink-0" />
            {!collapsed && <Skeleton className="h-3.5 flex-1 max-w-[70px]" />}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden p-2">
        <div className="h-full neu-flat rounded-2xl p-6 flex flex-col gap-3">
          <div className="shrink-0 space-y-2">
            <Skeleton className="h-7 w-48 max-w-full" />
            <Skeleton className="h-3.5 w-64 max-w-full" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 shrink-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="neu-convex p-6">
                <div className="flex items-center justify-between mb-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-5" />
                </div>
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>

          <div className="neu-flat flex flex-col gap-3 flex-1 min-h-0">
            <div className="flex items-center justify-between p-6 border-b border-border/50 shrink-0">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3.5 w-20" />
            </div>
            <div className="divide-y divide-border/50 overflow-auto flex-1 min-h-0">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <Skeleton className="h-5 w-14 rounded-full" />
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-4" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ProtectedRoute() {
  const { isAuthenticated, refreshAuth } = useAuth();
  const location = useLocation();
  const [checking, setChecking] = useState(true);

  // Session bootstrap lives here — the only mount point for every protected
  // admin page — instead of inside AuthProvider, so public routes and the
  // admin login page never probe the session endpoint.
  useEffect(() => {
    let cancelled = false;
    refreshAuth().finally(() => {
      if (!cancelled) setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshAuth]);

  if (checking) {
    return (
      <div role="status" aria-label="Checking session">
        <AdminFrameSkeleton />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/vega/admin/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return <Outlet />;
}
```

```tsx
// File: src\components\AnimatedLogo.tsx
import { useRef } from "react";
import useSpriteAnimation from "@/hooks/useSpriteAnimation";
import logoConfig from "../../public/logo/logo.json";

interface AnimatedLogoProps {
  className?: string;
  alt?: string;
  size?: number;
}

export default function AnimatedLogo({
  className = "",
  alt = "Vijay Kumar Sharma",
  size,
}: AnimatedLogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const prefersReducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : true;

  const config = {
    ...logoConfig,
    blendMode: logoConfig.blendMode as GlobalCompositeOperation,
  };

  useSpriteAnimation(canvasRef, config);

  const displaySize = size ?? logoConfig.frameWidth;

  if (prefersReducedMotion) {
    return (
      <div
        className={`animated-logo flex items-center justify-center ${className}`}
        style={{ width: displaySize, height: displaySize }}
      >
        <div className="flex items-center justify-center w-full h-full rounded-2xl bg-glow-500/10 border border-glow-500/20">
          <span className="text-3xl font-bold text-glow-600 dark:text-glow-400">
            VK
          </span>
        </div>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={`animated-logo ${className}`}
      style={{ width: displaySize, height: displaySize }}
      aria-label={alt}
      role="img"
    />
  );
}
```

```tsx
// File: src\components\BrandLogo.tsx
import { BrandLoader } from "./ui/brand-loader";

/**
 * The one place the brand string is defined. Rendered uppercase so screen
 * readers and `text-transform`-less contexts both announce it as shown.
 */
const BRAND_TEXT = "VIJAYKRSHA.ONLINE";

/**
 * Stagger divisor for the `typewriter` preset.
 *
 * The vendored `animations.css` hardcodes 14, which assumes a brand of ~15
 * characters or fewer. At 17 characters the last letter's delay
 * (16/14 ≈ 1.14 cycles) overflows the animation cycle, so the loop visibly
 * drifts and desyncs on each repeat. 20 places the last letter's reveal at
 * 0.8T — right about where the first letter starts wiping (0.85T) — so the
 * sequence reads as one continuous, seamless typing loop.
 */
const TYPEWRITER_DIVISOR = 20;

interface BrandLogoProps {
  /** Font size in px. Defaults to the `text-lg` (18px) used before. */
  fontSize?: number;
  /** Seconds for one full type-and-erase cycle. */
  duration?: number;
  className?: string;
}

/**
 * Animated brand mark for the header, footer and admin sidebar.
 *
 * Inherits colour from `currentColor`, so the surrounding element's text
 * colour classes (light/dark variants) apply unchanged. Renders with
 * `brandMark` so it is exposed as a plain label rather than a live region.
 */
export default function BrandLogo({
  fontSize = 18,
  duration = 2.4,
  className = "",
}: BrandLogoProps) {
  return (
    <BrandLoader
      brand={BRAND_TEXT}
      animation="typewriter"
      size="sm"
      brandMark
      className={`brand-logo ${className}`.trim()}
      ariaLabel="Vijaykrsha.online"
      style={{
        fontSize: `${fontSize}px`,
        "--brand-loader-duration": `${duration}s`,
      }}
    />
  );
}

export { BRAND_TEXT, TYPEWRITER_DIVISOR };
```

```tsx
// File: src\components\Layout.tsx
import { Link, useLocation } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { site } from "@/config/site";
import { useState, useEffect, useRef } from "react";
import AnimatedLogo from "./AnimatedLogo";
import BrandLogo from "./BrandLogo";

function SunIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
    </svg>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  // Back to top visibility
  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll reveal
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1 }
    );

    const elements = document.querySelectorAll(".reveal");
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [location.pathname]);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-cream-50/80 dark:bg-night-900/80 backdrop-blur-md border-b border-cream-200 dark:border-night-700">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="font-bold text-glow-600 dark:text-glow-400">
            <BrandLogo />
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {site.nav.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-link text-sm font-medium rounded-lg px-3 py-1.5 ${
                  location.pathname === item.path
                    ? "text-glow-600 dark:text-glow-400 bg-glow-500/10 dark:bg-glow-400/10"
                    : "text-night-800/70 dark:text-cream-100/70 hover:text-night-800 dark:hover:text-cream-100 hover:bg-cream-200/50 dark:hover:bg-night-700/50"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={toggle}
              className="p-2 rounded-lg hover:bg-cream-200 dark:hover:bg-night-700 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
          </nav>

          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={toggle}
              className="p-2 rounded-lg hover:bg-cream-200 dark:hover:bg-night-700 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 rounded-lg hover:bg-cream-200 dark:hover:bg-night-700 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="md:hidden border-t border-cream-200 dark:border-night-700 bg-cream-50 dark:bg-night-900 px-4 pb-4">
            {site.nav.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`nav-link block py-3 text-sm font-medium rounded-lg px-3 ${
                  location.pathname === item.path
                    ? "text-glow-600 dark:text-glow-400 bg-glow-500/10 dark:bg-glow-400/10"
                    : "text-night-800/70 dark:text-cream-100/70"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main ref={mainRef} className="flex-1 pb-12">
        {children}
      </main>

      {/* ── Footer ──────────────────────────────── */}
      <footer className="border-t border-cream-200 dark:border-night-700 bg-cream-100 dark:bg-night-800">
        <div className="max-w-6xl mx-auto px-4 pt-12 pb-4">
          {/* Centered Tagline + WhatsApp */}
          <div className="flex flex-col items-center mb-10">
            <p className="font-bold text-glow-600 dark:text-glow-400 mb-1">
              <BrandLogo duration={3} />
            </p>
            <p className="text-sm text-night-800/50 dark:text-cream-100/50 mb-3">
              Legal Research &bull; Contract Drafting &bull; Legal Technology
            </p>
            <a
              href="https://wa.me/919599130381"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#25D366] text-white text-sm font-medium hover:bg-[#20b858] transition-colors"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Chat on WhatsApp
            </a>
          </div>

          {/* 4-Column Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            {/* Col 1: Quick Links */}
            <div>
              <p className="footer-heading">Quick Links</p>
              <ul className="space-y-2">
                {site.nav.map((item) => (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className="text-sm text-night-800/60 dark:text-cream-100/60 hover:text-glow-500 dark:hover:text-glow-400 transition-colors"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 2: Services */}
            <div>
              <p className="footer-heading">Services</p>
              <ul className="space-y-2">
                {site.services.map((s) => (
                  <li key={s.title}>
                    <Link
                      to="/freelance"
                      className="text-sm text-night-800/60 dark:text-cream-100/60 hover:text-glow-500 dark:hover:text-glow-400 transition-colors"
                    >
                      {s.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 3: Contact */}
            <div>
              <p className="footer-heading">Contact</p>
              <ul className="space-y-2 text-sm text-night-800/60 dark:text-cream-100/60">
                <li>{site.contact.phone}</li>
                <li className="[overflow-wrap:anywhere]">{site.contact.email}</li>
                <li>{site.contact.location}</li>
              </ul>
            </div>

            {/* Col 4: Trust — plain text like the other columns */}
            <div>
              <p className="footer-heading">Trust</p>
              <ul className="space-y-2 text-sm text-night-800/60 dark:text-cream-100/60">
                <li>NDA by Default</li>
                <li>3+ Years Experience</li>
                <li>Remote Collaboration</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-cream-200 dark:border-night-700 pt-4 flex items-center justify-center gap-3 text-sm text-night-800/50 dark:text-cream-100/50">
            <AnimatedLogo size={100} />
            <p>&copy; {new Date().getFullYear()} {site.name}. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* ── Back to Top ─────────────────────────── */}
      <button
        onClick={scrollToTop}
        aria-label="Back to top"
        className={`back-to-top fixed bottom-6 right-6 z-50 p-3 rounded-full bg-glow-500 text-white shadow-lg hover:bg-glow-600 transition-colors ${showBackToTop ? "show" : ""}`}
      >
        <ArrowUpIcon />
      </button>
    </div>
  );
}
```

```tsx
// File: src\components\OtpDigitInput.tsx
import { useRef, useState, useEffect, useCallback } from "react";

interface OtpDigitInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  error?: boolean;
}

export default function OtpDigitInput({
  value,
  onChange,
  length = 6,
  autoFocus = true,
  disabled = false,
  error = false,
}: OtpDigitInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const ignoreNextChange = useRef(false);
  const [digits, setDigits] = useState<string[]>(() =>
    Array.from({ length }, (_, i) => value[i] || "")
  );
  const [popIndex, setPopIndex] = useState<number>(-1);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    setDigits(Array.from({ length }, (_, i) => value[i] || ""));
  }, [value, length]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (error) {
      setShaking(true);
      const t = setTimeout(() => setShaking(false), 400);
      return () => clearTimeout(t);
    }
  }, [error]);

  const triggerPop = useCallback((index: number) => {
    setPopIndex(index);
    setTimeout(() => setPopIndex(-1), 200);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (ignoreNextChange.current) {
        ignoreNextChange.current = false;
        return;
      }
      const raw = e.target.value.replace(/\D/g, "").slice(0, length);
      if (raw.length > value.length) {
        triggerPop(raw.length - 1);
      }
      onChange(raw);
      if (inputRef.current) {
        const pos = raw.length;
        inputRef.current.setSelectionRange(pos, pos);
      }
    },
    [onChange, length, value.length, triggerPop]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && value.length > 0) {
        ignoreNextChange.current = true;
        onChange(value.slice(0, -1));
      }
    },
    [onChange, value]
  );

  const handleContainerClick = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const isComplete = value.length === length;

  return (
    <div
      className={`flex items-center justify-center gap-2 ${shaking ? "otp-digit-shake" : ""}`}
      onClick={handleContainerClick}
    >
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        maxLength={length}
        disabled={disabled}
        className="absolute w-0 h-0 opacity-0 pointer-events-none"
        aria-label={`Enter ${length}-digit code`}
      />
      {Array.from({ length }, (_, i) => {
        const digit = digits[i] || "";
        const isCurrent = i === value.length && !isComplete;
        const isPopping = i === popIndex;
        const isFilled = i < value.length;

        return (
          <div
            key={i}
            className={`
              w-11 h-14 flex items-center justify-center rounded-xl text-lg font-mono font-semibold
              transition-all duration-150
              ${isPopping ? "otp-digit-pop" : ""}
              ${isFilled ? "otp-digit-glow" : ""}
              ${isCurrent
                ? "neu-concave ring-2 ring-primary/50"
                : isFilled
                  ? "neu-concave"
                  : "neu-concave"
              }
              ${error ? "ring-2 ring-red-400/60" : ""}
              ${disabled ? "opacity-50" : "cursor-text"}
            `}
            style={{ caretColor: "transparent" }}
          >
            {digit && (
              <span
                className={
                  isFilled
                    ? "text-slate-800 dark:text-slate-100"
                    : "text-transparent"
                }
              >
                {digit}
              </span>
            )}
            {isCurrent && !disabled && (
              <span className="w-0.5 h-5 bg-primary animate-pulse" />
            )}
          </div>
        );
      })}
    </div>
  );
}
```

```tsx
// File: src\components\SessionExpiryWarning.tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, TimerReset } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const WARN_MS = 15 * 60 * 1000;
const CRITICAL_MS = 60 * 1000;
const RESYNC_INTERVAL_MS = 5 * 60 * 1000;

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function SessionExpiryWarning() {
  const { sessionExpiresAt, refreshAuth, logout } = useAuth();
  const navigate = useNavigate();
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const lastResyncRef = useRef(Date.now());
  const expiredRef = useRef(false);

  useEffect(() => {
    if (!sessionExpiresAt) {
      setRemainingMs(null);
      return;
    }
    const expiresAt = new Date(sessionExpiresAt).getTime();
    if (Number.isNaN(expiresAt)) {
      setRemainingMs(null);
      return;
    }

    const tick = () => {
      const left = expiresAt - Date.now();
      setRemainingMs(left);

      // Independent fallback: the server is the authority. If the countdown
      // hits zero (idle window elapsed with no API traffic), re-check; a 401
      // there means the session is truly gone.
      if (left <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        refreshAuth().then((ok) => {
          expiredRef.current = false;
          if (!ok) {
            logout().finally(() => navigate("/vega/admin/login", { replace: true }));
          }
        });
      }

      // Re-sync periodically while active so server-side idle extensions
      // (touch_session) are reflected without a full reload.
      if (Date.now() - lastResyncRef.current >= RESYNC_INTERVAL_MS) {
        lastResyncRef.current = Date.now();
        refreshAuth();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [sessionExpiresAt, refreshAuth, logout, navigate]);

  if (remainingMs === null || remainingMs > WARN_MS) return null;

  const critical = remainingMs <= CRITICAL_MS;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium ${
        critical
          ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/50"
          : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50"
      }`}
    >
      {critical ? (
        <TimerReset className="w-4 h-4 shrink-0" />
      ) : (
        <AlertTriangle className="w-4 h-4 shrink-0" />
      )}
      <span>
        {critical ? (
          <>Your session is about to expire. You will be signed out in {formatRemaining(remainingMs)}.</>
        ) : (
          <>
            For security you will be signed out in{" "}
            <span className="tabular-nums font-semibold">{formatRemaining(remainingMs)}</span>.
            Save your work and sign in again to continue.
          </>
        )}
      </span>
    </div>
  );
}
```

```tsx
// File: src\components\ui\alert.tsx
import { type HTMLAttributes, forwardRef } from "react";

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive";
}

const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className = "", variant = "default", ...props }, ref) => {
    const variants: Record<string, string> = {
      default: "neu-flat text-foreground border-0",
      destructive:
        "bg-destructive/10 text-destructive border-destructive/20 rounded-xl",
    };
    return (
      <div
        ref={ref}
        role="alert"
        className={`relative w-full rounded-xl p-4 ${variants[variant]} ${className}`}
        {...props}
      />
    );
  }
);
Alert.displayName = "Alert";

const AlertDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className = "", ...props }, ref) => (
    <p ref={ref} className={`text-sm [&_p]:leading-relaxed ${className}`} {...props} />
  )
);
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertDescription };
```

```css
/* File: src\components\ui\brand-loader\animations.css */
/* fade */
.brand-loader--fade .brand-loader__text {
  animation: brand-loader-fade var(--brand-loader-duration) ease-in-out infinite alternate;
}

@keyframes brand-loader-fade {
  from {
    opacity: 0.35;
  }
  to {
    opacity: 1;
  }
}

/* pulse */
.brand-loader--pulse .brand-loader__text {
  animation: brand-loader-pulse var(--brand-loader-duration) ease-in-out infinite;
}

@keyframes brand-loader-pulse {
  0%,
  100% {
    transform: scale(0.96);
    opacity: 0.55;
  }
  50% {
    transform: scale(1);
    opacity: 1;
  }
}

/* scan - gradient sweep across the text */
.brand-loader--scan .brand-loader__text {
  background: linear-gradient(
    90deg,
    var(--brand-loader-color) 0%,
    var(--brand-loader-color) 40%,
    #fff 50%,
    var(--brand-loader-color) 60%,
    var(--brand-loader-color) 100%
  );
  background-size: 200% 100%;
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  animation: brand-loader-scan var(--brand-loader-duration) linear infinite;
}

@keyframes brand-loader-scan {
  from {
    background-position: 200% center;
  }
  to {
    background-position: -200% center;
  }
}

/* glitch - requires data-brand attribute set to the same text */
.brand-loader--glitch .brand-loader__text::before,
.brand-loader--glitch .brand-loader__text::after {
  content: attr(data-brand);
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.brand-loader--glitch .brand-loader__text::before {
  animation: brand-loader-glitch-1 var(--brand-loader-duration) infinite;
}

.brand-loader--glitch .brand-loader__text::after {
  animation: brand-loader-glitch-2 var(--brand-loader-duration) infinite;
}

@keyframes brand-loader-glitch-1 {
  0%,
  90%,
  100% {
    clip-path: inset(0 0 100% 0);
    transform: translate(0);
  }
  92% {
    clip-path: inset(20% 0 60% 0);
    transform: translate(-3px);
  }
  95% {
    clip-path: inset(60% 0 10% 0);
    transform: translate(3px);
  }
}

@keyframes brand-loader-glitch-2 {
  0%,
  90%,
  100% {
    clip-path: inset(100% 0 0 0);
    transform: translate(0);
  }
  93% {
    clip-path: inset(10% 0 70% 0);
    transform: translate(3px);
  }
  96% {
    clip-path: inset(60% 0 15% 0);
    transform: translate(-3px);
  }
}

/* reveal - clip-path wipe on load, then settle */
.brand-loader--reveal .brand-loader__text {
  animation: brand-loader-reveal var(--brand-loader-duration) ease-in-out infinite alternate;
}

@keyframes brand-loader-reveal {
  0% {
    clip-path: inset(0 100% 0 0);
    opacity: 0.4;
  }
  100% {
    clip-path: inset(0 0 0 0);
    opacity: 1;
  }
}

/* typing - blinking caret using a pseudo-element bar */
.brand-loader--typing .brand-loader__text {
  border-right: 0.08em solid var(--brand-loader-color);
  padding-right: 0.05em;
  animation: brand-loader-typing-caret var(--brand-loader-duration) steps(1) infinite;
}

@keyframes brand-loader-typing-caret {
  0%,
  49% {
    border-color: var(--brand-loader-color);
  }
  50%,
  100% {
    border-color: transparent;
  }
}

/* custom: intentionally no rules here — pair with `animation="custom"`
   and a `className` to define your own @keyframes in your app. */

/* shimmer - diagonal light sweep across the text via a masked overlay */
.brand-loader--shimmer .brand-loader__text {
  position: relative;
  overflow: hidden;
}

.brand-loader--shimmer .brand-loader__text::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    115deg,
    transparent 30%,
    rgba(255, 255, 255, 0.75) 48%,
    rgba(255, 255, 255, 0.75) 52%,
    transparent 70%
  );
  mix-blend-mode: overlay;
  background-size: 250% 250%;
  background-position: 200% 0;
  animation: brand-loader-shimmer var(--brand-loader-duration) ease-in-out infinite;
  pointer-events: none;
}

@keyframes brand-loader-shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -50% 0;
  }
}

/* bounce - whole word bounces like it's settling */
.brand-loader--bounce .brand-loader__text {
  animation: brand-loader-bounce var(--brand-loader-duration) cubic-bezier(0.28, 0.84, 0.42, 1) infinite;
}

@keyframes brand-loader-bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-38%);
  }
  55% {
    transform: translateY(0);
  }
  70% {
    transform: translateY(-14%);
  }
  85% {
    transform: translateY(0);
  }
}

/* flicker - unsteady neon-sign style opacity flicker */
.brand-loader--flicker .brand-loader__text {
  animation: brand-loader-flicker var(--brand-loader-duration) linear infinite;
}

@keyframes brand-loader-flicker {
  0%,
  19%,
  21%,
  23%,
  54%,
  56%,
  100% {
    opacity: 1;
  }
  20%,
  22%,
  55% {
    opacity: 0.35;
  }
  36%,
  38% {
    opacity: 0.65;
  }
  37% {
    opacity: 1;
  }
}

/* wave - each letter (rendered as .brand-loader__letter spans) rises in turn */
.brand-loader--wave .brand-loader__letter {
  display: inline-block;
  animation: brand-loader-wave var(--brand-loader-duration) ease-in-out infinite;
  animation-delay: calc(var(--i, 0) * var(--brand-loader-duration) / 12);
}

@keyframes brand-loader-wave {
  0%,
  60%,
  100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-35%);
  }
}

/* blur - text resolves into focus and back out */
.brand-loader--blur .brand-loader__text {
  animation: brand-loader-blur var(--brand-loader-duration) ease-in-out infinite alternate;
}

@keyframes brand-loader-blur {
  0% {
    filter: blur(6px);
    opacity: 0.4;
  }
  100% {
    filter: blur(0);
    opacity: 1;
  }
}

/* neon - glowing sign-style pulsing text-shadow */
.brand-loader--neon .brand-loader__text {
  animation: brand-loader-neon var(--brand-loader-duration) ease-in-out infinite alternate;
}

@keyframes brand-loader-neon {
  from {
    text-shadow:
      0 0 4px var(--brand-loader-color),
      0 0 10px var(--brand-loader-color);
    opacity: 0.75;
  }
  to {
    text-shadow:
      0 0 8px var(--brand-loader-color),
      0 0 22px var(--brand-loader-color),
      0 0 34px var(--brand-loader-color);
    opacity: 1;
  }
}

/* ======================================================================
   50 additional presets
   ====================================================================== */

/* ---- motion / entrance ---- */

.brand-loader--slide-up .brand-loader__text {
  animation: bl-slide-up var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-slide-up {
  0% { transform: translateY(30%); opacity: 0.3; }
  100% { transform: translateY(0); opacity: 1; }
}

.brand-loader--slide-down .brand-loader__text {
  animation: bl-slide-down var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-slide-down {
  0% { transform: translateY(-30%); opacity: 0.3; }
  100% { transform: translateY(0); opacity: 1; }
}

.brand-loader--slide-left .brand-loader__text {
  animation: bl-slide-left var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-slide-left {
  0% { transform: translateX(30%); opacity: 0.3; }
  100% { transform: translateX(0); opacity: 1; }
}

.brand-loader--slide-right .brand-loader__text {
  animation: bl-slide-right var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-slide-right {
  0% { transform: translateX(-30%); opacity: 0.3; }
  100% { transform: translateX(0); opacity: 1; }
}

.brand-loader--zoom-in .brand-loader__text {
  animation: bl-zoom-in var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-zoom-in {
  0% { transform: scale(0.6); opacity: 0.3; }
  100% { transform: scale(1); opacity: 1; }
}

.brand-loader--zoom-out .brand-loader__text {
  animation: bl-zoom-out var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-zoom-out {
  0% { transform: scale(1.4); opacity: 0.3; }
  100% { transform: scale(1); opacity: 1; }
}

.brand-loader--rotate-in .brand-loader__text {
  animation: bl-rotate-in var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-rotate-in {
  0% { transform: rotate(-8deg) scale(0.9); opacity: 0.4; }
  100% { transform: rotate(0) scale(1); opacity: 1; }
}

.brand-loader--roll-in .brand-loader__text {
  animation: bl-roll-in var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-roll-in {
  0% { transform: translateX(-60%) rotate(-120deg); opacity: 0; }
  100% { transform: translateX(0) rotate(0); opacity: 1; }
}

.brand-loader--drop .brand-loader__text {
  animation: bl-drop var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-drop {
  0% { transform: translateY(-60%); opacity: 0; }
  60% { transform: translateY(8%); opacity: 1; }
  80% { transform: translateY(-4%); }
  100% { transform: translateY(0); }
}

.brand-loader--rise .brand-loader__text {
  animation: bl-rise var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-rise {
  0% { transform: translateY(60%); opacity: 0; }
  60% { transform: translateY(-8%); opacity: 1; }
  80% { transform: translateY(4%); }
  100% { transform: translateY(0); }
}

/* ---- 3D / perspective (parent .brand-loader has perspective set) ---- */

.brand-loader--flip-x .brand-loader__text {
  animation: bl-flip-x var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-flip-x {
  0%, 100% { transform: rotateX(0deg); }
  50% { transform: rotateX(180deg); }
}

.brand-loader--flip-y .brand-loader__text {
  animation: bl-flip-y var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-flip-y {
  0%, 100% { transform: rotateY(0deg); }
  50% { transform: rotateY(180deg); }
}

.brand-loader--letter-spin .brand-loader__letter {
  display: inline-block;
  animation: bl-letter-spin var(--brand-loader-duration) linear infinite;
  animation-delay: calc(var(--i, 0) * var(--brand-loader-duration) / 16);
}
@keyframes bl-letter-spin {
  0% { transform: rotateY(0deg); }
  100% { transform: rotateY(360deg); }
}

.brand-loader--perspective-tilt .brand-loader__text {
  animation: bl-perspective-tilt var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-perspective-tilt {
  0%, 100% { transform: rotateX(0) rotateY(0); }
  25% { transform: rotateX(10deg) rotateY(-10deg); }
  75% { transform: rotateX(-10deg) rotateY(10deg); }
}

/* ---- playful / squash ---- */

.brand-loader--elastic .brand-loader__text {
  animation: bl-elastic var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-elastic {
  0% { transform: scale(0.3); opacity: 0; }
  50% { transform: scale(1.15); opacity: 1; }
  70% { transform: scale(0.95); }
  100% { transform: scale(1); }
}

.brand-loader--swing .brand-loader__text {
  transform-origin: top center;
  animation: bl-swing var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-swing {
  20% { transform: rotate(10deg); }
  40% { transform: rotate(-8deg); }
  60% { transform: rotate(5deg); }
  80% { transform: rotate(-3deg); }
  100% { transform: rotate(0); }
}

.brand-loader--rubber .brand-loader__text {
  animation: bl-rubber var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-rubber {
  0%, 100% { transform: scale(1, 1); }
  30% { transform: scale(1.25, 0.75); }
  40% { transform: scale(0.75, 1.25); }
  50% { transform: scale(1.15, 0.85); }
  65% { transform: scale(0.95, 1.05); }
  75% { transform: scale(1.05, 0.95); }
}

.brand-loader--jelly .brand-loader__text {
  animation: bl-jelly var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-jelly {
  0%, 100% { transform: scale(1, 1); }
  25% { transform: scale(1.1, 0.9); }
  50% { transform: scale(0.95, 1.05); }
  75% { transform: scale(1.05, 0.95); }
}

.brand-loader--heartbeat .brand-loader__text {
  animation: bl-heartbeat var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-heartbeat {
  0%, 100% { transform: scale(1); }
  14% { transform: scale(1.15); }
  28% { transform: scale(1); }
  42% { transform: scale(1.15); }
  70% { transform: scale(1); }
}

.brand-loader--wobble .brand-loader__text {
  animation: bl-wobble var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-wobble {
  0%, 100% { transform: translateX(0) rotate(0); }
  15% { transform: translateX(-8%) rotate(-5deg); }
  30% { transform: translateX(6%) rotate(3deg); }
  45% { transform: translateX(-4%) rotate(-3deg); }
  60% { transform: translateX(3%) rotate(2deg); }
  75% { transform: translateX(-2%) rotate(-1deg); }
}

.brand-loader--shake-x .brand-loader__text {
  animation: bl-shake-x var(--brand-loader-duration) linear infinite;
}
@keyframes bl-shake-x {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
  20%, 40%, 60%, 80% { transform: translateX(4px); }
}

.brand-loader--shake-y .brand-loader__text {
  animation: bl-shake-y var(--brand-loader-duration) linear infinite;
}
@keyframes bl-shake-y {
  0%, 100% { transform: translateY(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateY(-4px); }
  20%, 40%, 60%, 80% { transform: translateY(4px); }
}

.brand-loader--tilt .brand-loader__text {
  animation: bl-tilt var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-tilt {
  0% { transform: rotate(-3deg); }
  100% { transform: rotate(3deg); }
}

.brand-loader--squeeze .brand-loader__text {
  animation: bl-squeeze var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-squeeze {
  0%, 100% { transform: scaleX(1); }
  50% { transform: scaleX(0.7); }
}

.brand-loader--stretch .brand-loader__text {
  animation: bl-stretch var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-stretch {
  0%, 100% { transform: scaleX(1); }
  50% { transform: scaleX(1.3); }
}

.brand-loader--skew .brand-loader__text {
  animation: bl-skew var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-skew {
  0%, 100% { transform: skewX(-8deg); }
  50% { transform: skewX(8deg); }
}

.brand-loader--skew-bounce .brand-loader__text {
  animation: bl-skew-bounce var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-skew-bounce {
  0%, 100% { transform: translateY(0) skewX(0); }
  30% { transform: translateY(-20%) skewX(-6deg); }
  60% { transform: translateY(0) skewX(4deg); }
  80% { transform: translateY(-6%) skewX(-2deg); }
}

.brand-loader--mirror .brand-loader__text {
  animation: bl-mirror var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-mirror {
  0%, 100% { transform: scaleX(1); }
  50% { transform: scaleX(-1); }
}

.brand-loader--warp .brand-loader__text {
  animation: bl-warp var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-warp {
  0%, 100% { transform: scale(1) skewX(0); filter: hue-rotate(0deg); }
  50% { transform: scale(1.08, 0.92) skewX(3deg); filter: hue-rotate(15deg); }
}

/* ---- rotation / strobe ---- */

.brand-loader--spin-slow .brand-loader__text {
  animation: bl-spin calc(var(--brand-loader-duration) * 3) linear infinite;
}

.brand-loader--spin-fast .brand-loader__text {
  animation: bl-spin var(--brand-loader-duration) linear infinite;
}

@keyframes bl-spin {
  to { transform: rotate(360deg); }
}

.brand-loader--flash .brand-loader__text {
  animation: bl-flash var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-flash {
  0%, 50%, 100% { opacity: 1; }
  25%, 75% { opacity: 0; }
}

.brand-loader--strobe .brand-loader__text {
  animation: bl-flash calc(var(--brand-loader-duration) / 3) steps(1) infinite;
}

/* ---- sweep / reveal ---- */

.brand-loader--underline-sweep .brand-loader__text {
  padding-bottom: 0.15em;
}
.brand-loader--underline-sweep .brand-loader__text::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  width: 100%;
  background: var(--brand-loader-color);
  transform: scaleX(0);
  transform-origin: left;
  animation: bl-underline-sweep var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-underline-sweep {
  0% { transform: scaleX(0); transform-origin: left; }
  45% { transform: scaleX(1); transform-origin: left; }
  55% { transform: scaleX(1); transform-origin: right; }
  100% { transform: scaleX(0); transform-origin: right; }
}

.brand-loader--gradient-shift .brand-loader__text {
  background: linear-gradient(
    90deg,
    var(--brand-loader-color),
    #fff,
    var(--brand-loader-color)
  );
  background-size: 200% 100%;
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  animation: bl-gradient-shift var(--brand-loader-duration) ease infinite;
}
@keyframes bl-gradient-shift {
  0% { background-position: 0% 50%; }
  100% { background-position: 100% 50%; }
}

.brand-loader--rainbow .brand-loader__text {
  animation: bl-rainbow calc(var(--brand-loader-duration) * 2) linear infinite;
}
@keyframes bl-rainbow {
  0% { filter: hue-rotate(0deg); }
  100% { filter: hue-rotate(360deg); }
}

.brand-loader--peekaboo .brand-loader__text {
  animation: bl-peekaboo var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-peekaboo {
  0% { clip-path: circle(0% at 50% 50%); opacity: 0.3; }
  100% { clip-path: circle(75% at 50% 50%); opacity: 1; }
}

.brand-loader--curtain .brand-loader__text {
  animation: bl-curtain var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-curtain {
  0% { clip-path: inset(0 50% 0 50%); opacity: 0.3; }
  100% { clip-path: inset(0 0 0 0); opacity: 1; }
}

.brand-loader--iris .brand-loader__text {
  animation: bl-iris var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-iris {
  0% { clip-path: circle(0% at 0% 50%); }
  100% { clip-path: circle(100% at 0% 50%); }
}

.brand-loader--wipe-diagonal .brand-loader__text {
  animation: bl-wipe-diagonal var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-wipe-diagonal {
  0% { clip-path: polygon(0 0, 0 0, 0 100%, 0 100%); }
  100% { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }
}

/* ---- ambient / idle ---- */

.brand-loader--levitate .brand-loader__text {
  animation: bl-levitate calc(var(--brand-loader-duration) * 1.6) ease-in-out infinite;
}
@keyframes bl-levitate {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-10%) rotate(1.5deg); }
}

.brand-loader--drift .brand-loader__text {
  animation: bl-drift calc(var(--brand-loader-duration) * 1.6) ease-in-out infinite;
}
@keyframes bl-drift {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(6%); }
}

.brand-loader--sway .brand-loader__text {
  transform-origin: bottom center;
  animation: bl-sway calc(var(--brand-loader-duration) * 1.6) ease-in-out infinite;
}
@keyframes bl-sway {
  0%, 100% { transform: rotate(-4deg); }
  50% { transform: rotate(4deg); }
}

.brand-loader--tracking-pulse .brand-loader__text {
  animation: bl-tracking-pulse var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-tracking-pulse {
  0%, 100% { letter-spacing: 0.1em; }
  50% { letter-spacing: 0.35em; }
}

/* ---- texture / glitch family ---- */

.brand-loader--static-noise .brand-loader__text {
  animation: bl-static-noise calc(var(--brand-loader-duration) / 2) steps(1) infinite;
}
@keyframes bl-static-noise {
  0%, 100% { opacity: 1; transform: translate(0, 0); }
  10% { opacity: 0.8; transform: translate(-1px, 1px); }
  20% { opacity: 1; transform: translate(1px, -1px); }
  30% { opacity: 0.7; transform: translate(-1px, -1px); }
  40% { opacity: 1; transform: translate(1px, 1px); }
  50% { opacity: 0.85; transform: translate(0, -1px); }
  60% { opacity: 1; transform: translate(-1px, 0); }
  70% { opacity: 0.75; transform: translate(1px, 0); }
  80% { opacity: 1; transform: translate(0, 1px); }
  90% { opacity: 0.9; transform: translate(-1px, 1px); }
}

.brand-loader--chromatic .brand-loader__text {
  animation: bl-chromatic var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-chromatic {
  0% { text-shadow: -2px 0 #ff3b3b, 2px 0 #3b9bff; }
  50% { text-shadow: -1px 0 #ff3b3b, 1px 0 #3b9bff; }
  100% { text-shadow: -2px 0 #ff3b3b, 2px 0 #3b9bff; }
}

/* ---- per-letter sequenced (rendered as .brand-loader__letter spans) ---- */

.brand-loader--typewriter .brand-loader__letter {
  display: inline-block;
  opacity: 0;
  animation: bl-typewriter-letter var(--brand-loader-duration) steps(1) infinite;
  animation-delay: calc(var(--i, 0) * var(--brand-loader-duration) / 14);
}
@keyframes bl-typewriter-letter {
  0% { opacity: 0; }
  1% { opacity: 1; }
  70% { opacity: 1; }
  85% { opacity: 0; }
  100% { opacity: 0; }
}

.brand-loader--cascade .brand-loader__letter {
  display: inline-block;
  opacity: 0;
  animation: bl-cascade var(--brand-loader-duration) ease-in-out infinite;
  animation-delay: calc(var(--i, 0) * var(--brand-loader-duration) / 20);
}
@keyframes bl-cascade {
  0% { opacity: 0; transform: translateY(-60%); }
  30% { opacity: 1; transform: translateY(0); }
  70% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(40%); }
}

.brand-loader--letter-fade .brand-loader__letter {
  display: inline-block;
  animation: bl-letter-fade var(--brand-loader-duration) ease-in-out infinite;
  animation-delay: calc(var(--i, 0) * var(--brand-loader-duration) / 16);
}
@keyframes bl-letter-fade {
  0%, 100% { opacity: 0.25; }
  50% { opacity: 1; }
}

.brand-loader--letter-pop .brand-loader__letter {
  display: inline-block;
  animation: bl-letter-pop var(--brand-loader-duration) ease-in-out infinite;
  animation-delay: calc(var(--i, 0) * var(--brand-loader-duration) / 16);
}
@keyframes bl-letter-pop {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.35); }
}

/* ======================================================================
   100 additional presets (88 ambient + 12 mouse-interactive)
   ====================================================================== */

/* ---- directional bounce-in family ---- */

.brand-loader--bounce-in .brand-loader__text {
  animation: bl-bounce-in var(--brand-loader-duration) cubic-bezier(0.28, 0.84, 0.42, 1) infinite;
}
@keyframes bl-bounce-in {
  0% { transform: scale(0.4); opacity: 0; }
  60% { transform: scale(1.08); opacity: 1; }
  80% { transform: scale(0.96); }
  100% { transform: scale(1); }
}

.brand-loader--bounce-in-up .brand-loader__text {
  animation: bl-bounce-in-up var(--brand-loader-duration) cubic-bezier(0.28, 0.84, 0.42, 1) infinite;
}
@keyframes bl-bounce-in-up {
  0% { transform: translateY(60%); opacity: 0; }
  60% { transform: translateY(-10%); opacity: 1; }
  80% { transform: translateY(4%); }
  100% { transform: translateY(0); }
}

.brand-loader--bounce-in-down .brand-loader__text {
  animation: bl-bounce-in-down var(--brand-loader-duration) cubic-bezier(0.28, 0.84, 0.42, 1) infinite;
}
@keyframes bl-bounce-in-down {
  0% { transform: translateY(-60%); opacity: 0; }
  60% { transform: translateY(10%); opacity: 1; }
  80% { transform: translateY(-4%); }
  100% { transform: translateY(0); }
}

.brand-loader--bounce-in-left .brand-loader__text {
  animation: bl-bounce-in-left var(--brand-loader-duration) cubic-bezier(0.28, 0.84, 0.42, 1) infinite;
}
@keyframes bl-bounce-in-left {
  0% { transform: translateX(-60%); opacity: 0; }
  60% { transform: translateX(10%); opacity: 1; }
  80% { transform: translateX(-4%); }
  100% { transform: translateX(0); }
}

.brand-loader--bounce-in-right .brand-loader__text {
  animation: bl-bounce-in-right var(--brand-loader-duration) cubic-bezier(0.28, 0.84, 0.42, 1) infinite;
}
@keyframes bl-bounce-in-right {
  0% { transform: translateX(60%); opacity: 0; }
  60% { transform: translateX(-10%); opacity: 1; }
  80% { transform: translateX(4%); }
  100% { transform: translateX(0); }
}

/* ---- directional fade family ---- */

.brand-loader--fade-in-up .brand-loader__text {
  animation: bl-fade-in-up var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-fade-in-up {
  0% { transform: translateY(20%); opacity: 0.2; }
  100% { transform: translateY(0); opacity: 1; }
}

.brand-loader--fade-in-down .brand-loader__text {
  animation: bl-fade-in-down var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-fade-in-down {
  0% { transform: translateY(-20%); opacity: 0.2; }
  100% { transform: translateY(0); opacity: 1; }
}

.brand-loader--fade-in-left .brand-loader__text {
  animation: bl-fade-in-left var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-fade-in-left {
  0% { transform: translateX(-20%); opacity: 0.2; }
  100% { transform: translateX(0); opacity: 1; }
}

.brand-loader--fade-in-right .brand-loader__text {
  animation: bl-fade-in-right var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-fade-in-right {
  0% { transform: translateX(20%); opacity: 0.2; }
  100% { transform: translateX(0); opacity: 1; }
}

.brand-loader--fade-out-pulse .brand-loader__text {
  animation: bl-fade-out-pulse var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-fade-out-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.15; }
}

/* ---- directional flip family ---- */

.brand-loader--flip-in-x .brand-loader__text {
  animation: bl-flip-in-x var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-flip-in-x {
  0% { transform: rotateX(90deg); opacity: 0; }
  100% { transform: rotateX(0deg); opacity: 1; }
}

.brand-loader--flip-in-y .brand-loader__text {
  animation: bl-flip-in-y var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-flip-in-y {
  0% { transform: rotateY(90deg); opacity: 0; }
  100% { transform: rotateY(0deg); opacity: 1; }
}

.brand-loader--flip-out-x .brand-loader__text {
  animation: bl-flip-out-x var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-flip-out-x {
  0% { transform: rotateX(0deg); opacity: 1; }
  100% { transform: rotateX(-90deg); opacity: 0.2; }
}

.brand-loader--flip-out-y .brand-loader__text {
  animation: bl-flip-out-y var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-flip-out-y {
  0% { transform: rotateY(0deg); opacity: 1; }
  100% { transform: rotateY(-90deg); opacity: 0.2; }
}

/* ---- directional zoom family ---- */

.brand-loader--zoom-in-up .brand-loader__text {
  animation: bl-zoom-in-up var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-zoom-in-up {
  0% { transform: scale(0.5) translateY(30%); opacity: 0.2; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}

.brand-loader--zoom-in-down .brand-loader__text {
  animation: bl-zoom-in-down var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-zoom-in-down {
  0% { transform: scale(0.5) translateY(-30%); opacity: 0.2; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}

.brand-loader--zoom-in-left .brand-loader__text {
  animation: bl-zoom-in-left var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-zoom-in-left {
  0% { transform: scale(0.5) translateX(-30%); opacity: 0.2; }
  100% { transform: scale(1) translateX(0); opacity: 1; }
}

.brand-loader--zoom-in-right .brand-loader__text {
  animation: bl-zoom-in-right var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-zoom-in-right {
  0% { transform: scale(0.5) translateX(30%); opacity: 0.2; }
  100% { transform: scale(1) translateX(0); opacity: 1; }
}

/* ---- rotation family ---- */

.brand-loader--rotate-cw .brand-loader__text {
  animation: bl-rotate-cw calc(var(--brand-loader-duration) * 2) linear infinite;
}
@keyframes bl-rotate-cw {
  to { transform: rotate(360deg); }
}

.brand-loader--rotate-ccw .brand-loader__text {
  animation: bl-rotate-ccw calc(var(--brand-loader-duration) * 2) linear infinite;
}
@keyframes bl-rotate-ccw {
  to { transform: rotate(-360deg); }
}

.brand-loader--rotate-in-corner .brand-loader__text {
  transform-origin: top left;
  animation: bl-rotate-in-corner var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-rotate-in-corner {
  0% { transform: rotate(-25deg) scale(0.8); opacity: 0.2; }
  100% { transform: rotate(0deg) scale(1); opacity: 1; }
}

/* ---- light speed / jello / blink ---- */

.brand-loader--light-speed-in .brand-loader__text {
  animation: bl-light-speed-in var(--brand-loader-duration) ease-out infinite;
}
@keyframes bl-light-speed-in {
  0% { transform: translateX(80%) skewX(-30deg); opacity: 0; }
  60% { transform: translateX(0) skewX(10deg); opacity: 1; }
  100% { transform: translateX(0) skewX(0); opacity: 1; }
}

.brand-loader--light-speed-out .brand-loader__text {
  animation: bl-light-speed-out var(--brand-loader-duration) ease-in infinite;
}
@keyframes bl-light-speed-out {
  0% { transform: translateX(0) skewX(0); opacity: 1; }
  100% { transform: translateX(80%) skewX(30deg); opacity: 0; }
}

.brand-loader--jello .brand-loader__text {
  animation: bl-jello var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-jello {
  0%, 100% { transform: skewX(0deg) skewY(0deg); }
  22% { transform: skewX(-10deg) skewY(-10deg); }
  40% { transform: skewX(6deg) skewY(6deg); }
  58% { transform: skewX(-3deg) skewY(-3deg); }
  75% { transform: skewX(1.5deg) skewY(1.5deg); }
}

.brand-loader--blink .brand-loader__text {
  animation: bl-blink var(--brand-loader-duration) steps(1) infinite;
}
@keyframes bl-blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}

/* ---- liquid / organic ---- */

.brand-loader--liquid-wave .brand-loader__text {
  display: inline-block;
  animation: bl-liquid-wave var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-liquid-wave {
  0%, 100% { transform: translateY(0) scaleY(1); }
  25% { transform: translateY(-6%) scaleY(1.04); }
  50% { transform: translateY(0) scaleY(0.97); }
  75% { transform: translateY(4%) scaleY(1.02); }
}

.brand-loader--morph .brand-loader__text {
  animation: bl-morph var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-morph {
  0%, 100% { transform: scale(1, 1) skew(0deg); border-radius: 0; }
  33% { transform: scale(1.06, 0.94) skew(-2deg); }
  66% { transform: scale(0.95, 1.06) skew(2deg); }
}

.brand-loader--blob .brand-loader__text {
  animation: bl-blob var(--brand-loader-duration) ease-in-out infinite;
  filter: blur(0);
}
@keyframes bl-blob {
  0%, 100% { transform: scale(1); filter: blur(0); }
  50% { transform: scale(1.05, 0.95); filter: blur(0.4px); }
}

.brand-loader--ripple .brand-loader__text {
  animation: bl-ripple-text var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-ripple-text {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.03); opacity: 0.85; }
}

.brand-loader--melt .brand-loader__text {
  transform-origin: top center;
  animation: bl-melt var(--brand-loader-duration) ease-in infinite alternate;
}
@keyframes bl-melt {
  0% { transform: scaleY(1) translateY(0); opacity: 1; }
  100% { transform: scaleY(1.15) translateY(6%); opacity: 0.7; filter: blur(1px); }
}

.brand-loader--drip .brand-loader__text {
  animation: bl-drip var(--brand-loader-duration) ease-in infinite;
}
@keyframes bl-drip {
  0% { transform: translateY(0); opacity: 1; }
  70% { transform: translateY(10%); opacity: 1; }
  100% { transform: translateY(24%); opacity: 0; }
}

.brand-loader--ooze .brand-loader__text {
  animation: bl-ooze var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-ooze {
  0%, 100% { transform: skewX(0deg) scaleX(1); }
  50% { transform: skewX(4deg) scaleX(1.05); }
}

.brand-loader--breathe .brand-loader__text {
  animation: bl-breathe calc(var(--brand-loader-duration) * 1.4) ease-in-out infinite;
}
@keyframes bl-breathe {
  0%, 100% { transform: scale(1); opacity: 0.85; }
  50% { transform: scale(1.04); opacity: 1; }
}

/* ---- retro / CRT / cyberpunk ---- */

.brand-loader--crt-flicker .brand-loader__text {
  animation: bl-crt-flicker calc(var(--brand-loader-duration) / 2) steps(1) infinite;
}
@keyframes bl-crt-flicker {
  0%, 100% { opacity: 1; }
  8% { opacity: 0.82; }
  9% { opacity: 1; }
  33% { opacity: 0.9; }
  34% { opacity: 1; }
  72% { opacity: 0.85; }
  73% { opacity: 1; }
}

.brand-loader--vhs-glitch .brand-loader__text {
  animation: bl-vhs-glitch var(--brand-loader-duration) steps(1) infinite;
}
@keyframes bl-vhs-glitch {
  0%, 90%, 100% { transform: translate(0); text-shadow: none; }
  91% { transform: translate(-2px, 1px); text-shadow: 2px 0 #ff3b3b, -2px 0 #3bd6ff; }
  93% { transform: translate(2px, -1px); text-shadow: -2px 0 #ff3b3b, 2px 0 #3bd6ff; }
  95% { transform: translate(-1px, 0); text-shadow: none; }
}

.brand-loader--scanlines .brand-loader__text::after {
  content: "";
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0.12) 0px,
    rgba(255, 255, 255, 0.12) 1px,
    transparent 1px,
    transparent 3px
  );
  mix-blend-mode: overlay;
  animation: bl-scanlines calc(var(--brand-loader-duration) * 1.5) linear infinite;
  pointer-events: none;
}
@keyframes bl-scanlines {
  from { background-position-y: 0; }
  to { background-position-y: 12px; }
}

.brand-loader--hologram .brand-loader__text {
  color: var(--brand-loader-color);
  animation: bl-hologram var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-hologram {
  0%, 100% { opacity: 0.85; text-shadow: 0 0 6px var(--brand-loader-color); transform: translateY(0); }
  50% { opacity: 1; text-shadow: 0 0 14px var(--brand-loader-color), 0 2px 4px rgba(0,200,255,0.4); transform: translateY(-2%); }
}

.brand-loader--cyberpunk-glow .brand-loader__text {
  animation: bl-cyberpunk-glow var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-cyberpunk-glow {
  0% { text-shadow: 2px 0 #ff2fd0, -2px 0 #2fe4ff; }
  100% { text-shadow: 3px 0 #ff2fd0, -3px 0 #2fe4ff, 0 0 16px var(--brand-loader-color); }
}

.brand-loader--terminal-blink .brand-loader__text {
  border-right: 0.1em solid var(--brand-loader-color);
  animation: bl-terminal-blink var(--brand-loader-duration) steps(1) infinite;
}
@keyframes bl-terminal-blink {
  0%, 49% { border-color: var(--brand-loader-color); }
  50%, 100% { border-color: transparent; }
}

.brand-loader--pixelate .brand-loader__text {
  animation: bl-pixelate var(--brand-loader-duration) steps(6) infinite alternate;
}
@keyframes bl-pixelate {
  0% { filter: blur(0); opacity: 1; }
  50% { filter: blur(2px); opacity: 0.6; }
  100% { filter: blur(0); opacity: 1; }
}

.brand-loader--static-tv .brand-loader__text {
  animation: bl-static-tv calc(var(--brand-loader-duration) / 3) steps(2) infinite;
}
@keyframes bl-static-tv {
  0%, 100% { transform: translate(0, 0); opacity: 1; }
  25% { transform: translate(-1px, 1px); opacity: 0.9; }
  50% { transform: translate(1px, -1px); opacity: 1; }
  75% { transform: translate(-1px, -1px); opacity: 0.85; }
}

.brand-loader--tracking-error .brand-loader__text {
  animation: bl-tracking-error var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-tracking-error {
  0%, 80%, 100% { transform: translateY(0); clip-path: inset(0 0 0 0); }
  82% { transform: translateY(4%); clip-path: inset(10% 0 20% 0); }
  85% { transform: translateY(-3%); clip-path: inset(30% 0 5% 0); }
  88% { transform: translateY(0); clip-path: inset(0 0 0 0); }
}

.brand-loader--neon-sign-flicker .brand-loader__text {
  animation: bl-neon-sign-flicker calc(var(--brand-loader-duration) * 1.3) linear infinite;
}
@keyframes bl-neon-sign-flicker {
  0%, 18%, 22%, 25%, 53%, 57%, 100% {
    opacity: 1;
    text-shadow: 0 0 6px var(--brand-loader-color), 0 0 16px var(--brand-loader-color);
  }
  20%, 24%, 55% { opacity: 0.3; text-shadow: none; }
}

/* ---- glass / material ---- */

.brand-loader--glass-shine .brand-loader__text { overflow: hidden; }
.brand-loader--glass-shine .brand-loader__text::after {
  content: "";
  position: absolute; inset: 0;
  background: linear-gradient(100deg, transparent 35%, rgba(255,255,255,0.8) 50%, transparent 65%);
  background-size: 300% 100%;
  background-position: 150% 0;
  animation: bl-glass-shine var(--brand-loader-duration) ease-in-out infinite;
  pointer-events: none;
}
@keyframes bl-glass-shine {
  from { background-position: 150% 0; }
  to { background-position: -50% 0; }
}

.brand-loader--frosted .brand-loader__text {
  animation: bl-frosted var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-frosted {
  0% { filter: blur(3px) brightness(1.1); opacity: 0.7; }
  100% { filter: blur(0) brightness(1); opacity: 1; }
}

.brand-loader--glossy-sheen .brand-loader__text {
  background: linear-gradient(180deg, #fff 0%, var(--brand-loader-color) 45%, var(--brand-loader-color) 100%);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  animation: bl-glossy-sheen var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-glossy-sheen {
  0% { filter: brightness(0.9); }
  100% { filter: brightness(1.25); }
}

.brand-loader--mica .brand-loader__text {
  animation: bl-mica var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-mica {
  0%, 100% { opacity: 0.9; filter: saturate(0.9); }
  50% { opacity: 1; filter: saturate(1.2); }
}

.brand-loader--aurora .brand-loader__text {
  background: linear-gradient(90deg, #7dd3fc, #a78bfa, #f472b6, #7dd3fc);
  background-size: 300% 100%;
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  animation: bl-aurora calc(var(--brand-loader-duration) * 2) ease infinite;
}
@keyframes bl-aurora {
  0% { background-position: 0% 50%; }
  100% { background-position: 300% 50%; }
}

.brand-loader--prism .brand-loader__text {
  animation: bl-prism var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-prism {
  0% { text-shadow: 1px 0 red, -1px 0 cyan; }
  100% { text-shadow: 3px 0 red, -3px 0 cyan, 0 0 10px rgba(255,255,255,0.5); }
}

/* ---- paper / origami ---- */

.brand-loader--fold-in .brand-loader__text {
  transform-origin: top center;
  animation: bl-fold-in var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-fold-in {
  0% { transform: rotateX(-90deg); opacity: 0.2; }
  100% { transform: rotateX(0deg); opacity: 1; }
}

.brand-loader--unfold .brand-loader__text {
  transform-origin: left center;
  animation: bl-unfold var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-unfold {
  0% { transform: rotateY(-80deg); opacity: 0.2; }
  100% { transform: rotateY(0deg); opacity: 1; }
}

.brand-loader--paper-flip .brand-loader__text {
  animation: bl-paper-flip var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-paper-flip {
  0%, 100% { transform: rotateX(0deg); }
  50% { transform: rotateX(20deg); }
}

.brand-loader--crease .brand-loader__text {
  animation: bl-crease var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-crease {
  0%, 100% { transform: scaleY(1) skewX(0deg); }
  50% { transform: scaleY(0.92) skewX(-1.5deg); }
}

.brand-loader--ribbon-wave .brand-loader__text {
  animation: bl-ribbon-wave var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-ribbon-wave {
  0%, 100% { transform: skewY(0deg) translateY(0); }
  25% { transform: skewY(1.5deg) translateY(-3%); }
  75% { transform: skewY(-1.5deg) translateY(3%); }
}

/* ---- nature-inspired ---- */

.brand-loader--flame-flicker .brand-loader__text {
  animation: bl-flame-flicker calc(var(--brand-loader-duration) / 2) ease-in-out infinite;
}
@keyframes bl-flame-flicker {
  0%, 100% { transform: scaleY(1) skewX(0deg); opacity: 1; }
  25% { transform: scaleY(1.03) skewX(1deg); opacity: 0.92; }
  50% { transform: scaleY(0.97) skewX(-1deg); opacity: 1; }
  75% { transform: scaleY(1.02) skewX(0.5deg); opacity: 0.95; }
}

.brand-loader--water-ripple .brand-loader__text {
  animation: bl-water-ripple var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-water-ripple {
  0%, 100% { transform: translateY(0) scaleX(1); }
  50% { transform: translateY(-3%) scaleX(1.02); }
}

.brand-loader--wind-sway .brand-loader__text {
  transform-origin: bottom center;
  animation: bl-wind-sway calc(var(--brand-loader-duration) * 1.5) ease-in-out infinite;
}
@keyframes bl-wind-sway {
  0%, 100% { transform: rotate(-2deg) translateX(0); }
  50% { transform: rotate(2deg) translateX(3%); }
}

.brand-loader--ember-glow .brand-loader__text {
  animation: bl-ember-glow var(--brand-loader-duration) ease-in-out infinite alternate;
}
@keyframes bl-ember-glow {
  0% { text-shadow: 0 0 4px #ff7a1a, 0 0 8px #ff3d00; opacity: 0.8; }
  100% { text-shadow: 0 0 10px #ffb347, 0 0 20px #ff5500; opacity: 1; }
}

.brand-loader--smoke-rise .brand-loader__text {
  animation: bl-smoke-rise calc(var(--brand-loader-duration) * 1.6) ease-in infinite;
}
@keyframes bl-smoke-rise {
  0% { transform: translateY(6%); opacity: 0.5; filter: blur(1px); }
  50% { transform: translateY(-4%); opacity: 1; filter: blur(0); }
  100% { transform: translateY(-10%); opacity: 0.5; filter: blur(1.5px); }
}

.brand-loader--cloud-drift .brand-loader__text {
  animation: bl-cloud-drift calc(var(--brand-loader-duration) * 2) ease-in-out infinite;
}
@keyframes bl-cloud-drift {
  0%, 100% { transform: translateX(-4%); opacity: 0.85; }
  50% { transform: translateX(4%); opacity: 1; }
}

/* ---- celestial / orbit ---- */

.brand-loader--comet .brand-loader__text {
  animation: bl-comet var(--brand-loader-duration) ease-in infinite;
}
@keyframes bl-comet {
  0% { transform: translateX(-40%); opacity: 0; filter: blur(3px); }
  40% { opacity: 1; filter: blur(0); }
  100% { transform: translateX(0); opacity: 1; filter: blur(0); }
}

.brand-loader--shooting-star .brand-loader__text {
  animation: bl-shooting-star var(--brand-loader-duration) ease-out infinite;
}
@keyframes bl-shooting-star {
  0% { transform: translate(-30%, 20%) scale(0.7); opacity: 0; }
  30% { opacity: 1; }
  100% { transform: translate(0, 0) scale(1); opacity: 1; }
}

.brand-loader--orbit .brand-loader__text {
  display: inline-block;
  animation: bl-orbit calc(var(--brand-loader-duration) * 2) linear infinite;
}
@keyframes bl-orbit {
  0% { transform: rotate(0deg) translateX(4px) rotate(0deg); }
  100% { transform: rotate(360deg) translateX(4px) rotate(-360deg); }
}

.brand-loader--pendulum .brand-loader__text {
  transform-origin: top center;
  animation: bl-pendulum var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-pendulum {
  0%, 100% { transform: rotate(18deg); }
  50% { transform: rotate(-18deg); }
}

.brand-loader--metronome .brand-loader__text {
  transform-origin: bottom center;
  animation: bl-metronome var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-metronome {
  0%, 100% { transform: rotate(-12deg); }
  50% { transform: rotate(12deg); }
}

.brand-loader--seesaw .brand-loader__text {
  animation: bl-seesaw var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-seesaw {
  0%, 100% { transform: rotate(-4deg) translateY(2%); }
  50% { transform: rotate(4deg) translateY(-2%); }
}

/* ---- sequential mechanisms ---- */

.brand-loader--accordion .brand-loader__text {
  animation: bl-accordion var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-accordion {
  0%, 100% { transform: scaleX(1); letter-spacing: 0.1em; }
  50% { transform: scaleX(0.85); letter-spacing: -0.02em; }
}

.brand-loader--zipper .brand-loader__letter {
  display: inline-block;
  animation: bl-zipper var(--brand-loader-duration) ease-in-out infinite;
}
.brand-loader--zipper .brand-loader__letter:nth-child(odd) {
  animation-name: bl-zipper-up;
}
.brand-loader--zipper .brand-loader__letter:nth-child(even) {
  animation-name: bl-zipper-down;
}
@keyframes bl-zipper-up {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-30%); }
}
@keyframes bl-zipper-down {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(30%); }
}

.brand-loader--domino .brand-loader__letter {
  display: inline-block;
  transform-origin: bottom center;
  animation: bl-domino var(--brand-loader-duration) ease-in-out infinite;
  animation-delay: calc(var(--i, 0) * var(--brand-loader-duration) / 18);
}
@keyframes bl-domino {
  0%, 70%, 100% { transform: rotateZ(0deg); }
  35% { transform: rotateZ(35deg); }
}

.brand-loader--ripple-wave .brand-loader__text {
  animation: bl-ripple-wave var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-ripple-wave {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-6%) scale(1.02); }
}

.brand-loader--pop-in .brand-loader__text {
  animation: bl-pop-in var(--brand-loader-duration) cubic-bezier(0.34, 1.56, 0.64, 1) infinite;
}
@keyframes bl-pop-in {
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(1); }
}

.brand-loader--pop-out .brand-loader__text {
  animation: bl-pop-out var(--brand-loader-duration) ease-in infinite;
}
@keyframes bl-pop-out {
  0%, 70% { transform: scale(1); opacity: 1; }
  100% { transform: scale(0.3); opacity: 0; }
}

.brand-loader--snap-in .brand-loader__text {
  animation: bl-snap-in var(--brand-loader-duration) steps(3) infinite;
}
@keyframes bl-snap-in {
  0% { transform: scale(0.5); opacity: 0.3; }
  50% { transform: scale(1.05); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

.brand-loader--magnet-pulse .brand-loader__text {
  animation: bl-magnet-pulse var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-magnet-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.06); text-shadow: 0 0 12px var(--brand-loader-color); }
}

/* ---- spin / spiral ---- */

.brand-loader--vortex .brand-loader__text {
  animation: bl-vortex var(--brand-loader-duration) ease-in infinite;
}
@keyframes bl-vortex {
  0% { transform: rotate(0deg) scale(1); opacity: 1; }
  70% { transform: rotate(180deg) scale(0.6); opacity: 0.4; }
  100% { transform: rotate(360deg) scale(1); opacity: 1; }
}

.brand-loader--spiral-in .brand-loader__text {
  animation: bl-spiral-in var(--brand-loader-duration) ease-out infinite alternate;
}
@keyframes bl-spiral-in {
  0% { transform: rotate(-180deg) scale(0.3); opacity: 0; }
  100% { transform: rotate(0deg) scale(1); opacity: 1; }
}

.brand-loader--spiral-out .brand-loader__text {
  animation: bl-spiral-out var(--brand-loader-duration) ease-in infinite alternate;
}
@keyframes bl-spiral-out {
  0% { transform: rotate(0deg) scale(1); opacity: 1; }
  100% { transform: rotate(180deg) scale(0.3); opacity: 0; }
}

.brand-loader--tornado .brand-loader__text {
  animation: bl-tornado var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-tornado {
  0%, 100% { transform: skewX(0deg) scaleX(1) rotate(0deg); }
  25% { transform: skewX(6deg) scaleX(0.95) rotate(2deg); }
  75% { transform: skewX(-6deg) scaleX(0.95) rotate(-2deg); }
}

.brand-loader--earthquake .brand-loader__text {
  animation: bl-earthquake calc(var(--brand-loader-duration) / 4) linear infinite;
}
@keyframes bl-earthquake {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  20% { transform: translate(-2px, 1px) rotate(-0.5deg); }
  40% { transform: translate(2px, -1px) rotate(0.5deg); }
  60% { transform: translate(-1px, -1px) rotate(-0.3deg); }
  80% { transform: translate(1px, 1px) rotate(0.3deg); }
}

/* ---- glitch family expansion ---- */

.brand-loader--glitch-rgb .brand-loader__text {
  animation: bl-glitch-rgb var(--brand-loader-duration) steps(1) infinite;
}
@keyframes bl-glitch-rgb {
  0%, 88%, 100% { text-shadow: none; transform: translate(0); }
  90% { text-shadow: -2px 0 red, 2px 0 lime, 0 0 blue; transform: translate(-1px, 0); }
  92% { text-shadow: 2px 0 red, -2px 0 lime, 0 0 blue; transform: translate(1px, 0); }
  94% { text-shadow: none; transform: translate(0); }
}

.brand-loader--glitch-slice .brand-loader__text {
  animation: bl-glitch-slice var(--brand-loader-duration) steps(1) infinite;
}
@keyframes bl-glitch-slice {
  0%, 85%, 100% { clip-path: inset(0 0 0 0); transform: translate(0); }
  87% { clip-path: inset(10% 0 60% 0); transform: translate(-3px); }
  89% { clip-path: inset(50% 0 5% 0); transform: translate(3px); }
  91% { clip-path: inset(0 0 0 0); transform: translate(0); }
}

.brand-loader--datamosh .brand-loader__text {
  animation: bl-datamosh calc(var(--brand-loader-duration) / 2) steps(1) infinite;
}
@keyframes bl-datamosh {
  0%, 80%, 100% { filter: none; transform: translate(0); }
  82% { filter: hue-rotate(90deg) saturate(3); transform: translate(-2px, 1px); }
  85% { filter: hue-rotate(-60deg) saturate(2); transform: translate(2px, -1px); }
  88% { filter: none; transform: translate(0); }
}

.brand-loader--binary-flicker .brand-loader__text {
  animation: bl-binary-flicker calc(var(--brand-loader-duration) / 2) steps(1) infinite;
}
@keyframes bl-binary-flicker {
  0%, 100% { opacity: 1; }
  15% { opacity: 0.4; }
  16% { opacity: 1; }
  45% { opacity: 0.5; }
  46% { opacity: 1; }
  70% { opacity: 0.3; }
  71% { opacity: 1; }
}

.brand-loader--matrix-rain .brand-loader__letter {
  display: inline-block;
  animation: bl-matrix-rain var(--brand-loader-duration) linear infinite;
  animation-delay: calc(var(--i, 0) * var(--brand-loader-duration) / 24);
  text-shadow: 0 0 6px #00ff6a;
}
@keyframes bl-matrix-rain {
  0% { opacity: 0; transform: translateY(-80%); }
  15% { opacity: 1; }
  80% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(20%); }
}

.brand-loader--code-scroll .brand-loader__text {
  overflow: hidden;
  animation: bl-code-scroll var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-code-scroll {
  0% { transform: translateY(0); opacity: 1; }
  45% { transform: translateY(-100%); opacity: 0; }
  46% { transform: translateY(100%); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}

.brand-loader--dot-trail .brand-loader__text::after {
  content: "...";
  display: inline-block;
  width: 1.5em;
  overflow: hidden;
  white-space: nowrap;
  vertical-align: bottom;
  animation: bl-dot-trail var(--brand-loader-duration) steps(4) infinite;
}
@keyframes bl-dot-trail {
  0% { width: 0; }
  100% { width: 1.5em; }
}

/* ---- sweep / radar ---- */

.brand-loader--progress-sweep .brand-loader__text {
  background: linear-gradient(90deg, var(--brand-loader-color) 50%, rgba(255,255,255,0.25) 50%);
  background-size: 200% 100%;
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  animation: bl-progress-sweep var(--brand-loader-duration) linear infinite;
}
@keyframes bl-progress-sweep {
  from { background-position: 100% 0; }
  to { background-position: 0% 0; }
}

.brand-loader--radar-sweep .brand-loader__text {
  animation: bl-radar-sweep var(--brand-loader-duration) ease-in-out infinite;
}
@keyframes bl-radar-sweep {
  0%, 100% { opacity: 0.4; text-shadow: none; }
  50% { opacity: 1; text-shadow: 0 0 14px var(--brand-loader-color); }
}

/* ======================================================================
   mouse / pointer-interactive presets
   The 6 "cursor-tracking" ones below read --mx/--my/--mx-c/--my-c,
   which BrandLoader.tsx updates on mousemove (see MOUSE_TRACK_ANIMATIONS).
   repel-letters/attract-letters set each letter's transform directly
   in JS (see MOUSE_LETTER_ANIMATIONS) - CSS only provides the spring-back
   transition, already defined in brand-loader.css.
   ripple-click renders .brand-loader__ripple spans on click (JS).
   hover-scale/hover-glitch/hover-underline need no JS at all - plain :hover.
   ====================================================================== */

.brand-loader--cursor-follow .brand-loader__text {
  transform: translate(
    calc(var(--mx-c) * 6px),
    calc(var(--my-c) * 6px)
  );
  transition: transform 0.12s ease-out;
}

.brand-loader--magnetic-pull .brand-loader__text {
  transform: translate(
    calc(var(--mx-c) * 10px),
    calc(var(--my-c) * 10px)
  ) scale(1.02);
  transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.brand-loader--tilt-3d .brand-loader__text {
  display: inline-block;
  transform: rotateX(calc(var(--my-c) * -10deg)) rotateY(calc(var(--mx-c) * 10deg));
  transition: transform 0.12s ease-out;
}

.brand-loader--spotlight-cursor .brand-loader__text {
  background: radial-gradient(
    circle 80px at var(--mx) var(--my),
    #fff 0%,
    var(--brand-loader-color) 70%
  );
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  transition: background-position 0.1s ease-out;
}

.brand-loader--cursor-glow .brand-loader__text {
  text-shadow: 0 0 calc(6px + abs(var(--mx-c)) * 10px) var(--brand-loader-color);
  transition: text-shadow 0.15s ease-out;
}
/* abs() has limited support; fall back to a steady glow that still
   intensifies via the radial-gradient trick below where supported. */
@supports not (width: abs(1px)) {
  .brand-loader--cursor-glow .brand-loader__text {
    text-shadow: 0 0 12px var(--brand-loader-color);
  }
}

.brand-loader--parallax-cursor .brand-loader__text {
  transform: translate(calc(var(--mx-c) * -4px), calc(var(--my-c) * -4px));
  transition: transform 0.2s ease-out;
}
.brand-loader--parallax-cursor .brand-loader__text::after {
  content: attr(data-brand);
  position: absolute;
  inset: 0;
  color: var(--brand-loader-color);
  opacity: 0.25;
  transform: translate(calc(var(--mx-c) * 8px), calc(var(--my-c) * 8px));
  transition: transform 0.2s ease-out;
  z-index: -1;
}

.brand-loader--hover-scale .brand-loader__text {
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.brand-loader--hover-scale:hover .brand-loader__text {
  transform: scale(1.1);
}

.brand-loader--hover-glitch .brand-loader__text {
  transition: opacity 0.1s;
}
.brand-loader--hover-glitch:hover .brand-loader__text::before,
.brand-loader--hover-glitch:hover .brand-loader__text::after {
  content: attr(data-brand);
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.brand-loader--hover-glitch:hover .brand-loader__text::before {
  animation: bl-g1 0.4s infinite;
}
.brand-loader--hover-glitch:hover .brand-loader__text::after {
  animation: bl-g2 0.4s infinite;
}

.brand-loader--hover-underline .brand-loader__text {
  padding-bottom: 0.15em;
}
.brand-loader--hover-underline .brand-loader__text::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  width: 100%;
  background: var(--brand-loader-color);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.3s ease-out;
}
.brand-loader--hover-underline:hover .brand-loader__text::after {
  transform: scaleX(1);
}
```

```css
/* File: src\components\ui\brand-loader\brand-loader.css */
.brand-loader {
  --brand-loader-duration: 1.8s;
  --brand-loader-color: currentColor;
  /* set by BrandLoader.tsx on pointer events for the mouse-interactive
     presets; neutral/centered defaults so nothing looks broken before
     the first mousemove. */
  --mx: 50%;
  --my: 50%;
  --mx-c: 0;
  --my-c: 0;

  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* used by flip-x, flip-y, letter-spin, perspective-tilt, roll-in,
     tilt-3d */
  perspective: 800px;
  position: relative;
}

.brand-loader--ripple-click {
  cursor: pointer;
}

.brand-loader--speed-slow {
  --brand-loader-duration: 3s;
}

.brand-loader--speed-normal {
  --brand-loader-duration: 1.8s;
}

.brand-loader--speed-fast {
  --brand-loader-duration: 0.9s;
}

.brand-loader--fullscreen {
  position: fixed;
  inset: 0;
  width: 100%;
  min-height: 100vh;
  z-index: 9999;
}

.brand-loader__text {
  position: relative;
  display: inline-block;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  color: var(--brand-loader-color);
  user-select: none;
}

.brand-loader--sm .brand-loader__text {
  font-size: 1.25rem;
}

.brand-loader--md .brand-loader__text {
  font-size: 2rem;
}

.brand-loader--lg .brand-loader__text {
  font-size: 3rem;
}

.brand-loader--xl .brand-loader__text {
  font-size: 5rem;
}

.brand-loader__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* rendered by BrandLoader.tsx for the ripple-click preset */
.brand-loader__ripple {
  position: absolute;
  width: 8px;
  height: 8px;
  margin-left: -4px;
  margin-top: -4px;
  border-radius: 50%;
  background: var(--brand-loader-color);
  opacity: 0.5;
  pointer-events: none;
  animation: bl-ripple-click 0.6s ease-out forwards;
}
@keyframes bl-ripple-click {
  to {
    width: 140px;
    height: 140px;
    margin-left: -70px;
    margin-top: -70px;
    opacity: 0;
  }
}

/* repel-letters / attract-letters get their transform set inline by
   JS on mousemove; this transition makes them spring back smoothly
   on mouseleave instead of snapping. */
.brand-loader--repel-letters .brand-loader__letter,
.brand-loader--attract-letters .brand-loader__letter {
  display: inline-block;
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Respect reduced-motion preferences: keep the brand text visible,
   just drop the animation instead of hiding content. */
@media (prefers-reduced-motion: reduce) {
  .brand-loader__text,
  .brand-loader__text::before,
  .brand-loader__text::after {
    animation: none !important;
    transition: none !important;
    opacity: 1 !important;
    background: none !important;
    color: var(--brand-loader-color) !important;
  }
}
```

```tsx
// File: src\components\ui\brand-loader\BrandLoader.tsx
import React, { useCallback, useMemo, useRef, useState } from "react";
import "./brand-loader.css";
import "./animations.css";
import { registerFont } from "./fonts";
import type { BrandLoaderAnimation, BrandLoaderProps } from "./types";

/**
 * Presets that render each character as its own `.brand-loader__letter`
 * span (for staggered animation-delay, or per-letter JS-driven
 * transforms) instead of plain text.
 */
const LETTER_ANIMATIONS = new Set<BrandLoaderAnimation>([
  "wave",
  "letter-spin",
  "typewriter",
  "cascade",
  "letter-fade",
  "letter-pop",
  "zipper",
  "domino",
  "matrix-rain",
  "repel-letters",
  "attract-letters",
]);

/**
 * Presets that track cursor position at the whole-loader level via the
 * --mx / --my (0-100%) and --mx-c / --my-c (-1..1) CSS custom
 * properties. The CSS for each of these reads those variables; this
 * component's only job is to keep them updated on mousemove.
 */
const MOUSE_TRACK_ANIMATIONS = new Set<BrandLoaderAnimation>([
  "cursor-follow",
  "magnetic-pull",
  "tilt-3d",
  "spotlight-cursor",
  "cursor-glow",
  "parallax-cursor",
]);

/**
 * Presets where individual letters lean toward or away from the
 * cursor. These need real per-letter geometry, so they're handled
 * with direct ref/style manipulation rather than CSS variables.
 */
const MOUSE_LETTER_ANIMATIONS = new Set<BrandLoaderAnimation>([
  "repel-letters",
  "attract-letters",
]);

const REPEL_ATTRACT_RADIUS_PX = 70;

let rippleId = 0;

/**
 * BrandLoader
 *
 * A self-contained, animated loading indicator that renders your
 * brand/product name in a custom font. 162 built-in animation presets
 * (including 12 mouse/pointer-interactive ones) plus a "custom" escape
 * hatch — see BrandLoaderAnimation in types.ts for the full list.
 *
 * Font files are expected at `/public/.font/{name}.woff2` by default
 * (see the `font` prop docs in types.ts for weighted / custom paths).
 *
 * @example
 * <BrandLoader brand="VEGA" font="Orbitron" animation="scan" />
 * <BrandLoader brand="VEGA" animation="tilt-3d" />
 * <BrandLoader brand="VEGA" animation="repel-letters" />
 */
export function BrandLoader({
  brand,
  font,
  animation = "fade",
  size = "md",
  speed = "normal",
  fullscreen = false,
  brandMark = false,
  className = "",
  style,
  ariaLabel,
}: BrandLoaderProps) {
  const fontFamily = useMemo(() => {
    if (!font) return undefined;
    return registerFont(font);
  }, [font]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const letterRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const [ripples, setRipples] = useState<
    { id: number; x: number; y: number }[]
  >([]);

  const isMouseTrack = MOUSE_TRACK_ANIMATIONS.has(animation);
  const isMouseLetter = MOUSE_LETTER_ANIMATIONS.has(animation);
  const isRippleClick = animation === "ripple-click";
  const usesLetters = LETTER_ANIMATIONS.has(animation);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = containerRef.current;
      if (!el) return;

      if (isMouseTrack) {
        const rect = el.getBoundingClientRect();
        const px = ((e.clientX - rect.left) / rect.width) * 100;
        const py = ((e.clientY - rect.top) / rect.height) * 100;
        el.style.setProperty("--mx", `${px}%`);
        el.style.setProperty("--my", `${py}%`);
        el.style.setProperty("--mx-c", `${(px - 50) / 50}`);
        el.style.setProperty("--my-c", `${(py - 50) / 50}`);
      }

      if (isMouseLetter) {
        const sign = animation === "repel-letters" ? -1 : 1;
        const strength = animation === "repel-letters" ? 16 : 7;
        for (const letter of letterRefs.current) {
          if (!letter) continue;
          const r = letter.getBoundingClientRect();
          const lx = r.left + r.width / 2;
          const ly = r.top + r.height / 2;
          const dx = e.clientX - lx;
          const dy = e.clientY - ly;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < REPEL_ATTRACT_RADIUS_PX) {
            const force =
              (REPEL_ATTRACT_RADIUS_PX - dist) / REPEL_ATTRACT_RADIUS_PX;
            const tx = sign * (dx / dist) * force * strength;
            const ty = sign * (dy / dist) * force * strength;
            letter.style.transform = `translate(${tx}px, ${ty}px)`;
          } else {
            letter.style.transform = "";
          }
        }
      }
    },
    [animation, isMouseTrack, isMouseLetter]
  );

  const handleMouseLeave = useCallback(() => {
    const el = containerRef.current;
    if (isMouseTrack && el) {
      el.style.setProperty("--mx", "50%");
      el.style.setProperty("--my", "50%");
      el.style.setProperty("--mx-c", "0");
      el.style.setProperty("--my-c", "0");
    }
    if (isMouseLetter) {
      for (const letter of letterRefs.current) {
        if (letter) letter.style.transform = "";
      }
    }
  }, [isMouseTrack, isMouseLetter]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isRippleClick) return;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setRipples((prev) => [
        ...prev,
        { id: ++rippleId, x: e.clientX - rect.left, y: e.clientY - rect.top },
      ]);
    },
    [isRippleClick]
  );

  const removeRipple = useCallback((id: number) => {
    setRipples((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const classes = [
    "brand-loader",
    `brand-loader--${animation}`,
    `brand-loader--${size}`,
    `brand-loader--speed-${speed}`,
    fullscreen ? "brand-loader--fullscreen" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const needsMouseHandlers = isMouseTrack || isMouseLetter || isRippleClick;

  return (
    <div
      ref={containerRef}
      className={classes}
      // In `brandMark` mode the loader is a brand mark, not a status message:
      // a live region here would make a screen reader announce
      // "Loading VEGA" on every route change.
      role={brandMark ? undefined : "status"}
      aria-live={brandMark ? undefined : "polite"}
      aria-label={brandMark ? ariaLabel : ariaLabel ?? `Loading ${brand}`}
      onMouseMove={needsMouseHandlers ? handleMouseMove : undefined}
      onMouseLeave={needsMouseHandlers ? handleMouseLeave : undefined}
      onClick={isRippleClick ? handleClick : undefined}
    >
      <span
        className="brand-loader__text"
        data-brand={brand}
        style={{
          ...style,
          ...(fontFamily ? { fontFamily } : {}),
        }}
      >
        {usesLetters
          ? [...brand].map((char, i) => (
              <span
                key={i}
                ref={(el) => {
                  letterRefs.current[i] = el;
                }}
                className="brand-loader__letter"
                style={{ "--i": i } as React.CSSProperties}
              >
                {char === " " ? "\u00A0" : char}
              </span>
            ))
          : brand}
      </span>
      {!brandMark && <span className="brand-loader__sr-only">Loading&hellip;</span>}
      {isRippleClick &&
        ripples.map((r) => (
          <span
            key={r.id}
            className="brand-loader__ripple"
            style={{ left: r.x, top: r.y }}
            onAnimationEnd={() => removeRipple(r.id)}
          />
        ))}
    </div>
  );
}

export default BrandLoader;
```

```typescript
// File: src\components\ui\brand-loader\fonts.ts
import type { BrandLoaderFontConfig } from "./types";

const injected = new Set<string>();

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "-");
}

/**
 * Resolves a font prop (string or config object) to a woff2 URL,
 * following the /.font/{name}.woff2 convention unless an explicit
 * `src` or `weight` is given.
 */
function resolveFontPath(font: string | BrandLoaderFontConfig): string {
  if (typeof font === "string") {
    return `/.font/${encodeURIComponent(font)}.woff2`;
  }

  if (font.src) {
    return font.src;
  }

  if (font.weight) {
    return `/.font/${encodeURIComponent(font.name)}/${font.weight}.woff2`;
  }

  return `/.font/${encodeURIComponent(font.name)}.woff2`;
}

/**
 * Injects a scoped @font-face rule for the given font (once per
 * font+weight) and returns the CSS font-family name to use.
 * No-ops safely during SSR.
 */
export function registerFont(font: string | BrandLoaderFontConfig): string {
  const rawName = typeof font === "string" ? font : font.name;
  const weight = typeof font === "string" ? undefined : font.weight;
  const safeName = sanitize(rawName) + (weight ? `-${weight}` : "");
  const fontFamily = `BrandLoader-${safeName}`;

  if (typeof document === "undefined") {
    return fontFamily;
  }

  const styleId = `brand-loader-font-${safeName}`;
  if (injected.has(styleId) || document.getElementById(styleId)) {
    return fontFamily;
  }

  const fontPath = resolveFontPath(font);
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
@font-face {
  font-family: "${fontFamily}";
  src: url("${fontPath}") format("woff2");
  font-weight: ${weight ?? "400 900"};
  font-display: swap;
}
`.trim();

  document.head.appendChild(style);
  injected.add(styleId);

  return fontFamily;
}
```

```typescript
// File: src\components\ui\brand-loader\index.ts
export { BrandLoader, default } from "./BrandLoader";

export type {
  BrandLoaderProps,
  BrandLoaderAnimation,
  BrandLoaderSize,
  BrandLoaderSpeed,
  BrandLoaderFontConfig,
  BrandLoaderCSSProperties,
} from "./types";
```

```markdown
<!-- File: src\components\ui\brand-loader\README.md -->
# BrandLoader

A self-contained, animated brand/loading indicator. Installs directly into
your `src/components/ui/` folder like any other UI component — no build
step, no required dependencies beyond React.

## Install

Copy this folder to:

```
src/components/ui/brand-loader/
```

So you end up with:

```
src/components/ui/brand-loader/
├── BrandLoader.tsx
├── animations.css
├── brand-loader.css
├── fonts.ts
├── types.ts
└── index.ts
```

## Add your font (optional)

Drop a `.woff2` file at:

```
public/.font/YourFontName.woff2
```

If you skip this, `BrandLoader` just inherits the surrounding font.

## Use

```tsx
import { BrandLoader } from "@/components/ui/brand-loader";

export default function Loading() {
  return <BrandLoader brand="VEGA" font="Orbitron" animation="scan" />;
}
```

### Props

| Prop         | Type                                                                 | Default   |
|--------------|-----------------------------------------------------------------------|-----------|
| `brand`      | `string` (required)                                                    | —         |
| `font`       | `string \| { name; weight?; src? }`                                    | inherited |
| `animation`  | one of 162 presets below, or `"custom"`                                | `"fade"`  |
| `size`       | `"sm" \| "md" \| "lg" \| "xl"`                                          | `"md"`    |
| `speed`      | `"slow" \| "normal" \| "fast"`                                         | `"normal"`|
| `fullscreen` | `boolean`                                                              | `false`   |
| `className`  | `string`                                                               | —         |
| `style`      | `BrandLoaderCSSProperties` (typed `React.CSSProperties` + CSS vars)   | —         |
| `ariaLabel`  | `string`                                                               | `Loading {brand}` |

### Animation presets (162 + `custom`)

**Original set (12)** — `fade` · `pulse` · `scan` · `glitch` · `typing` · `reveal` · `shimmer` · `bounce` · `flicker` · `wave` · `blur` · `neon`

**Motion / entrance (10)** — `slide-up` · `slide-down` · `slide-left` · `slide-right` · `zoom-in` · `zoom-out` · `rotate-in` · `roll-in` · `drop` · `rise`

**3D / perspective (4)** — `flip-x` · `flip-y` · `letter-spin` · `perspective-tilt`

**Playful / squash (15)** — `elastic` · `swing` · `rubber` · `jelly` · `heartbeat` · `wobble` · `shake-x` · `shake-y` · `tilt` · `squeeze` · `stretch` · `skew` · `skew-bounce` · `mirror` · `warp`

**Rotation / strobe (4)** — `spin-slow` · `spin-fast` · `flash` · `strobe`

**Sweep / reveal (7)** — `underline-sweep` · `gradient-shift` · `rainbow` · `peekaboo` · `curtain` · `iris` · `wipe-diagonal`

**Ambient / idle (4)** — `levitate` · `drift` · `sway` · `tracking-pulse`

**Texture / glitch family (2)** — `static-noise` · `chromatic`

**Per-letter sequenced (4)** — `typewriter` · `cascade` · `letter-fade` · `letter-pop`

**Directional bounce-in (5)** — `bounce-in` · `bounce-in-up` · `bounce-in-down` · `bounce-in-left` · `bounce-in-right`

**Directional fade (5)** — `fade-in-up` · `fade-in-down` · `fade-in-left` · `fade-in-right` · `fade-out-pulse`

**Directional flip (4)** — `flip-in-x` · `flip-in-y` · `flip-out-x` · `flip-out-y`

**Directional zoom (4)** — `zoom-in-up` · `zoom-in-down` · `zoom-in-left` · `zoom-in-right`

**Rotation family (3)** — `rotate-cw` · `rotate-ccw` · `rotate-in-corner`

**Light speed / jello / blink (4)** — `light-speed-in` · `light-speed-out` · `jello` · `blink`

**Liquid / organic (8)** — `liquid-wave` · `morph` · `blob` · `ripple` · `melt` · `drip` · `ooze` · `breathe`

**Retro / CRT / cyberpunk (10)** — `crt-flicker` · `vhs-glitch` · `scanlines` · `hologram` · `cyberpunk-glow` · `terminal-blink` · `pixelate` · `static-tv` · `tracking-error` · `neon-sign-flicker`

**Glass / material (6)** — `glass-shine` · `frosted` · `glossy-sheen` · `mica` · `aurora` · `prism`

**Paper / origami (5)** — `fold-in` · `unfold` · `paper-flip` · `crease` · `ribbon-wave`

**Nature-inspired (6)** — `flame-flicker` · `water-ripple` · `wind-sway` · `ember-glow` · `smoke-rise` · `cloud-drift`

**Celestial / orbit (6)** — `comet` · `shooting-star` · `orbit` · `pendulum` · `metronome` · `seesaw`

**Sequential mechanisms (8)** — `accordion` · `zipper` · `domino` · `ripple-wave` · `pop-in` · `pop-out` · `snap-in` · `magnet-pulse`

**Spin / spiral (5)** — `vortex` · `spiral-in` · `spiral-out` · `tornado` · `earthquake`

**Glitch family expansion (7)** — `glitch-rgb` · `glitch-slice` · `datamosh` · `binary-flicker` · `matrix-rain` · `code-scroll` · `dot-trail`

**Sweep / radar (2)** — `progress-sweep` · `radar-sweep`

**Mouse / pointer-interactive (12)** — `cursor-follow` · `magnetic-pull` · `tilt-3d` · `spotlight-cursor` · `cursor-glow` · `parallax-cursor` · `repel-letters` · `attract-letters` · `ripple-click` · `hover-scale` · `hover-glitch` · `hover-underline`

> **Per-letter presets** render each character as its own `.brand-loader__letter` span, handled automatically — no extra props needed: `wave`, `letter-spin`, `typewriter`, `cascade`, `letter-fade`, `letter-pop`, `zipper`, `domino`, `matrix-rain`, `repel-letters`, `attract-letters`. Everything else renders `brand` as plain text.

### Mouse / pointer-interactive presets

These 12 respond to the cursor and need no setup beyond picking the preset — `BrandLoader.tsx` attaches the necessary listeners only when one of these is selected, so there's zero overhead for every other preset.

- **Cursor-tracking (6)** — `cursor-follow`, `magnetic-pull`, `tilt-3d`, `spotlight-cursor`, `cursor-glow`, `parallax-cursor`. On `mousemove`, the component writes the pointer position to `--mx`/`--my` (0–100%) and `--mx-c`/`--my-c` (-1..1) on the loader element; the CSS for each preset reads those. Resets to centered on `mouseleave`.
- **Letter-magnetism (2)** — `repel-letters` pushes nearby letters away from the cursor; `attract-letters` pulls them gently toward it. Computed per-letter from real bounding-box distance (70px radius), applied as inline transforms, with a spring-back CSS transition on `mouseleave`.
- **Click (1)** — `ripple-click` spawns an expanding ripple `<span>` at the click point (React state, self-removes via `onAnimationEnd`).
- **Pure CSS `:hover` (3)** — `hover-scale`, `hover-glitch`, `hover-underline` need no JavaScript at all; they only animate while the cursor is over the loader.

```tsx
<BrandLoader brand="VEGA" animation="tilt-3d" />
<BrandLoader brand="VEGA" animation="repel-letters" />
<BrandLoader brand="VEGA" animation="ripple-click" />
```

### Weighted / custom fonts

```tsx
<BrandLoader brand="VEGA" font={{ name: "Orbitron", weight: 700 }} />
// -> /.font/Orbitron/700.woff2

<BrandLoader brand="VEGA" font={{ name: "MyBrand", src: "/assets/MyBrand.woff2" }} />
```

### Custom animation

```tsx
<BrandLoader brand="VEGA" animation="custom" className="vega-loader" />
```

```css
.vega-loader .brand-loader__text {
  animation: vega-entry 1.5s cubic-bezier(0.16, 1, 0.3, 1) infinite alternate;
}
@keyframes vega-entry {
  from { opacity: 0; transform: translateY(20px) scale(0.9); filter: blur(10px); }
  to   { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
}
```

### CSS variable overrides

`style` is typed to accept the component's own CSS custom properties directly — no `as React.CSSProperties` cast needed:

```tsx
<BrandLoader
  brand="VEGA"
  animation="scan"
  style={{ "--brand-loader-duration": "4s", "--brand-loader-color": "#d4af37" }}
/>
```

Notes:
- Respects `prefers-reduced-motion` automatically.
- Accessible by default (`role="status"`, screen-reader text, `aria-label`).
- No Tailwind or UI-library dependency — plain CSS + CSS variables
  (`--brand-loader-duration`, `--brand-loader-color`) for easy overrides.
```

```typescript
// File: src\components\ui\brand-loader\types.ts
import type React from "react";

export type BrandLoaderAnimation =
  // original set
  | "fade"
  | "pulse"
  | "scan"
  | "glitch"
  | "typing"
  | "reveal"
  | "shimmer"
  | "bounce"
  | "flicker"
  | "wave"
  | "blur"
  | "neon"
  // motion / entrance
  | "slide-up"
  | "slide-down"
  | "slide-left"
  | "slide-right"
  | "zoom-in"
  | "zoom-out"
  | "rotate-in"
  | "roll-in"
  | "drop"
  | "rise"
  // 3D / perspective (parent has perspective set)
  | "flip-x"
  | "flip-y"
  | "letter-spin"
  | "perspective-tilt"
  // playful / squash
  | "elastic"
  | "swing"
  | "rubber"
  | "jelly"
  | "heartbeat"
  | "wobble"
  | "shake-x"
  | "shake-y"
  | "tilt"
  | "squeeze"
  | "stretch"
  | "skew"
  | "skew-bounce"
  | "mirror"
  | "warp"
  // rotation / strobe
  | "spin-slow"
  | "spin-fast"
  | "flash"
  | "strobe"
  // sweep / reveal
  | "underline-sweep"
  | "gradient-shift"
  | "rainbow"
  | "peekaboo"
  | "curtain"
  | "iris"
  | "wipe-diagonal"
  // ambient / idle
  | "levitate"
  | "drift"
  | "sway"
  | "tracking-pulse"
  // texture / glitch family
  | "static-noise"
  | "chromatic"
  // per-letter sequenced
  | "typewriter"
  | "cascade"
  | "letter-fade"
  | "letter-pop"
  // directional bounce-in family
  | "bounce-in"
  | "bounce-in-up"
  | "bounce-in-down"
  | "bounce-in-left"
  | "bounce-in-right"
  // directional fade family
  | "fade-in-up"
  | "fade-in-down"
  | "fade-in-left"
  | "fade-in-right"
  | "fade-out-pulse"
  // directional flip family
  | "flip-in-x"
  | "flip-in-y"
  | "flip-out-x"
  | "flip-out-y"
  // directional zoom family
  | "zoom-in-up"
  | "zoom-in-down"
  | "zoom-in-left"
  | "zoom-in-right"
  // rotation family
  | "rotate-cw"
  | "rotate-ccw"
  | "rotate-in-corner"
  // light speed / jello / blink
  | "light-speed-in"
  | "light-speed-out"
  | "jello"
  | "blink"
  // liquid / organic
  | "liquid-wave"
  | "morph"
  | "blob"
  | "ripple"
  | "melt"
  | "drip"
  | "ooze"
  | "breathe"
  // retro / CRT / cyberpunk
  | "crt-flicker"
  | "vhs-glitch"
  | "scanlines"
  | "hologram"
  | "cyberpunk-glow"
  | "terminal-blink"
  | "pixelate"
  | "static-tv"
  | "tracking-error"
  | "neon-sign-flicker"
  // glass / material
  | "glass-shine"
  | "frosted"
  | "glossy-sheen"
  | "mica"
  | "aurora"
  | "prism"
  // paper / origami
  | "fold-in"
  | "unfold"
  | "paper-flip"
  | "crease"
  | "ribbon-wave"
  // nature-inspired
  | "flame-flicker"
  | "water-ripple"
  | "wind-sway"
  | "ember-glow"
  | "smoke-rise"
  | "cloud-drift"
  // celestial / orbit
  | "comet"
  | "shooting-star"
  | "orbit"
  | "pendulum"
  | "metronome"
  | "seesaw"
  // sequential mechanisms (letter-based where noted)
  | "accordion"
  | "zipper" // letter-based
  | "domino" // letter-based
  | "ripple-wave"
  | "pop-in"
  | "pop-out"
  | "snap-in"
  | "magnet-pulse"
  // spin / spiral
  | "vortex"
  | "spiral-in"
  | "spiral-out"
  | "tornado"
  | "earthquake"
  // glitch family expansion
  | "glitch-rgb"
  | "glitch-slice"
  | "datamosh"
  | "binary-flicker"
  | "matrix-rain" // letter-based
  | "code-scroll"
  | "dot-trail"
  // sweep / radar
  | "progress-sweep"
  | "radar-sweep"
  // mouse / pointer-interactive (see BrandLoader.tsx mouse handling)
  | "cursor-follow"
  | "magnetic-pull"
  | "tilt-3d"
  | "spotlight-cursor"
  | "cursor-glow"
  | "parallax-cursor"
  | "repel-letters" // letter-based
  | "attract-letters" // letter-based
  | "ripple-click"
  | "hover-scale"
  | "hover-glitch"
  | "hover-underline"
  // escape hatch
  | "custom";

export type BrandLoaderSize = "sm" | "md" | "lg" | "xl";

export type BrandLoaderSpeed = "slow" | "normal" | "fast";

/**
 * Advanced font descriptor. Lets you point at a specific weight or a
 * fully custom font file instead of relying on the default
 * `/.font/{name}.woff2` convention.
 */
export interface BrandLoaderFontConfig {
  /** Font name, matches the file under /.font/ (without extension). */
  name: string;
  /** Optional explicit weight. Resolves to /.font/{name}/{weight}.woff2 */
  weight?: number;
  /** Optional fully custom path, overrides the default convention entirely. */
  src?: string;
}

/**
 * React.CSSProperties plus the component's public CSS custom
 * properties, so overriding them via `style` is type-checked instead
 * of requiring an `as React.CSSProperties` cast.
 *
 * @example
 * <BrandLoader brand="VEGA" style={{ "--brand-loader-duration": "4s" }} />
 */
export type BrandLoaderCSSProperties = React.CSSProperties & {
  "--brand-loader-duration"?: string;
  "--brand-loader-color"?: string;
};

export interface BrandLoaderProps {
  /** Text to render, e.g. your brand/product name. */
  brand: string;
  /**
   * Font to use. Either a plain name ("Orbitron") which resolves to
   * /.font/Orbitron.woff2, or a BrandLoaderFontConfig for weights /
   * custom paths. Omit to fall back to the surrounding UI font.
   */
  font?: string | BrandLoaderFontConfig;
  /** Built-in animation preset. Use "custom" + className for your own. */
  animation?: BrandLoaderAnimation;
  size?: BrandLoaderSize;
  speed?: BrandLoaderSpeed;
  /** Render as a full-viewport centered overlay. */
  fullscreen?: boolean;
  /**
   * Render as a brand mark instead of a loading indicator.
   *
   * Drops `role="status"` / `aria-live="polite"` and the screen-reader-only
   * "Loading…" text, so the element exposes only the brand name. Required
   * when the loader sits inside a link — otherwise the link's accessible
   * name becomes "Loading <brand>" and screen readers re-announce it as a
   * live region on every navigation.
   */
  brandMark?: boolean;
  className?: string;
  style?: BrandLoaderCSSProperties;
  /** Accessible label read by screen readers. Defaults to `Loading {brand}`. */
  ariaLabel?: string;
}
```

```tsx
// File: src\components\ui\button.tsx
import { type ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "ghost";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "default", disabled, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center rounded-xl text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none h-10 px-4 py-2 cursor-pointer";
    const variants: Record<string, string> = {
      default:
        "neu-btn text-primary-foreground font-semibold shadow-none border-0",
      destructive:
        "bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl",
      outline:
        "neu-btn text-foreground border-0",
      ghost:
        "bg-transparent hover:bg-muted/50 text-muted-foreground hover:text-foreground rounded-xl",
    };

    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${className}`}
        disabled={disabled}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
```

```tsx
// File: src\components\ui\card.tsx
import { type HTMLAttributes, forwardRef } from "react";

const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = "", ...props }, ref) => (
    <div
      ref={ref}
      className={`neu-flat text-foreground ${className}`}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = "", ...props }, ref) => (
    <div ref={ref} className={`flex flex-col space-y-1.5 p-6 ${className}`} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className = "", ...props }, ref) => (
    <h3 ref={ref} className={`text-2xl font-semibold leading-none tracking-tight ${className}`} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className = "", ...props }, ref) => (
    <p ref={ref} className={`text-sm text-muted-foreground ${className}`} {...props} />
  )
);
CardDescription.displayName = "CardDescription";

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = "", ...props }, ref) => (
    <div ref={ref} className={`p-6 pt-0 ${className}`} {...props} />
  )
);
CardContent.displayName = "CardContent";

export { Card, CardHeader, CardTitle, CardDescription, CardContent };
```

```tsx
// File: src\components\ui\dialog.tsx
import { type HTMLAttributes, forwardRef, useEffect, useRef } from "react";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div ref={ref} className="relative z-50">{children}</div>
    </div>
  );
}

const DialogContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = "", ...props }, ref) => (
    <div
      ref={ref}
      className={`fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg neu-convex p-6 ${className}`}
      {...props}
    />
  )
);
DialogContent.displayName = "DialogContent";

const DialogHeader = ({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex flex-col space-y-1.5 text-center sm:text-left ${className}`} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className = "", ...props }, ref) => (
    <h2 ref={ref} className={`text-lg font-semibold leading-none tracking-tight ${className}`} {...props} />
  )
);
DialogTitle.displayName = "DialogTitle";

const DialogDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className = "", ...props }, ref) => (
    <p ref={ref} className={`text-sm text-muted-foreground ${className}`} {...props} />
  )
);
DialogDescription.displayName = "DialogDescription";

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription };
```

```tsx
// File: src\components\ui\input.tsx
import { type InputHTMLAttributes, forwardRef } from "react";

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`flex h-10 w-full rounded-xl neu-concave border-0 bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
```

```tsx
// File: src\components\ui\label.tsx
import { type LabelHTMLAttributes, forwardRef } from "react";

const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className = "", ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}
        {...props}
      />
    );
  }
);
Label.displayName = "Label";

export { Label };
```

```tsx
// File: src\components\ui\select.tsx
import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown } from "lucide-react";

export interface NeuSelectOption {
  value: string;
  label: string;
}

interface NeuSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: NeuSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function NeuSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className = "",
  disabled = false,
}: NeuSelectProps) {
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const displayText = selected ? selected.label : placeholder;
  const isPlaceholder = !selected;

  const close = useCallback(() => {
    setOpen(false);
    setHighlightIdx(-1);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        listRef.current && !listRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, close]);

  useEffect(() => {
    if (open && highlightIdx >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIdx] as HTMLElement | undefined;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [open, highlightIdx]);

  const toggle = () => {
    if (disabled) return;
    setOpen((prev) => !prev);
  };

  const selectOption = (val: string) => {
    onChange(val);
    close();
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        if (!open) {
          setOpen(true);
          const idx = options.findIndex((o) => o.value === value);
          setHighlightIdx(idx >= 0 ? idx : 0);
        }
        break;
      case "ArrowDown":
        e.preventDefault();
        if (!open) {
          setOpen(true);
          const idx = options.findIndex((o) => o.value === value);
          setHighlightIdx(idx >= 0 ? idx : 0);
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!open) {
          setOpen(true);
          const idx = options.findIndex((o) => o.value === value);
          setHighlightIdx(idx >= 0 ? idx : options.length - 1);
        }
        break;
    }
  };

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIdx((prev) => (prev < options.length - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIdx((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (highlightIdx >= 0 && highlightIdx < options.length) selectOption(options[highlightIdx]!.value);
        break;
      case "Home":
        e.preventDefault();
        setHighlightIdx(0);
        break;
      case "End":
        e.preventDefault();
        setHighlightIdx(options.length - 1);
        break;
    }
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={toggle}
        onKeyDown={handleTriggerKeyDown}
        className={`flex items-center justify-between gap-2 px-3 py-2 neu-concave rounded-xl bg-transparent text-sm text-foreground text-left min-w-[120px] focus:outline-none focus:ring-2 focus:ring-primary/50 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span className={`truncate ${isPlaceholder ? "text-muted-foreground" : ""}`}>
          {displayText}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          onKeyDown={handleListKeyDown}
          className="absolute top-full left-0 mt-1 w-full min-w-[120px] max-h-60 overflow-auto z-50 neu-flat rounded-xl p-1 focus:outline-none"
        >
          {options.map((opt, idx) => (
            <div
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onClick={() => selectOption(opt.value)}
              onMouseEnter={() => setHighlightIdx(idx)}
              className={`px-3 py-2 rounded-lg text-sm cursor-pointer transition-all select-none ${
                opt.value === value
                  ? "neu-pressed text-primary font-medium"
                  : idx === highlightIdx
                    ? "neu-btn"
                    : "text-foreground hover:bg-muted/30"
              }`}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

```tsx
// File: src\components\ui\skeleton.tsx
import { type HTMLAttributes, forwardRef } from "react";

const Skeleton = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = "", ...props }, ref) => (
    <div
      ref={ref}
      aria-hidden="true"
      className={`skeleton-shimmer ${className}`}
      {...props}
    />
  )
);
Skeleton.displayName = "Skeleton";

interface SkeletonTableRowsProps {
  rows?: number;
  cols?: number;
  colSpan?: number;
}

const SkeletonTableRows = forwardRef<
  HTMLTableSectionElement,
  SkeletonTableRowsProps & HTMLAttributes<HTMLTableSectionElement>
>(({ rows = 6, cols = 4, colSpan, className = "", ...props }, ref) => (
  <tbody
    ref={ref}
    aria-hidden="true"
    className={`${className}`}
    {...props}
  >
    {Array.from({ length: rows }).map((_, r) => (
      <tr key={r} className="border-b border-border/50 last:border-0">
        <td colSpan={colSpan ?? cols} className="px-4 py-3">
          <div className="flex items-center gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <div
                key={c}
                className="h-4 flex-1 rounded skeleton-shimmer"
                style={{ maxWidth: `${Math.min(85, 60 + c * 8)}%` }}
              />
            ))}
          </div>
        </td>
      </tr>
    ))}
  </tbody>
));
SkeletonTableRows.displayName = "SkeletonTableRows";

interface SkeletonListRowsProps {
  rows?: number;
}

const SkeletonListRows = forwardRef<
  HTMLDivElement,
  SkeletonListRowsProps & HTMLAttributes<HTMLDivElement>
>(({ rows = 8, className = "", ...props }, ref) => (
  <div ref={ref} aria-hidden="true" className={`divide-y divide-border/50 ${className}`} {...props}>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-start gap-3 p-4">
        <div className="h-10 w-10 rounded-xl skeleton-shimmer shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-3.5 w-1/3 rounded skeleton-shimmer" />
          <div className="h-3 w-2/3 rounded skeleton-shimmer" />
          <div className="h-3 w-1/4 rounded skeleton-shimmer" />
        </div>
        <div className="h-4 w-16 rounded-full skeleton-shimmer shrink-0 self-center" />
      </div>
    ))}
  </div>
));
SkeletonListRows.displayName = "SkeletonListRows";

const SkeletonDetail = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = "", ...props }, ref) => (
    <div ref={ref} aria-hidden="true" className={`flex flex-col gap-3 ${className}`} {...props}>
      <div className="shrink-0 neu-flat rounded-xl p-4 space-y-3">
        <div className="h-4 w-1/3 rounded skeleton-shimmer" />
        <div className="h-3 w-1/2 rounded skeleton-shimmer" />
        <div className="h-5 w-20 rounded skeleton-shimmer" />
      </div>
      <div className="shrink-0 neu-flat rounded-xl p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="h-8 rounded skeleton-shimmer" />
          <div className="h-8 rounded skeleton-shimmer" />
          <div className="h-8 rounded skeleton-shimmer" />
          <div className="h-8 rounded skeleton-shimmer" />
        </div>
      </div>
      <div className="neu-flat rounded-xl p-5 flex-1 min-h-0 space-y-2">
        <div className="h-3 w-full rounded skeleton-shimmer" />
        <div className="h-3 w-full rounded skeleton-shimmer" />
        <div className="h-3 w-5/6 rounded skeleton-shimmer" />
        <div className="h-3 w-4/6 rounded skeleton-shimmer" />
        <div className="h-3 w-full rounded skeleton-shimmer" />
      </div>
    </div>
  )
);
SkeletonDetail.displayName = "SkeletonDetail";

export { Skeleton, SkeletonTableRows, SkeletonListRows, SkeletonDetail };
```

```tsx
// File: src\components\ui\tabs.tsx
import { createContext, useContext, useState, type ReactNode } from "react";

interface TabsContextType {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextType>({
  value: "",
  onValueChange: () => {},
});

interface TabsProps {
  defaultValue: string;
  children: ReactNode;
  className?: string;
}

function Tabs({ defaultValue, children, className = "" }: TabsProps) {
  const [value, setValue] = useState(defaultValue);
  return (
    <TabsContext.Provider value={{ value, onValueChange: setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

function TabsList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`inline-flex h-10 items-center justify-center rounded-xl neu-concave p-1 text-muted-foreground ${className}`}
    >
      {children}
    </div>
  );
}

function TabsTrigger({
  value,
  children,
  className = "",
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const ctx = useContext(TabsContext);
  const isActive = ctx.value === value;
  return (
    <button
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
        isActive
          ? "neu-btn text-foreground font-semibold"
          : "text-muted-foreground hover:text-foreground"
      } ${className}`}
      onClick={() => ctx.onValueChange(value)}
    >
      {children}
    </button>
  );
}

function TabsContent({
  value,
  children,
  className = "",
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const ctx = useContext(TabsContext);
  if (ctx.value !== value) return null;
  return (
    <div
      className={`mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className}`}
    >
      {children}
    </div>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
```

```typescript
// File: src\config\site.ts
const PROD_WS_ORIGIN = "wss://vega-api.vijaykrsha.online";

// The OTP WebSocket cannot ride the Pages function the way /api/* does —
// public/_redirects rewrites /* to /index.html, so it is dialled directly
// against the API host. NOTE: api.vijaykrsha.online belongs to Propaura.
function resolveWsBaseUrl(): string {
  if (typeof window === "undefined") return PROD_WS_ORIGIN;
  const { protocol, host, hostname } = window.location;
  // *.pages.dev is included so preview deployments reach the real backend
  // (there is no preview API host).
  const isProd =
    hostname === "vijaykrsha.online" ||
    hostname === "www.vijaykrsha.online" ||
    hostname.endsWith(".pages.dev");
  if (isProd) return PROD_WS_ORIGIN;
  // dev: localhost, LAN IP, and ngrok all stay same-origin, so a single
  // build works for all of them.
  return `${protocol === "https:" ? "wss:" : "ws:"}//${host}`;
}

export const site = {
  name: "Vijay Kumar Sharma",
  tagline: "Legal Research, Drafting & Digital Legal Solutions",
  description:
    "Law graduate (LL.B.), legal researcher, and contract drafting professional with experience supporting individuals, businesses, and startups through practical legal documentation, research, and technology-assisted solutions. Based in India.",

  contact: {
    phone: "+91-9599130381",
    phoneDisplay: "+91-9599130381",
    whatsapp: "https://wa.me/919599130381",
    email: "vijaykrsha@hotmail.com",
    emailAlt: "contact@vijaykrsha.online",
    website: "https://vijaykrsha.online",
    location: "Faridabad, Haryana, India",
  },

  api: {
    wsBaseUrl: resolveWsBaseUrl(),
    contactPath: "/vks/api/contact",
  },

  nav: [
    { label: "Home", path: "/" },
    { label: "About", path: "/about" },
    { label: "Freelance", path: "/freelance" },
    { label: "Portfolio", path: "/portfolio" },
    { label: "Apps", path: "/apps" },
    { label: "Contact", path: "/contact" },
  ],

  // Hero proof cards — deliberately distinct from whyHireMe so the hero
  // does not repeat the same value propositions.
  heroProof: [
    {
      label: "LL.B.-Qualified Research",
      detail: "Case law, statutes & compliance work",
      icon: "scale",
    },
    {
      label: "Data-Driven Deliverables",
      detail: "Excel · Python · interactive dashboards",
      icon: "chart",
    },
    {
      label: "24-Hour Response",
      detail: "Monday–Saturday, IST business hours",
      icon: "clock",
    },
  ],

  whyHireMe: [
    {
      title: "NDA First",
      description:
        "Every engagement begins with a non-disclosure agreement. Your data, matters, and communications stay strictly confidential.",
      icon: "shield",
    },
    {
      title: "Professional Legal Practice",
      description:
        "Proven track record across legal research, contract management, and data analytics for clients in multiple industries.",
      icon: "calendar",
    },
    {
      title: "Interdisciplinary Approach",
      description:
        "Rare combination of legal knowledge and technical skill — bridging the gap between law and technology.",
      icon: "diamond",
    },
    {
      title: "Attention to Detail",
      description:
        "Meticulous attention to statutory references, contract clauses, and data accuracy. No shortcuts on quality.",
      icon: "magnifier",
    },
    {
      title: "Timely Delivery",
      description:
        "Efficient workflows and legal-tech integration mean faster delivery without compromising thoroughness.",
      icon: "bolt",
    },
  ],

  highlights: [
    {
      title: "Legal Research",
      description:
        "In-depth legal research across Indian statutes, case law, and regulatory frameworks.",
      icon: "scale",
    },
    {
      title: "Data Analysis",
      description:
        "Transforming raw data into actionable insights with Excel, Python, and visualization tools.",
      icon: "chart",
    },
    {
      title: "Legal-Tech Solutions",
      description:
        "Bridging law and technology — workflow automation, document management, and custom tools.",
      icon: "shield",
    },
  ],

  qualifications: [
    {
      degree: "Post Graduate in Political Science",
      institution: "Indira Gandhi National Open University (IGNOU)",
    },
    {
      degree: "Bachelor of Laws (LLB)",
      institution: "Bundelkhand University",
    },
  ],

  expertise: [
    "Constitutional & Administrative Law",
    "Contract Drafting & Review",
    "Legal Research & Analysis",
    "Data Analysis & Dashboards",
    "Legal-Tech Integration",
    "Regulatory Compliance",
  ],

  services: [
    {
      title: "Legal Research",
      description:
        "Comprehensive legal research including case analysis, statutory interpretation, and regulatory compliance reviews.",
      icon: "scale",
      idealFor: [
        "Law firms needing case research support",
        "Startups navigating regulatory requirements",
        "Businesses entering new markets",
      ],
      deliverables: [
        "Research memorandum with cited authorities",
        "Case law analysis and summary",
        "Regulatory compliance report",
      ],
      turnaround: "3-5 business days",
      pricingModel: "Per project",
    },
    {
      title: "Contract Drafting",
      description:
        "Professional contract drafting, review, and negotiation support for businesses and individuals.",
      icon: "document",
      idealFor: [
        "Businesses needing standard contract templates",
        "Startups drafting founding agreements",
        "Parties negotiating complex deals",
      ],
      deliverables: [
        "Custom-drafted agreements",
        "Contract review with redline markup",
        "Negotiation strategy brief",
      ],
      turnaround: "2-4 business days",
      pricingModel: "Per document",
    },
    {
      title: "Data & Excel Dashboards",
      description:
        "Interactive dashboards, data visualization, and spreadsheet automation for smarter decisions.",
      icon: "chart",
      idealFor: [
        "Firms tracking compliance across regions",
        "Businesses needing financial dashboards",
        "Teams automating repetitive reporting",
      ],
      deliverables: [
        "Interactive Excel/Google Sheets dashboard",
        "Automated reporting templates",
        "Data visualization and charts",
      ],
      turnaround: "3-7 business days",
      pricingModel: "Per project",
    },
    {
      title: "Legal-Tech Integration",
      description:
        "Bridging law and technology — workflow automation, document management, and tech solutions for legal practice.",
      icon: "gear",
      idealFor: [
        "Legal departments digitizing workflows",
        "Firms automating document generation",
        "Practices needing custom tools",
      ],
      deliverables: [
        "Workflow automation setup",
        "Custom tool or script development",
        "Integration documentation and training",
      ],
      turnaround: "1-2 weeks",
      pricingModel: "Hourly / Retainer",
    },
  ],

  principles: [
    {
      title: "NDA by Default",
      description:
        "Every engagement begins with a non-disclosure agreement. Your data and matters stay confidential.",
    },
    {
      title: "Data Integrity",
      description:
        "Accurate, verifiable, and well-sourced work. No shortcuts on quality or credibility.",
    },
    {
      title: "Professional Legal Practice",
      description:
        "Proven track record across legal research, contract management, and data analytics projects.",
    },
    {
      title: "Transparent Communication",
      description:
        "Regular updates, clear timelines, and no surprises. You always know the status of your project.",
    },
  ],

  workingStyle: {
    availability: "Monday - Saturday, 9 AM - 5 PM IST",
    responseTime: "Within 24 hours",
    communication: "Email, Phone",
    timezone: "IST (UTC +5:30)",
  },

  beforeContacting: [
    "Have a clear description of your project or problem ready",
    "Know your timeline and any hard deadlines",
    "Budget range or ballpark figure helps us scope faster",
    "If it involves legal work, having relevant documents on hand speeds up the process",
    "For data projects, knowing your data source and format saves time",
  ],

  projects: [
    {
      title: "Multi-State Compliance Dashboard",
      category: "Legal",
      problem:
        "A mid-size firm struggled to track compliance obligations across 8 Indian states, leading to missed filings and penalties.",
      solution:
        "Built a centralized compliance tracking dashboard with automated alerts, state-specific rule engines, and exportable reports.",
      outcome:
        "Reduced missed filings by 90% and cut compliance review time from 3 days to 2 hours per cycle.",
      tags: ["Compliance", "Excel", "Legal Research"],
    },
    {
      title: "Contract Analytics Platform",
      category: "Tech",
      problem:
        "A legal department spent excessive time manually reviewing contracts for risk clauses and non-standard terms.",
      solution:
        "Developed an automated contract review tool using NLP to flag risk clauses, extract key terms, and score contracts.",
      outcome:
        "Reduced clause analysis time by 60% and improved risk detection accuracy to 95%.",
      tags: ["NLP", "Python", "Legal-Tech"],
    },
    {
      title: "Regulatory Impact Assessment",
      category: "Legal",
      problem:
        "A fintech client entering the Indian market needed to understand the regulatory landscape and compliance requirements.",
      solution:
        "Conducted comprehensive regulatory impact assessment covering RBI guidelines, IT Act, and state-level regulations.",
      outcome:
        "Client launched operations within 3 months with full regulatory compliance, avoiding potential penalties.",
      tags: ["Fintech", "Regulation", "Research"],
    },
    {
      title: "Legal Operations Automation",
      category: "Tech",
      problem:
        "A legal department was spending 20+ hours weekly on manual document generation and case tracking.",
      solution:
        "Automated document generation templates, case tracking workflows, and status reporting dashboards.",
      outcome:
        "Saved 20+ hours weekly, reduced document errors by 85%, and improved case turnaround time by 40%.",
      tags: ["Automation", "Workflow", "Productivity"],
    },
  ],

  apps: [
    {
      title: "Vega Share",
      category: "Android",
      icon: "share",
      status: "live" as const,
      description:
        "WiFi-based file transfer app for Android. Share files from your phone to any device on the same network using just a browser — no app installation needed on the receiving end.",
      features: [
        "Transfer files over same WiFi network via any browser",
        "Preview documents, images, video, and audio directly in the browser",
        "Upload files from any device back to your phone via browser URL",
        "No app installation required on the receiving device",
        "HTTPS secure transfers with self-signed certificates",
        "mDNS auto-discovery on local network",
      ],
      techStack: ["Android", "Kotlin", "NanoHTTPD", "BouncyCastle", "React", "Vite"],
      logo: "/vega-share-icon.png",
      screenshots: ["/vega-share-screenshot.png", "/vega-share-feature.png"],
      link: { label: "Download APK", url: "https://github.com/Kvijay199428/VEGA-SHARE/releases/download/v1.0.1/vega-share-1.0.1.apk" },
      tags: ["Android", "WiFi", "File Transfer", "Browser", "HTTPS"],
    },
    {
      title: "Rent App Management",
      category: "Web",
      icon: "building",
      status: "live" as const,
      description:
        "Web app for landlords to manage tenant-landlord rent transactions. Track monthly rent status, view lifetime earnings, and get a clear financial overview at a glance.",
      features: [
        "Track monthly rent payments — paid, unpaid, or partial",
        "Lifetime earnings dashboard for landlords",
        "Tenant management with full payment history",
        "Clean dashboard for quick financial overview",
      ],
      techStack: ["React", "Node.js", "MongoDB", "Tailwind CSS"],
      link: { label: "Visit App", url: "https://rent.vijaykrsha.online" },
      tags: ["Web App", "Rent", "Tenant Management", "Dashboard"],
    },
  ],
} as const;
```

```tsx
// File: src\context\ThemeContext.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
```

```tsx
// File: src\contexts\AuthContext.tsx
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { ROUTES } from "@/lib/routes";
import { apiFetch, setAccessToken } from "@/lib/adminApi";
import { fetchPublicKey, encryptPassword } from "@/lib/crypto";

interface LoginResult {
  status: "second_factor_required";
  challenge_id: string;
  methods: string[];
  ws_ticket: string;
  remember_me: boolean;
}

export interface RateLimitDetail {
  detail: string;
  type: "rate_limited" | "account_locked" | "resend_cooldown" | "verify_cooldown" | "ip_blocked";
  retry_after: number;
}

export class RateLimitError extends Error {
  retryAfter: number;
  limitType: RateLimitDetail["type"];
  constructor(msg: string, retryAfter: number, limitType: RateLimitDetail["type"]) {
    super(msg);
    this.retryAfter = retryAfter;
    this.limitType = limitType;
  }
}

export interface AdminIdentity {
  id: string;
  username: string;
  display_name?: string;
  role: string;
  role_level?: number | null;
}

interface AuthContextType {
  isAuthenticated: boolean;
  admin: AdminIdentity | null;
  sessionExpiresAt: string | null;
  refreshAuth: () => Promise<boolean>;
  login: (
    username: string,
    password: string,
    rememberMe?: boolean,
    turnstileToken?: string
  ) => Promise<LoginResult>;
  exchangeForTokens: (
    exchangeCode: string
  ) => Promise<{ access_token: string; admin: AdminIdentity }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function friendlyAuthError(msg: string): string {
  if (msg === "invalid_credentials") {
    return "Incorrect username or password. Please enter the correct username and password.";
  }
  if (msg === "account_disabled") {
    return "This account has been disabled. Please contact an administrator.";
  }
  if (msg === "encryption_key_expired") {
    return "The encryption key expired. Please try again.";
  }
  return msg;
}

function parseAuthError(response: Response, data: unknown, fallback: string): Error {
  const msg = friendlyAuthError(
    (data as { detail?: unknown })?.detail &&
      typeof (data as { detail?: unknown }).detail === "string"
      ? ((data as { detail: string }).detail as string)
      : fallback
  );
  if (response.status === 429 || response.status === 423) {
    const rd = (data as { retry_after?: number; type?: RateLimitDetail["type"] }) ?? {};
    if (rd.retry_after) {
      return new RateLimitError(msg, rd.retry_after, rd.type || "rate_limited");
    }
  }
  return new Error(msg);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | null>(null);

  const refreshAuth = useCallback(async (): Promise<boolean> => {
    try {
      const response = await apiFetch(ROUTES.ADMINAPIAUTHSESSION, {
        credentials: "include",
        redirectOn401: false,
      });
      if (!response.ok) throw new Error("not authenticated");
      const data = await response.json();
      setIsAuthenticated(true);
      setAdmin({
        id: data.id,
        username: data.username,
        display_name: data.display_name,
        role: data.role,
        role_level: data.role_level,
      });
      setSessionExpiresAt(data.session?.expires_at ?? null);
      return true;
    } catch {
      setIsAuthenticated(false);
      setAdmin(null);
      setSessionExpiresAt(null);
      return false;
    }
  }, []);

  const login = useCallback(
    async (
      username: string,
      password: string,
      rememberMe = false,
      turnstileToken?: string
    ): Promise<LoginResult> => {
      const { key_id, public_key } = await fetchPublicKey();
      const password_cipher = await encryptPassword(password, public_key);

      const response = await apiFetch(ROUTES.ADMINAPIAUTHLOGIN, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password_cipher,
          key_id,
          remember_me: rememberMe,
          turnstile_token: turnstileToken ?? null,
        }),
        redirectOn401: false,
      });

      const data = await response.json().catch(() => ({ detail: "Login failed" }));

      if (!response.ok) {
        throw parseAuthError(response, data, "Login failed");
      }

      return data as LoginResult;
    },
    []
  );

  const exchangeForTokens = useCallback(
    async (exchangeCode: string) => {
      const response = await apiFetch(ROUTES.ADMINAPIAUTHEXCHANGE, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exchange_code: exchangeCode }),
        redirectOn401: false,
      });

      const data = await response.json().catch(() => ({ detail: "Token exchange failed" }));

      if (!response.ok) {
        throw parseAuthError(response, data, "Token exchange failed");
      }

      setAccessToken(data.access_token);
      setIsAuthenticated(true);
      setAdmin(data.admin);
      return { access_token: data.access_token, admin: data.admin };
    },
    []
  );

  const logout = useCallback(async () => {
    await apiFetch(ROUTES.ADMINAPIAUTHLOGOUT, {
      method: "POST",
      credentials: "include",
    });
    setAccessToken(null);
    setIsAuthenticated(false);
    setAdmin(null);
    setSessionExpiresAt(null);
    window.location.replace("/vega/admin/login");
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        admin,
        sessionExpiresAt,
        refreshAuth,
        login,
        exchangeForTokens,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
```

```typescript
// File: src\hooks\useSpriteAnimation.ts
import { useEffect, useRef, useCallback } from "react";

interface SpriteConfig {
  src: string;
  fps: number;
  frames: number;
  frameWidth: number;
  frameHeight: number;
  opacity: number;
  blendMode: GlobalCompositeOperation;
  loop: boolean;
}

async function loadGzippedImage(src: string): Promise<HTMLImageElement> {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Failed to fetch sprite: ${res.status}`);

  const buffer = await res.arrayBuffer();

  if (typeof DecompressionStream === "undefined") {
    throw new Error("DecompressionStream not supported");
  }

  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  writer.write(new Uint8Array(buffer));
  writer.close();

  const decompressed = await new Response(ds.readable).arrayBuffer();
  const blob = new Blob([decompressed], { type: "image/png" });
  const url = URL.createObjectURL(blob);

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load decompressed sprite"));
    };
    img.src = url;
  });
}

export default function useSpriteAnimation(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  config: SpriteConfig
) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef<number>(0);
  const loadedRef = useRef(false);

  const prefersReducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : true;

  const drawFrame = useCallback(
    (ctx: CanvasRenderingContext2D, image: HTMLImageElement, frame: number) => {
      const { frameWidth, frameHeight, opacity, blendMode } = config;

      ctx.clearRect(0, 0, frameWidth, frameHeight);
      ctx.globalAlpha = opacity;
      ctx.globalCompositeOperation = blendMode;

      ctx.drawImage(
        image,
        frame * frameWidth,
        0,
        frameWidth,
        frameHeight,
        0,
        0,
        frameWidth,
        frameHeight
      );
    },
    [config]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { frameWidth, frameHeight, frames, fps, loop } = config;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = frameWidth * dpr;
    canvas.height = frameHeight * dpr;
    ctx.scale(dpr, dpr);

    let cancelled = false;

    const animate = (timestamp: number) => {
      if (cancelled) return;

      if (!loadedRef.current || !imageRef.current) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      const interval = 1000 / fps;

      if (timestamp - lastTimeRef.current >= interval) {
        lastTimeRef.current = timestamp;
        drawFrame(ctx, imageRef.current, frameRef.current);

        if (frameRef.current < frames - 1) {
          frameRef.current++;
        } else if (loop) {
          frameRef.current = 0;
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    const loadAndStart = async () => {
      try {
        imageRef.current = await loadGzippedImage(config.src);
        loadedRef.current = true;

        if (prefersReducedMotion) {
          drawFrame(ctx, imageRef.current, 0);
          return;
        }

        rafRef.current = requestAnimationFrame(animate);
      } catch (e) {
        console.warn("Sprite animation failed:", e);
        canvas.style.display = "none";
      }
    };

    loadAndStart();

    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafRef.current);
      } else if (loadedRef.current && !prefersReducedMotion) {
        lastTimeRef.current = 0;
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [canvasRef, config, drawFrame, prefersReducedMotion]);
}
```

```css
/* File: src\index.css */
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* ── Public site palette (unchanged) ── */
  --color-cream-50: #fdfbf7;
  --color-cream-100: #f7f3eb;
  --color-cream-200: #ede7d9;
  --color-cream-300: #ddd4c0;

  --color-night-900: #0f1219;
  --color-night-800: #161b26;
  --color-night-700: #1e2536;
  --color-night-600: #2a3348;

  --color-glow-500: #a78bfa;
  --color-glow-400: #c4b5fd;
  --color-glow-600: #7c5cf0;

  --color-sage-500: #7a9168;
  --color-sage-400: #96ad85;

  --color-mist-500: #6b8299;
  --color-mist-400: #8ba3b8;

  /* ── Neumorphism admin palette ── */
  --color-background: #E8E8E8;
  --color-foreground: #2D3436;
  --color-card: #E8E8E8;
  --color-card-foreground: #2D3436;
  --color-primary: #7C3AED;
  --color-primary-foreground: #FFFFFF;
  --color-secondary: #8B5CF6;
  --color-secondary-foreground: #FFFFFF;
  --color-muted: #F5E0E8;
  --color-muted-foreground: #636E72;
  --color-accent: #059669;
  --color-accent-foreground: #FFFFFF;
  --color-destructive: #DC2626;
  --color-destructive-foreground: #FFFFFF;
  --color-border: #D0D0D0;
  --color-input: #E8E8E8;
  --color-ring: #7C3AED;

  /* ── Neumorphism shadow sources ── */
  --color-neu-light: #FFFFFF;
  --color-neu-dark: #A3A3A3;

  /* ── Dark mode neumorphism ── */
  --color-dark-background: #2D2D2D;
  --color-dark-foreground: #E0E0E0;
  --color-dark-card: #2D2D2D;
  --color-dark-card-foreground: #E0E0E0;
  --color-dark-muted: #3A3A3A;
  --color-dark-muted-foreground: #A0A0A0;
  --color-dark-border: #404040;
  --color-dark-input: #2D2D2D;
  --color-dark-neu-light: #3A3A3A;
  --color-dark-neu-dark: #202020;
}

html {
  scroll-behavior: smooth;
}

body {
  @apply bg-cream-50 text-night-800 dark:bg-night-900 dark:text-cream-100 transition-colors duration-300;
}

/* =========================================================
   ADMIN CONSOLE THEME
   Scopes admin colors separately from the public site.
   ========================================================= */

.admin-theme {
  --admin-background: #e8e8e8;
  --admin-foreground: #2D3436;
  --admin-card: #e8e8e8;
  --admin-card-foreground: #2D3436;
  --admin-muted: #F5E0E8;
  --admin-muted-foreground: #636E72;
  --admin-border: #D0D0D0;
  --admin-input: #e8e8e8;

  color: var(--admin-foreground);
  background: var(--admin-background);
}

.dark .admin-theme {
  --admin-background: #2D2D2D;
  --admin-foreground: #f1f5f9;
  --admin-card: #2D2D2D;
  --admin-card-foreground: #f1f5f9;
  --admin-muted: #3A3A3A;
  --admin-muted-foreground: #cbd5e1;
  --admin-border: #484848;
  --admin-input: #2D2D2D;

  color: var(--admin-foreground);
  background: var(--admin-background);
}

/* Map admin-theme overrides onto Tailwind semantic tokens */
.admin-theme {
  --color-background: #e8e8e8;
  --color-foreground: #2D3436;
  --color-card: #e8e8e8;
  --color-card-foreground: #2D3436;
  --color-muted: #F5E0E8;
  --color-muted-foreground: #636E72;
  --color-border: #D0D0D0;
  --color-input: #e8e8e8;
  --color-neu-light: #FFFFFF;
  --color-neu-dark: #A3A3A3;
}

.dark .admin-theme {
  --color-background: #2D2D2D;
  --color-foreground: #f1f5f9;
  --color-card: #2D2D2D;
  --color-card-foreground: #f1f5f9;
  --color-muted: #3A3A3A;
  --color-muted-foreground: #cbd5e1;
  --color-border: #484848;
  --color-input: #2D2D2D;
  --color-neu-light: #3A3A3A;
  --color-neu-dark: #202020;
}

/* Explicit text visibility inside admin scope */
.admin-theme .text-foreground {
  color: var(--color-foreground) !important;
}
.admin-theme .text-card-foreground {
  color: var(--color-card-foreground) !important;
}
.admin-theme .text-muted-foreground {
  color: var(--color-muted-foreground) !important;
}

/* Inputs / selects / textareas inside admin */
.admin-theme input,
.admin-theme textarea,
.admin-theme select {
  color: var(--color-foreground);
}
.admin-theme input::placeholder,
.admin-theme textarea::placeholder {
  color: var(--color-muted-foreground);
  opacity: 0.9;
}
.admin-theme select option {
  color: #2D3436;
  background: #ffffff;
}
.dark .admin-theme select option {
  color: #f1f5f9;
  background: #2D2D2D;
}

/* Disabled controls */
.admin-theme button:disabled,
.admin-theme input:disabled,
.admin-theme select:disabled,
.admin-theme textarea:disabled {
  opacity: 0.55;
}

/* ── Neumorphism Utilities ─────────────────────── */

.neu-flat {
  background: var(--color-background);
  color: var(--color-foreground);
  border-radius: 14px;
  box-shadow:
    -5px -5px 15px var(--color-neu-light),
    5px 5px 15px var(--color-neu-dark);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.dark .neu-flat {
  background: var(--color-dark-background);
  box-shadow:
    -5px -5px 15px var(--color-dark-neu-light),
    5px 5px 15px var(--color-dark-neu-dark);
}

.neu-convex {
  background: linear-gradient(145deg, #f0f0f0, #d4d4d4);
  border-radius: 14px;
  box-shadow:
    -5px -5px 15px var(--color-neu-light),
    5px 5px 15px var(--color-neu-dark);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.dark .neu-convex {
  background: linear-gradient(145deg, #333, #272727);
  box-shadow:
    -5px -5px 15px var(--color-dark-neu-light),
    5px 5px 15px var(--color-dark-neu-dark);
}

.neu-concave {
  background: linear-gradient(145deg, #d4d4d4, #f0f0f0);
  border-radius: 14px;
  box-shadow:
    inset -3px -3px 7px var(--color-neu-light),
    inset 3px 3px 7px var(--color-neu-dark);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.dark .neu-concave {
  background: linear-gradient(145deg, #272727, #333);
  box-shadow:
    inset -3px -3px 7px var(--color-dark-neu-light),
    inset 3px 3px 7px var(--color-dark-neu-dark);
}

.neu-pressed {
  background: var(--color-background);
  border-radius: 14px;
  box-shadow:
    inset -3px -3px 7px var(--color-neu-light),
    inset 3px 3px 7px var(--color-neu-dark);
  transition: box-shadow 0.15s ease;
}
.dark .neu-pressed {
  background: var(--color-dark-background);
  box-shadow:
    inset -3px -3px 7px var(--color-dark-neu-light),
    inset 3px 3px 7px var(--color-dark-neu-dark);
}

.neu-btn {
  background: linear-gradient(145deg, #f0f0f0, #d4d4d4);
  border-radius: 12px;
  box-shadow:
    -4px -4px 10px var(--color-neu-light),
    4px 4px 10px var(--color-neu-dark);
  transition: all 0.15s ease;
  cursor: pointer;
  user-select: none;
}
.neu-btn:hover {
  box-shadow:
    -6px -6px 14px var(--color-neu-light),
    6px 6px 14px var(--color-neu-dark);
}
.neu-btn:active {
  background: linear-gradient(145deg, #d4d4d4, #f0f0f0);
  box-shadow:
    inset -3px -3px 7px var(--color-neu-light),
    inset 3px 3px 7px var(--color-neu-dark);
}
.dark .neu-btn {
  background: linear-gradient(145deg, #333, #272727);
  box-shadow:
    -4px -4px 10px var(--color-dark-neu-light),
    4px 4px 10px var(--color-dark-neu-dark);
}
.dark .neu-btn:hover {
  box-shadow:
    -6px -6px 14px var(--color-dark-neu-light),
    6px 6px 14px var(--color-dark-neu-dark);
}
.dark .neu-btn:active {
  background: linear-gradient(145deg, #272727, #333);
  box-shadow:
    inset -3px -3px 7px var(--color-dark-neu-light),
    inset 3px 3px 7px var(--color-dark-neu-dark);
}

/* ── Active Nav Indicator ──────────────────────────── */

.nav-active {
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.12), rgba(124, 58, 237, 0.06));
  color: var(--color-primary);
  font-weight: 600;
}
.dark .nav-active {
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.18), rgba(124, 58, 237, 0.08));
}

/* ── Brand Logo (BrandLoader / typewriter) ──────────────── */

/* The vendored `animations.css` hardcodes a stagger divisor of 14, which
   assumes a brand of ~15 characters or fewer. Our brand is 17 characters,
   so the last letter's delay (16/14 ≈ 1.14 cycles) overflows the animation
   cycle and the loop drifts and desyncs on every repeat. A divisor of 20
   places the last letter's reveal at 0.8T — right about where the first
   letter starts wiping (0.85T) — so the sequence reads as one continuous
   typing loop. Higher specificity than the vendored rule, so this wins
   regardless of stylesheet order. */
.brand-logo.brand-loader--typewriter .brand-loader__letter {
  animation-delay: calc(var(--i, 0) * var(--brand-loader-duration) / 20);
}

/* ── Card & Button Interactions (Public) ──────────── */

.card-hover {
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.card-hover:hover {
  box-shadow: 0 8px 30px rgba(124, 92, 240, 0.12);
  transform: translateY(-2px);
}

.btn-primary {
  transition: all 0.2s ease-out;
}
.btn-primary:hover {
  box-shadow: 0 4px 20px rgba(124, 92, 240, 0.35);
  transform: translateY(-1px);
}
.btn-primary:active {
  transform: scale(0.98);
  box-shadow: 0 2px 8px rgba(124, 92, 240, 0.25);
}

.btn-outline {
  transition: all 0.2s ease-out;
}
.btn-outline:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}
.btn-outline:active {
  transform: scale(0.98);
}

.nav-link {
  transition: background-color 150ms ease-out, color 150ms ease-out, transform 100ms ease-out;
}
.nav-link:hover {
  transform: scale(1.05);
}
.nav-link:active {
  transform: scale(0.95);
}

/* ── Scroll Reveal ────────────────────────────────── */

.reveal {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}

/* ── Back to Top ──────────────────────────────────── */

.back-to-top {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease, transform 0.3s ease;
  transform: translateY(8px);
}
.back-to-top.show {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

/* ── Animated Logo ────────────────────────────────── */

.animated-logo {
  image-rendering: auto;
}

/* ── Status Badges ────────────────────────────────── */

.status-live {
  @apply bg-sage-500 text-white;
}
.status-beta {
  @apply bg-amber-500 text-white;
}
.status-coming-soon {
  @apply bg-cream-300 text-night-800 dark:bg-night-600 dark:text-cream-100;
}

/* ── Checklist ────────────────────────────────────── */

.checklist-item {
  @apply flex items-start gap-3 text-sm text-night-800/70 dark:text-cream-100/70;
}
.checklist-icon {
  @apply mt-0.5 h-4 w-4 text-glow-500 shrink-0;
}

/* ── Contact Form State Transitions ────────────── */

/* Both panels occupy the same grid cell so the card height is set by the
   tallest of the two — no layout jump when switching between form and the
   success state. */
.contact-form-stage {
  display: grid;
}

.contact-form-panel,
.contact-success-panel {
  grid-area: 1 / 1;
  transition:
    opacity 0.45s ease,
    transform 0.45s cubic-bezier(0.22, 1, 0.36, 1),
    visibility 0s linear 0.45s;
}

.contact-form-panel {
  opacity: 1;
  transform: translateY(0) scale(1);
  visibility: visible;
}

.contact-success-panel {
  opacity: 0;
  transform: translateY(18px) scale(0.985);
  visibility: hidden;
  pointer-events: none;
}

.contact-form-stage.is-sent .contact-form-panel {
  opacity: 0;
  transform: translateY(-18px) scale(0.985);
  visibility: hidden;
  pointer-events: none;
}

.contact-form-stage.is-sent .contact-success-panel {
  opacity: 1;
  transform: translateY(0) scale(1);
  visibility: visible;
  pointer-events: auto;
  transition-delay: 0.12s;
}

.contact-success-icon {
  animation: contact-success-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.contact-success-check {
  stroke-dasharray: 32;
  stroke-dashoffset: 32;
  animation: contact-success-draw 0.55s 0.18s ease-out forwards;
}

@keyframes contact-success-pop {
  0% {
    opacity: 0;
    transform: scale(0.55);
  }
  65% {
    opacity: 1;
    transform: scale(1.08);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes contact-success-draw {
  to {
    stroke-dashoffset: 0;
  }
}

.contact-submit-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 9999px;
  animation: contact-spin 0.7s linear infinite;
}

@keyframes contact-spin {
  to {
    transform: rotate(360deg);
  }
}

.contact-message {
  animation: contact-message-in 0.25s ease-out both;
}

@keyframes contact-message-in {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.contact-file-row {
  animation: contact-file-in 0.3s ease-out both;
}

@keyframes contact-file-in {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ── Footer ───────────────────────────────────────── */

.footer-heading {
  @apply text-xs font-semibold uppercase tracking-wider text-night-800/50 dark:text-cream-100/50 mb-4;
}

/* ── Admin Scrollbar (Neumorphism) ──────────────── */

.admin-theme ::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.admin-theme ::-webkit-scrollbar-track {
  background: var(--color-background);
  border-radius: 4px;
}
.admin-theme ::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 4px;
  border: 2px solid var(--color-background);
}
.admin-theme ::-webkit-scrollbar-thumb:hover {
  background: var(--color-muted-foreground);
}
.admin-theme * {
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) var(--color-background);
}

/* ── OTP Digit Box Animations ──────────────────── */

@keyframes otp-pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
}

@keyframes otp-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}

@keyframes otp-glow {
  0% { box-shadow: inset -3px -3px 7px var(--color-neu-light), inset 3px 3px 7px var(--color-neu-dark); }
  50% { box-shadow: inset -3px -3px 7px var(--color-neu-light), inset 3px 3px 7px var(--color-neu-dark), 0 0 12px rgba(5, 150, 105, 0.4); }
  100% { box-shadow: inset -3px -3px 7px var(--color-neu-light), inset 3px 3px 7px var(--color-neu-dark); }
}

.otp-digit-pop {
  animation: otp-pop 0.2s ease-out;
}

.otp-digit-shake {
  animation: otp-shake 0.4s ease-out;
}

.otp-digit-glow {
  animation: otp-glow 0.6s ease-out;
}

/* ── Login Step Transitions ────────────────────── */

.login-step-enter {
  opacity: 0;
  transform: translateX(20px);
}
.login-step-active {
  opacity: 1;
  transform: translateX(0);
  transition: opacity 0.25s ease-out, transform 0.25s ease-out;
}
.login-step-exit {
  opacity: 0;
  transform: translateX(-20px);
  transition: opacity 0.15s ease-in, transform 0.15s ease-in;
}

/* ── Accessibility ────────────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  /* BrandLoader's own reduced-motion block neutralises the animation on
     `.brand-loader__text`, but the per-letter spans carry the typewriter
     opacity keyframes directly — without this the logo would render blank. */
  .brand-logo .brand-loader__letter {
    opacity: 1 !important;
    animation: none !important;
  }
  .reveal {
    opacity: 1;
    transform: none;
    transition: none;
  }
  .card-hover:hover,
  .btn-primary:hover,
  .btn-outline:hover,
  .nav-link:hover,
  .neu-btn:hover {
    transform: none;
    box-shadow: inherit;
  }
  .btn-primary:active,
  .btn-outline:active,
  .nav-link:active,
  .neu-btn:active {
    transform: none;
  }
  .back-to-top {
    opacity: 1;
    pointer-events: auto;
    transform: none;
  }
  .animated-logo canvas {
    display: none;
  }
  .otp-digit-pop,
  .otp-digit-shake,
  .otp-digit-glow {
    animation: none;
  }
  .login-step-enter,
  .login-step-active,
  .login-step-exit {
    opacity: 1;
    transform: none;
    transition: none;
  }
  .contact-form-panel,
  .contact-success-panel {
    transition: none;
  }
  .contact-success-icon,
  .contact-success-check,
  .contact-submit-spinner,
  .contact-message,
  .contact-file-row {
    animation: none;
  }
  .contact-success-check {
    stroke-dashoffset: 0;
  }
}

/* ── Skeleton shimmer loading ── */

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    var(--color-background) 0%,
    var(--color-border) 50%,
    var(--color-background) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
}
```

```typescript
// File: src\lib\adminApi.ts
import { ROUTES } from "@/lib/routes";

export interface ApiFetchOptions extends RequestInit {
  /** Set false for auth-probing calls where 401 must not redirect. */
  redirectOn401?: boolean;
  /** Set true to skip the automatic token-refresh-and-retry on 401. */
  skipAutoRefresh?: boolean;
}

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

function readCsrfToken(): string | null {
  const value = /(?:^|;\s*)vks_csrf=([^;]*)/.exec(document.cookie)?.[1];
  return value ? decodeURIComponent(value) : null;
}

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function buildHeaders(init: RequestInit): Headers {
  const headers = new Headers(init.headers);
  const method = (init.method ?? "GET").toUpperCase();
  if (!headers.has("Content-Type")) {
    if (init.body && method !== "GET") {
      headers.set("Content-Type", "application/json");
    }
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  // CSRF double-submit is retained as defense-in-depth: the backend still
  // requires X-CSRF-Token to match the vks_csrf cookie for unsafe methods,
  // even when a Bearer token is present.
  if (UNSAFE_METHODS.has(method)) {
    const token = readCsrfToken();
    if (token) headers.set("X-CSRF-Token", token);
  }
  return headers;
}

async function doFetch(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    credentials: "include",
    headers: buildHeaders(init),
  });
}

async function refreshAccessToken(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const res = await fetch(ROUTES.ADMINAPIAUTHREFRESH, {
        method: "POST",
        credentials: "include", // sends the httpOnly refresh_token cookie
      });
      if (!res.ok) {
        accessToken = null;
        return false;
      }
      const data = await res.json();
      accessToken = data.access_token;
      return true;
    } catch {
      accessToken = null;
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/**
 * Single API client for every admin request. Attaches the in-memory access
 * token as a Bearer header, and on 401 automatically attempts a silent
 * refresh using the httpOnly refresh_token cookie, then retries once.
 */
export async function apiFetch(
  url: string,
  options: ApiFetchOptions = {}
): Promise<Response> {
  const { redirectOn401 = true, skipAutoRefresh = false, ...init } = options;

  let response = await doFetch(url, init);

  if (
    !skipAutoRefresh &&
    response.status === 401 &&
    url !== ROUTES.ADMINAPIAUTHLOGIN &&
    url !== ROUTES.ADMINAPIAUTHREFRESH
  ) {
    const ok = await refreshAccessToken();
    if (ok) {
      response = await doFetch(url, init);
    }
  }

  if (response.status === 401 && redirectOn401) {
    window.location.assign("/vega/admin/login");
    throw new Error("SESSION_EXPIRED");
  }

  return response;
}
```

```typescript
// File: src\lib\apiError.ts
interface FastAPIValidationDetail {
  type: string;
  loc: (string | number)[];
  msg: string;
  input?: unknown;
}

export function getApiErrorMessage(data: unknown, fallback = "Something went wrong"): string {
  if (!data || typeof data !== "object") return fallback;

  const detail = (data as Record<string, unknown>).detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as FastAPIValidationDetail;
    if (first && typeof first === "object" && typeof first.msg === "string") {
      const field = first.loc?.filter((s) => typeof s === "string" && s !== "body").join(" ");
      const msg = first.msg.charAt(0).toUpperCase() + first.msg.slice(1);
      return field ? `${field}: ${msg}` : msg;
    }
  }

  if (typeof detail === "object" && detail !== null) {
    const d = detail as Record<string, unknown>;
    if (typeof d.message === "string") return d.message;
    if (typeof d.error === "string") return d.error;
  }

  return fallback;
}
```

```typescript
// File: src\lib\crypto.ts
import { ROUTES } from "@/lib/routes";
import { apiFetch } from "@/lib/adminApi";

export interface PublicKeyResponse {
  key_id: string;
  public_key: string;
}

export async function fetchPublicKey(): Promise<PublicKeyResponse> {
  const res = await apiFetch(ROUTES.ADMINAPIAUTHPUBLICKEY, {
    credentials: "include",
    redirectOn401: false,
  });
  if (!res.ok) throw new Error("Could not load encryption key");
  const data = await res.json().catch(() => null);
  // Tolerate a camelCase shape ({keyId, publicKey}) but require the
  // contract fields; a missing public_key used to crash as
  // "Cannot read properties of undefined (reading 'replace')".
  const key_id = data?.key_id ?? data?.keyId;
  const public_key = data?.public_key ?? data?.publicKey;
  if (
    typeof key_id !== "string" ||
    typeof public_key !== "string" ||
    !public_key.includes("-----BEGIN PUBLIC KEY-----")
  ) {
    throw new Error("Invalid public encryption key response");
  }
  return { key_id, public_key };
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  if (typeof pem !== "string" || pem.trim() === "") {
    throw new Error("Public encryption key is missing");
  }
  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, "")
    .replace(/-----END PUBLIC KEY-----/, "")
    .replace(/\s+/g, "");
  if (!b64) {
    throw new Error("Public encryption key is empty");
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function assertWebCryptoAvailable(): void {
  if (
    typeof window === "undefined" ||
    !window.isSecureContext ||
    !window.crypto?.subtle
  ) {
    throw new Error(
      "Secure browser context required for login encryption. Please open the site using HTTPS."
    );
  }
}

export async function encryptPassword(
  password: string,
  publicKeyPem: string
): Promise<string> {
  assertWebCryptoAvailable();

  const keyData = pemToArrayBuffer(publicKeyPem);
  const key = await crypto.subtle.importKey(
    "spki",
    keyData,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );
  const ciphertext = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    key,
    new TextEncoder().encode(password)
  );
  const bytes = new Uint8Array(ciphertext);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary);
}
```

```typescript
// File: src\lib\passwordValidation.ts
export interface PasswordRule {
  label: string;
  test: (pw: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { label: "At least 12 characters", test: (pw) => pw.length >= 12 },
  { label: "Uppercase letter", test: (pw) => /[A-Z]/.test(pw) },
  { label: "Lowercase letter", test: (pw) => /[a-z]/.test(pw) },
  { label: "Number", test: (pw) => /[0-9]/.test(pw) },
  { label: "Special character (!@#$...)", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
  { label: "No whitespace at start/end", test: (pw) => pw === pw.trim() },
];

export function getPasswordErrors(pw: string, username?: string): string[] {
  const errors: string[] = [];
  for (const rule of PASSWORD_RULES) {
    if (!rule.test(pw)) errors.push(rule.label);
  }
  if (username && pw.toLowerCase() === username.toLowerCase()) {
    errors.push("Cannot be the same as username");
  }
  return errors;
}

export function isPasswordValid(pw: string, username?: string): boolean {
  return getPasswordErrors(pw, username).length === 0;
}
```

```typescript
// File: src\lib\routes.ts
const API = "/api";

export const ROUTES = {
  CONTACT: `${API}/vks/api/contact`,

  ADMINAPIAUTHLOGIN: `${API}/admin/api/auth/login`,
  ADMINAPIAUTHLOGINTOTP: `${API}/admin/api/auth/login-totp`,
  ADMINAPIAUTHLOGINOTPSEND: `${API}/admin/api/auth/login-otp-send`,
  ADMINAPIAUTHLOGINOTPVERIFY: `${API}/admin/api/auth/login-otp-verify`,
  ADMINAPIAUTHLOGOUT: `${API}/admin/api/auth/logout`,
  ADMINAPIAUTHSESSION: `${API}/admin/api/auth/session`,
  ADMINAPIAUTHREFRESH: `${API}/admin/api/auth/refresh`,
  ADMINAPIAUTHEXCHANGE: `${API}/admin/api/auth/exchange`,
  ADMINAPIAUTHPUBLICKEY: `${API}/admin/api/auth/public-key`,
  ADMINAPISETUPREQUIRED: `${API}/admin/api/auth/setup-required`,
  ADMINAPISETUPCREATE: `${API}/admin/api/auth/setup-create`,
  ADMINAPIPASSWORDFORGOTVERIFY: `${API}/admin/api/auth/password/forgot-verify`,
  ADMINAPIPASSWORDFORGOTRESET: `${API}/admin/api/auth/password/forgot-reset`,

  ADMINAPISTATS: `${API}/admin/api/stats`,
  ADMINAPIMESSAGES: `${API}/admin/api/messages`,
  ADMINAPISETTINGS: `${API}/admin/api/settings`,
  ADMINAPIAUDITLOGS: `${API}/admin/api/audit-logs`,
  ADMINAPICHANGEPASSWORD: `${API}/admin/api/settings/change-password`,

  // User management
  ADMINAPIUSERS: `${API}/admin/api/users`,
  ADMINAPIUSERSCREATE: `${API}/admin/api/users/create`,
  ADMINAPIUSERSAVAILABILITY: `${API}/admin/api/users/check-availability`,
  ADMINAPIUSERSBYID: (id: string) => `${API}/admin/api/users/${id}`,
  ADMINAPIUSERDISABLE: (id: string) => `${API}/admin/api/users/${id}/disable`,
  ADMINAPIUSERENABLE: (id: string) => `${API}/admin/api/users/${id}/enable`,
  ADMINAPIUSERREVOKE: (id: string) => `${API}/admin/api/users/${id}/revoke-sessions`,
  ADMINAPIUSERUNLOCK: (id: string) => `${API}/admin/api/users/${id}/unlock`,
  ADMINAPIUSERRESETPW: (id: string) => `${API}/admin/api/users/${id}/reset-password`,

  // Per-user TOTP
  ADMINAPIUSERTOTPSETUP: (id: string) => `${API}/admin/api/users/${id}/totp/setup`,
  ADMINAPIUSERTOTPENABLE: (id: string) => `${API}/admin/api/users/${id}/totp/enable`,
  ADMINAPIUSERTOTPDISABLE: (id: string) => `${API}/admin/api/users/${id}/totp/disable`,
  ADMINAPIUSERTOTPRESET: (id: string) => `${API}/admin/api/users/${id}/totp/reset`,

  // Global TOTP (owner's own settings)
  ADMINAPITOTPSETUP: `${API}/admin/api/settings/totp/setup`,
  ADMINAPITOTPENABLE: `${API}/admin/api/settings/totp/enable`,
  ADMINAPITOTPDISABLE: `${API}/admin/api/settings/totp/disable`,

  // Roles & permissions
  ADMINAPIROLES: `${API}/admin/api/roles`,
  ADMINAPIROLESCREATE: `${API}/admin/api/roles`,
  ADMINAPIROLESBYID: (id: string) => `${API}/admin/api/roles/${id}`,
  ADMINAPIPERMISSIONS: `${API}/admin/api/permissions`,

  // Message tag removal
  ADMINAPIMESSAGETAGDELETE: (messageId: string, tagId: string) =>
    `${API}/admin/api/messages/${messageId}/tags/${tagId}`,

  // Trash
  ADMINAPIMESSAGETRASH: (id: string) => `${API}/admin/api/messages/${id}/trash`,
  ADMINAPIMESSAGESTRASHBULK: `${API}/admin/api/messages/bulk/trash`,
  ADMINAPIMESSAGEBULKACTION: `${API}/admin/api/messages/bulk`,
  ADMINAPITRASH: `${API}/admin/api/trash`,
  ADMINAPITRASHBYID: (id: string) => `${API}/admin/api/trash/${id}`,
  ADMINAPITRASHRESTORE: (id: string) => `${API}/admin/api/trash/${id}/restore`,
  ADMINAPITRASHPERMANENT: (id: string) => `${API}/admin/api/trash/${id}`,
  ADMINAPITRASHBULKRESTORE: `${API}/admin/api/trash/bulk/restore`,
  ADMINAPITRASHBULKDELETE: `${API}/admin/api/trash/bulk/delete`,
  ADMINAPITRASHEMPTY: `${API}/admin/api/trash/empty`,
} as const;
```

```typescript
// File: src\lib\turnstile.ts
// Cloudflare Turnstile client helper. Explicit render, no third-party wrapper.
// The site key is public and safe to ship in the bundle; the secret key never
// leaves the backend. Tokens are single-use, so a form must reset the widget
// and fetch a fresh token on every attempt.
//
// Each form gets its own Cloudflare widget so the server can pin the expected
// `action` per endpoint. Widget *mode* however is configured in the Cloudflare
// dashboard and wins over anything passed here — a widget created as
// "Non-interactive" or "Invisible" never shows a checkbox and the options
// below cannot override that.

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Widget used by the admin login form. */
export const ADMIN_LOGIN_SITE_KEY: string =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() ||
  "0x4AAAAAAEYNYl20nw8S24aH";

/**
 * Widget used by the public contact form — a separate widget from the admin
 * login one, so the server can pin `action: "contact_form"` and a token minted
 * here cannot be replayed against `/vks/api/auth/login`.
 *
 * Site keys are public by design (they ship in the browser bundle), so the
 * default here is the real key rather than a placeholder — the form works
 * without any build-time env var, same as ADMIN_LOGIN_SITE_KEY. Point
 * VITE_TURNSTILE_CONTACT_SITE_KEY at a different widget to override.
 */
export const CONTACT_SITE_KEY: string =
  (import.meta.env.VITE_TURNSTILE_CONTACT_SITE_KEY as string | undefined)?.trim() ||
  "0x4AAAAAAFRKAxlycVCJSy__";

interface TurnstileOptions {
  sitekey: string;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact" | "flexible";
  action?: string;
  mode?: "managed" | "non-interactive" | "invisible";
  appearance?: "always" | "execute" | "interaction-only";
  execution?: "render" | "execute";
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
}

/** Per-widget render overrides. All fields optional; see `renderTurnstile`. */
export interface TurnstileRenderConfig {
  /** Must match the action the backend expects for this endpoint. */
  action?: string;
  /** Overrides the default site key. */
  siteKey?: string;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact" | "flexible";
  /**
   * `managed` + `always` is what forces a real click: the checkbox is always
   * rendered and the user must pass it. `non-interactive` shows a passive
   * success badge instead, and `invisible` shows nothing at all.
   */
  mode?: "managed" | "non-interactive" | "invisible";
  appearance?: "always" | "execute" | "interaction-only";
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: TurnstileOptions) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const LOAD_TIMEOUT_MS = 10_000;

let scriptPromise: Promise<void> | null = null;

export function loadTurnstile(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Turnstile requires a browser"));
  }
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const fail = (msg: string) => {
      const s = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
      if (s) s.dataset.failed = "true";
      reject(new Error(msg));
    };

    // Bounded poll: a script tag that exists but never yields the API must
    // surface an error, not hang silently (the old wait() never settled).
    const poll = (existing: HTMLScriptElement | null) => {
      const deadline = Date.now() + LOAD_TIMEOUT_MS;
      const check = () => {
        if (window.turnstile) return resolve();
        if (existing?.dataset.failed === "true") {
          return fail("Turnstile script previously failed");
        }
        if (Date.now() > deadline) {
          return fail("Timed out waiting for the Turnstile API");
        }
        window.setTimeout(check, 50);
      };
      check();
    };

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) return poll(existing);

    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => {
      window.setTimeout(() => {
        if (window.turnstile) resolve();
        else fail("Turnstile script loaded but the API is unavailable");
      }, 0);
    };
    s.onerror = () => fail("Failed to load Turnstile");
    document.head.appendChild(s);
    poll(s);
  });

  // A failed load must not poison every later attempt in this page load.
  scriptPromise = scriptPromise.catch((error) => {
    scriptPromise = null;
    throw error;
  });

  return scriptPromise;
}

export function renderTurnstile(
  el: HTMLElement,
  onToken: (token: string) => void,
  onExpire: () => void,
  onError: () => void,
  config: TurnstileRenderConfig = {}
): string | null {
  if (!window.turnstile) return null;
  const {
    action = "admin_login",
    siteKey = ADMIN_LOGIN_SITE_KEY,
    theme = "auto",
    size = "normal",
    mode,
    appearance,
  } = config;
  try {
    return window.turnstile.render(el, {
      sitekey: siteKey,
      theme,
      size,
      action,
      // Only forward these when asked, so the existing admin login widget
      // keeps rendering with exactly the options it always has.
      ...(mode ? { mode } : {}),
      ...(appearance ? { appearance } : {}),
      callback: onToken,
      "expired-callback": onExpire,
      "error-callback": onError,
    });
  } catch (err) {
    console.error("[Turnstile] render failed:", err);
    return null;
  }
}

export function resetTurnstile(widgetId: string | null) {
  if (widgetId && window.turnstile) window.turnstile.reset(widgetId);
}

/**
 * Tear a widget down. Pass the same ref you called resetTurnstile with so the
 * caller can null it out — otherwise a remount orphans the old widget and the
 * container keeps rendering the previous challenge.
 */
export function removeTurnstile(widgetId: string | null) {
  if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
}
```

```typescript
// File: src\lib\wsAuth.ts
import { site } from "@/config/site";

export type WsServerEvent =
  | { event: "connected"; challenge_id: string; methods?: string[] }
  | { event: "state"; state: "awaiting_otp" | "awaiting_totp" }
  | { event: "otp_status"; status: "sent" | "delivered" | "expired"; method: string }
  | {
      event: "auth_success";
      exchange_code: string;
      admin: { id: string; username: string; role: string };
    }
  | {
      event: "error";
      code: string;
      retry_after?: number;
    };

type ClientMsg =
  | { action: "verify"; method: "telegram_otp" | "totp"; code: string };

export interface AuthWsCallbacks {
  onConnected?: () => void;
  onState?: (state: "awaiting_otp" | "awaiting_totp") => void;
  onOtpStatus?: (status: "sent" | "delivered" | "expired") => void;
  onAuthSuccess: (result: {
    exchange_code: string;
    admin: { id: string; username: string; role: string };
  }) => void;
  onError?: (code: string, retryAfter?: number) => void;
  onClosed?: () => void;
}

const WS_BASE = site.api.wsBaseUrl;

export class AuthWebSocket {
  private ws: WebSocket | null = null;
  private callbacks: AuthWsCallbacks;

  constructor(callbacks: AuthWsCallbacks) {
    this.callbacks = callbacks;
  }

  connect(ticket: string) {
    const url = `${WS_BASE}/ws/auth?ticket=${encodeURIComponent(ticket)}`;
    this.ws = new WebSocket(url);

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as WsServerEvent;
        this.handleMessage(msg);
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      this.callbacks.onClosed?.();
    };

    this.ws.onerror = () => {
      this.callbacks.onError?.("connection_error");
    };
  }

  verify(method: "telegram_otp" | "totp", code: string) {
    this.send({ action: "verify", method, code });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private send(msg: ClientMsg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private handleMessage(msg: WsServerEvent) {
    switch (msg.event) {
      case "connected":
        this.callbacks.onConnected?.();
        break;
      case "state":
        this.callbacks.onState?.(msg.state);
        break;
      case "otp_status":
        this.callbacks.onOtpStatus?.(msg.status);
        break;
      case "auth_success":
        this.callbacks.onAuthSuccess({
          exchange_code: msg.exchange_code,
          admin: msg.admin,
        });
        break;
      case "error":
        this.callbacks.onError?.(msg.code, msg.retry_after);
        break;
    }
  }
}
```

```tsx
// File: src\main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "@/context/ThemeContext";
import App from "@/App";
import "@/index.css";

window.addEventListener("pageshow", (event) => {
  if ((event as PageTransitionEvent).persisted) {
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
```

```tsx
// File: src\pages\About.tsx
import { site } from "@/config/site";

function ScaleIcon() {
  return (
    <svg className="h-6 w-6 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.589-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.589-1.202L5.25 4.971z" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg className="h-6 w-6 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="h-6 w-6 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg className="h-6 w-6 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-5 w-5 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function DiamondIcon() {
  return (
    <svg className="h-5 w-5 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg className="h-5 w-5 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function MagnifierIcon() {
  return (
    <svg className="h-5 w-5 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

const serviceIconMap: Record<string, React.FC> = {
  scale: ScaleIcon,
  document: DocumentIcon,
  chart: ChartIcon,
  gear: GearIcon,
};

const whyHireIconMap: Record<string, React.FC> = {
  shield: ShieldIcon,
  calendar: () => (
    <svg className="h-5 w-5 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  diamond: DiamondIcon,
  magnifier: MagnifierIcon,
  bolt: BoltIcon,
};

export default function About() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-20">
      {/* ── Section 1: Who I Am ──────────────────── */}
      <section className="mb-16 reveal">
        <h2 className="text-2xl md:text-3xl font-bold text-night-800 dark:text-cream-50 mb-6">
          Who I Am
        </h2>
        <div className="p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700">
          <div className="flex items-start gap-5">
            <div className="hidden sm:flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-glow-500/10 border border-glow-500/20">
              <span className="text-2xl font-bold text-glow-600 dark:text-glow-400">VK</span>
            </div>
            <div>
              <h3 className="font-semibold text-night-800 dark:text-cream-50 mb-1">
                {site.name}
              </h3>
              <p className="text-sm text-glow-500 font-medium mb-3">
                {site.tagline}
              </p>
              <p className="text-night-800 dark:text-cream-100 leading-relaxed">
                {site.description}
              </p>
              <p className="text-night-800/60 dark:text-cream-100/60 leading-relaxed mt-3 text-sm">
                My legal work includes research, drafting, document review, and legal support
                across various practice areas. During my legal journey, I have worked on matters
                relating to Family Law, Criminal Law, the Negotiable Instruments Act, Contract
                Law, Consumer Law, Constitutional Law, and other civil and commercial legal
                matters. Alongside legal practice, I use technology and data-driven workflows
                to improve accuracy, organization, and efficiency while maintaining complete
                confidentiality for every engagement.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: What I Do ─────────────────── */}
      <section className="mb-16">
        <h2 className="text-2xl md:text-3xl font-bold text-night-800 dark:text-cream-50 mb-6">
          What I Do
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {site.services.map((s, i) => {
            const Icon = serviceIconMap[s.icon] ?? ScaleIcon;
            return (
              <div
                key={s.title}
                className="reveal card-hover p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <Icon />
                <h3 className="mt-3 font-semibold text-night-800 dark:text-cream-50">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm text-night-800/60 dark:text-cream-100/60 leading-relaxed">
                  {s.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Section 3: How I Work ────────────────── */}
      <section className="mb-16">
        <h2 className="text-2xl md:text-3xl font-bold text-night-800 dark:text-cream-50 mb-6">
          How I Work
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {site.principles.map((p, i) => (
            <div
              key={p.title}
              className="reveal card-hover p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <h3 className="font-semibold text-glow-500 mb-2">{p.title}</h3>
              <p className="text-sm text-night-800/60 dark:text-cream-100/60 leading-relaxed">
                {p.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 4: Why Clients Choose to Work With Me ───────────────── */}
      <section className="mb-16">
        <h2 className="text-2xl md:text-3xl font-bold text-night-800 dark:text-cream-50 mb-6">
          Why Clients Choose to Work With Me
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {site.whyHireMe.map((item, i) => {
            const Icon = whyHireIconMap[item.icon] ?? ShieldIcon;
            return (
              <div
                key={item.title}
                className="reveal card-hover p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <Icon />
                <h3 className="mt-3 font-semibold text-night-800 dark:text-cream-50">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-night-800/60 dark:text-cream-100/60 leading-relaxed">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Section 5: Education & Credentials ───── */}
      <section>
        <h2 className="text-2xl md:text-3xl font-bold text-night-800 dark:text-cream-50 mb-6">
          Education & Credentials
        </h2>

        <div className="grid sm:grid-cols-2 gap-6 mb-8">
          {site.qualifications.map((q, i) => (
            <div
              key={q.degree}
              className="reveal card-hover p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <p className="text-sm text-glow-500 font-medium mb-1">{q.degree}</p>
              <p className="text-night-800/70 dark:text-cream-100/70 text-sm">{q.institution}</p>
            </div>
          ))}
        </div>

        <h3 className="text-lg font-semibold text-night-800 dark:text-cream-50 mb-4">
          Areas of Practice
        </h3>
        <div className="flex flex-wrap gap-3">
          {site.expertise.map((e) => (
            <span
              key={e}
              className="text-sm px-4 py-2 rounded-full bg-glow-500/10 border border-glow-500/20 text-glow-600 dark:text-glow-400 font-medium"
            >
              {e}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
```

```tsx
// File: src\pages\admin\AdminLayout.tsx
import { useState, useEffect, useRef } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import AnimatedLogo from "../../components/AnimatedLogo";
import BrandLogo from "../../components/BrandLogo";
import SessionExpiryWarning from "../../components/SessionExpiryWarning";
import {
  LayoutDashboard,
  Inbox,
  Trash2,
  Settings,
  Users,
  ShieldCheck,
  ScrollText,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

const navItems = [
  { to: "/vega/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: null },
  { to: "/vega/admin/inbox", label: "Inbox", icon: Inbox, roles: null },
  { to: "/vega/admin/trash", label: "Trash", icon: Trash2, roles: null },
  { to: "/vega/admin/settings", label: "Settings", icon: Settings, roles: null },
  { to: "/vega/admin/users", label: "Users", icon: Users, roles: ["owner", "admin", "manager"] },
  { to: "/vega/admin/roles", label: "Roles", icon: ShieldCheck, roles: ["owner", "admin", "manager"] },
  { to: "/vega/admin/audit-logs", label: "Audit Logs", icon: ScrollText, roles: null },
];

const MOBILE_BREAKPOINT = 768;

export default function AdminLayout() {
  const { admin, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem("admin-sidebar-collapsed");
    if (saved !== null) return saved === "true";
    return window.innerWidth < MOBILE_BREAKPOINT;
  });
  const [hoverCapsule, setHoverCapsule] = useState<{ label: string; active: boolean } | null>(null);
  const [capsulePos, setCapsulePos] = useState<{ top: number; left: number } | null>(null);
  const hoverElRef = useRef<HTMLElement | null>(null);

  function positionCapsule() {
    const el = hoverElRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCapsulePos({ top: rect.top + rect.height / 2, left: rect.right + 8 });
  }

  useEffect(() => {
    if (!hoverCapsule) return;
    const update = () => positionCapsule();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [hoverCapsule]);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent) => {
      setCollapsed(e.matches);
      localStorage.setItem("admin-sidebar-collapsed", String(e.matches));
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  function toggleSidebar() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("admin-sidebar-collapsed", String(next));
      return next;
    });
  }

  function handleLogout() {
    logout();
  }

  return (
    <div className="admin-theme flex h-screen overflow-hidden bg-background text-foreground">
      <aside
        className={`${
          collapsed ? "w-16" : "w-64"
        } neu-flat border-0 flex flex-col transition-all duration-200 shrink-0 m-2 rounded-2xl`}
      >
        {/* Header */}
        <div
          className={`flex items-center border-b border-border/50 min-h-[57px] ${
            collapsed
              ? "flex-col py-3 px-2 gap-2"
              : "flex-row gap-2 px-3 py-5"
          }`}
        >
          <AnimatedLogo size={collapsed ? 32 : 28} />
          {!collapsed && (
            <BrandLogo fontSize={14} duration={2} className="font-semibold text-primary" />
          )}
          {!collapsed && (
            <button
              onClick={toggleSidebar}
              className="ml-auto p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>
        {collapsed && (
          <button
            onClick={toggleSidebar}
            className="mx-auto p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {navItems
            .filter((item) => !item.roles || (admin?.role && item.roles.includes(admin.role)))
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onMouseEnter={(e) => {
                  if (collapsed) {
                    hoverElRef.current = e.currentTarget;
                    setHoverCapsule({ label: item.label, active: location.pathname === item.to });
                    positionCapsule();
                  }
                }}
                onMouseLeave={() => {
                  hoverElRef.current = null;
                  setHoverCapsule(null);
                }}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${
                    isActive
                      ? "nav-active"
                      : "text-foreground/75 hover:text-foreground hover:bg-muted/40"
                  } ${collapsed ? "justify-center" : ""}`
                }
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-border/50 px-2 py-3 space-y-2">
          {!collapsed && admin && (
            <div className="px-3 py-2 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">
                  {(admin.display_name || admin.username).charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-foreground truncate">{admin.display_name || admin.username}</p>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary shrink-0">
                    {admin.role}
                  </span>
                </div>
              </div>
            </div>
          )}
          {collapsed && admin && (
            <div className="flex justify-center">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">
                  {(admin.display_name || admin.username).charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-destructive transition-colors ${
              collapsed ? "justify-center" : ""
            }`}
            title={collapsed ? "Logout" : undefined}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {collapsed && hoverCapsule && capsulePos && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ top: capsulePos.top, left: capsulePos.left }}
          role="tooltip"
        >
          <div
            className={`translate-y-[-50%] neu-flat px-3 py-2.5 rounded-xl text-sm whitespace-nowrap font-medium ${
              hoverCapsule.active ? "nav-active" : "text-foreground/75"
            }`}
          >
            {hoverCapsule.label}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden p-2">
        <div className="h-full neu-flat rounded-2xl p-6 flex flex-col gap-3">
          <SessionExpiryWarning />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
```

```tsx
// File: src\pages\admin\AuditLogs.tsx
import { useEffect, useState } from "react";
import { ROUTES } from "@/lib/routes";
import { apiFetch } from "@/lib/adminApi";
import { SkeletonTableRows } from "@/components/ui/skeleton";

interface AuditLog {
  id: number;
  event: string;
  actor_admin_id: string;
  ip_address: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [jumpValue, setJumpValue] = useState("");

  useEffect(() => {
    setLoading(true);
    apiFetch(`${ROUTES.ADMINAPIAUDITLOGS}?page=${page}&limit=50`)
      .then((r) => r.json())
      .then((data) => {
        setLogs(data.items ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.ceil(total / 50);

  function handleJump() {
    const n = parseInt(jumpValue, 10);
    if (Number.isFinite(n) && n >= 1 && n <= totalPages) {
      setPage(n);
    }
    setJumpValue("");
  }

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <p className="text-muted-foreground text-sm">{total} total entries</p>
      </div>

      <div className="neu-flat overflow-auto flex-1 min-h-0 text-foreground">
        <table className="w-full">
          <thead className="sticky top-0 z-10 border-b border-border/50 bg-background">
            <tr>
              <th className="text-left p-3 text-sm font-bold text-foreground">Event</th>
              <th className="text-left p-3 text-sm font-bold text-foreground">Actor</th>
              <th className="text-left p-3 text-sm font-bold text-foreground">IP</th>
              <th className="text-left p-3 text-sm font-bold text-foreground">Time</th>
            </tr>
          </thead>
          {loading ? (
            <SkeletonTableRows rows={10} cols={4} />
          ) : (
            <tbody className="divide-y divide-border/50">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-3 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium leading-none inline-flex items-center ${
                      log.event.includes("success") || log.event.includes("verified") ? "bg-green-100 text-green-700" :
                      log.event.includes("failure") || log.event.includes("disabled") ? "bg-red-100 text-red-700" :
                      "bg-slate-100 text-slate-700"
                    }`}>
                      {log.event}
                    </span>
                  </td>
                  <td className="p-3 text-sm text-muted-foreground font-mono text-xs">
                    {log.actor_admin_id?.slice(0, 8) ?? "—"}
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">{log.ip_address ?? "—"}</td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 shrink-0">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 neu-btn text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">Page</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleJump(); }}
            onBlur={handleJump}
            placeholder={String(page)}
            className="w-14 px-2 py-1 neu-concave rounded-lg bg-transparent text-foreground text-sm text-center"
          />
          <span className="text-sm text-muted-foreground">of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 neu-btn text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
```

```tsx
// File: src\pages\admin\Dashboard.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/lib/routes";
import { apiFetch } from "@/lib/adminApi";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Mail, Clock, CheckCircle, Trash2, ArrowRight, ChevronRight } from "lucide-react";

interface Stats {
  total_messages: number;
  new_messages: number;
  in_progress: number;
  resolved: number;
  trashed_count?: number;
}

interface Message {
  id: string;
  reference: string;
  sender_name: string;
  sender_email: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch(ROUTES.ADMINAPISTATS).then((r) => r.json()),
      apiFetch(`${ROUTES.ADMINAPIMESSAGES}?limit=5`).then((r) => r.json()),
    ])
      .then(([statsData, recentData]) => {
        setStats(statsData);
        setRecent(recentData.items ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: "Total Messages", value: stats?.total_messages ?? 0, icon: MessageSquare, color: "text-primary" },
    { label: "New", value: stats?.new_messages ?? 0, icon: Mail, color: "text-orange-500" },
    { label: "In Progress", value: stats?.in_progress ?? 0, icon: Clock, color: "text-yellow-500" },
    { label: "Resolved", value: stats?.resolved ?? 0, icon: CheckCircle, color: "text-accent" },
    { label: "Trash", value: stats?.trashed_count ?? 0, icon: Trash2, color: "text-red-500" },
  ];

  return (
    <div className="flex flex-col gap-6 h-full min-h-0">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Overview of your admin console</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 shrink-0">
        {loading
          ? cards.map((card) => (
              <div key={card.label} className="neu-convex p-6">
                <div className="flex items-center justify-between mb-4">
                  <Skeleton className="h-4 w-24 rounded" />
                  <Skeleton className="h-5 w-5 rounded" />
                </div>
                <Skeleton className="h-8 w-16 rounded" />
              </div>
            ))
          : cards.map((card) => (
              <div key={card.label} className="neu-convex p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-muted-foreground">{card.label}</span>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <p className="text-3xl font-bold">{card.value}</p>
              </div>
            ))}
      </div>

      <div className="neu-flat flex flex-col gap-3 flex-1 min-h-0">
        <div className="flex items-center justify-between p-6 border-b border-border/50 shrink-0">
          <h2 className="font-semibold">Recent Messages</h2>
          <Link to="/vega/admin/inbox" className="text-sm text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="divide-y divide-border/50 overflow-auto flex-1 min-h-0">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4">
                <div className="flex-1 min-w-0 space-y-2">
                  <Skeleton className="h-4 w-1/3 rounded" />
                  <Skeleton className="h-3 w-2/3 rounded" />
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <Skeleton className="h-5 w-14 rounded-full" />
                  <Skeleton className="h-3 w-16 rounded" />
                  <Skeleton className="h-4 w-4 rounded" />
                </div>
              </div>
            ))
          ) : recent.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No messages yet.</p>
          ) : (
            recent.map((msg) => (
              <Link
                key={msg.id}
                to={`/vega/admin/inbox?message=${msg.id}`}
                className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{msg.sender_name || "Anonymous"}</p>
                  <p className="text-xs text-muted-foreground truncate">{msg.subject}</p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    msg.status === "new" ? "bg-orange-100 text-orange-700" :
                    msg.status === "in_progress" ? "bg-yellow-100 text-yellow-700" :
                    "bg-green-100 text-green-700"
                  }`}>
                    {msg.status}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(msg.created_at).toLocaleDateString()}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
```

```tsx
// File: src\pages\admin\Inbox.tsx
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { ROUTES } from "@/lib/routes";
import { apiFetch } from "@/lib/adminApi";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Paperclip,
  Trash2,
  Pin,
  Flag,
  Tag,
  MessageSquare,
  Plus,
  X,
  Clock,
  FileText,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { NeuSelect } from "@/components/ui/select";
import DeleteMessageDialog from "@/components/admin/DeleteMessageDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/* ── Types ──────────────────────────────────────── */

interface ListMessage {
  id: string;
  reference: string;
  sender_name: string;
  sender_email: string;
  subject: string;
  status: string;
  priority: string;
  channel: string;
  created_at: string;
  attachment_count?: number;
  is_pinned: boolean;
  is_flagged: boolean;
}

interface Note {
  id: string;
  body: string;
  author_id: string;
  created_at: string;
}

interface Tag_ {
  id: string;
  name: string;
  color: string;
}

interface Attachment {
  id: string;
  filename: string;
  url: string;
  size?: number;
  content_type?: string;
}

interface DetailMessage {
  id: string;
  reference: string;
  sender_name: string;
  sender_email: string;
  sender_phone: string;
  subject: string;
  body: string;
  status: string;
  priority: string;
  channel: string;
  source_page: string;
  created_at: string;
  is_pinned: boolean;
  pinned_at: string | null;
  is_flagged: boolean;
  flagged_at: string | null;
  notes: Note[];
  tags: Tag_[];
  attachments?: Attachment[];
}

/* ── Helpers ─────────────────────────────────────── */

function statusColor(s: string) {
  switch (s) {
    case "new": return "bg-orange-100 text-orange-700";
    case "in_progress": return "bg-yellow-100 text-yellow-700";
    case "resolved": return "bg-green-100 text-green-700";
    default: return "bg-slate-100 text-slate-700";
  }
}

function priorityColor(p: string) {
  switch (p) {
    case "urgent": return "bg-red-100 text-red-700";
    case "high": return "bg-orange-100 text-orange-700";
    default: return "bg-slate-100 text-slate-600";
  }
}

/* ── Skeleton loaders ─────────────────────────────── */

function MessageListSkeleton() {
  return (
    <div className="divide-y divide-border/50">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-start gap-2 p-3">
          <Skeleton className="h-3.5 w-3.5 rounded shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-3 w-1/3 rounded" />
            <Skeleton className="h-3 w-2/3 rounded" />
            <div className="flex items-center gap-2 mt-1">
              <Skeleton className="h-4 w-14 rounded-full" />
              <Skeleton className="h-4 w-14 rounded-full" />
              <Skeleton className="ml-auto h-3 w-16 rounded" />
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 shrink-0">
            <Skeleton className="h-3.5 w-3.5 rounded" />
            <Skeleton className="h-3.5 w-3.5 rounded" />
            <Skeleton className="h-3.5 w-3.5 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MessageDetailSkeleton() {
  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      <div className="shrink-0 neu-flat rounded-xl p-4 space-y-3">
        <Skeleton className="h-4 w-1/3 rounded" />
        <Skeleton className="h-3 w-1/2 rounded" />
        <Skeleton className="h-5 w-20 rounded" />
      </div>
      <div className="shrink-0 neu-flat rounded-xl p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Skeleton className="h-8 rounded" />
          <Skeleton className="h-8 rounded" />
          <Skeleton className="h-8 rounded" />
          <Skeleton className="h-8 rounded" />
        </div>
      </div>
      <div className="neu-flat rounded-xl p-5 flex-1 min-h-0 space-y-2">
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-3 w-5/6 rounded" />
        <Skeleton className="h-3 w-4/6 rounded" />
        <Skeleton className="h-3 w-full rounded" />
      </div>
    </div>
  );
}

function MessageSidebarSkeleton() {
  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      <div className="shrink-0">
        <div className="w-full flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-3.5 w-14 rounded" />
          </div>
          <Skeleton className="h-5 w-5 rounded-lg" />
        </div>
        <div className="neu-flat rounded-xl overflow-hidden mx-2 mb-2">
          <div className="px-4 py-3 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-12 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          </div>
        </div>
      </div>
      <div className="shrink-0">
        <div className="shrink-0 w-full flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-3.5 w-14 rounded" />
            <Skeleton className="h-4 w-4 rounded" />
          </div>
          <Skeleton className="h-5 w-5 rounded-lg" />
        </div>
        <div className="neu-flat rounded-xl overflow-hidden mx-2 mb-2">
          <div className="px-4 py-3 space-y-3">
            <div className="space-y-2">
              <Skeleton className="h-3 w-3/4 rounded" />
              <Skeleton className="h-3 w-1/2 rounded" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-2/3 rounded" />
              <Skeleton className="h-3 w-1/3 rounded" />
            </div>
          </div>
        </div>
      </div>
      <div className="shrink-0">
        <div className="shrink-0 w-full flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="h-4 w-4 rounded" />
          </div>
          <Skeleton className="h-5 w-5 rounded-lg" />
        </div>
        <div className="neu-flat rounded-xl overflow-hidden mx-2 mb-2">
          <div className="px-4 py-3 space-y-2">
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-4 rounded shrink-0" />
              <Skeleton className="h-3 w-1/2 rounded" />
              <Skeleton className="ml-auto h-3 w-10 rounded" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-4 rounded shrink-0" />
              <Skeleton className="h-3 w-1/3 rounded" />
              <Skeleton className="ml-auto h-3 w-10 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Component ───────────────────────────────────── */

export default function Inbox() {
  /* ── Router deep-link ── */
  const [searchParams, setSearchParams] = useSearchParams();

  /* ── List state ── */
  const [messages, setMessages] = useState<ListMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  /* ── Selection state ── */
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailMessage | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  /* ── Tags / Notes ── */
  const [showTagModal, setShowTagModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [noteInput, setNoteInput] = useState("");

  /* ── Delete dialogs ── */
  const [deleteTarget, setDeleteTarget] = useState<ListMessage | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  /* ── Mobile: show which pane ── */
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  /* ── Sidebar collapsible cards ── */
  const [tagsOpen, setTagsOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(true);
  const [attachmentsOpen, setAttachmentsOpen] = useState(true);

  /* ────────────────────────────────────────────────
     Fetch message list
     ──────────────────────────────────────────────── */

  const fetchList = useCallback(() => {
    setLoading(true);
    setListError("");
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    apiFetch(`${ROUTES.ADMINAPIMESSAGES}?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load messages");
        return r.json();
      })
      .then((data) => {
        setMessages(data.items ?? []);
        setTotal(data.total ?? 0);
      })
      .catch((e) => setListError(e.message || "Failed to load messages"))
      .finally(() => setLoading(false));
  }, [page, search, statusFilter]);

  useEffect(() => { fetchList(); }, [fetchList]);

  /* ────────────────────────────────────────────────
     Fetch message detail (on select)
     ──────────────────────────────────────────────── */

  const fetchDetail = useCallback((id: string) => {
    setDetailLoading(true);
    setDetailError("");
    setDetail(null);
    apiFetch(`${ROUTES.ADMINAPIMESSAGES}/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load message");
        return r.json();
      })
      .then((data) => setDetail(data))
      .catch((e) => setDetailError(e.message || "Failed to load message"))
      .finally(() => setDetailLoading(false));
  }, []);

  useEffect(() => {
    if (activeId) fetchDetail(activeId);
  }, [activeId, fetchDetail]);

  /* ── Deep-link from dashboard (?message=<id>) ─── */

  useEffect(() => {
    const messageId = searchParams.get("message");
    if (messageId) {
      setActiveId(messageId);
      setMobileView("detail");
      const next = new URLSearchParams(searchParams);
      next.delete("message");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  /* ── Select a message ── */

  function selectMessage(id: string) {
    setActiveId(id);
    setMobileView("detail");
  }

  function backToList() {
    setActiveId(null);
    setDetail(null);
    setMobileView("list");
  }

  /* ────────────────────────────────────────────────
     Pin / Flag toggles
     ──────────────────────────────────────────────── */

  async function togglePin(msg: ListMessage) {
    const newVal = !msg.is_pinned;
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, is_pinned: newVal } : m))
    );
    try {
      await apiFetch(`${ROUTES.ADMINAPIMESSAGES}/${msg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_pinned: newVal }),
      });
      if (detail?.id === msg.id) setDetail((d) => d ? { ...d, is_pinned: newVal } : d);
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, is_pinned: !newVal } : m))
      );
      setActionError("Failed to update pin status");
    }
  }

  async function toggleFlag(msg: ListMessage) {
    const newVal = !msg.is_flagged;
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, is_flagged: newVal } : m))
    );
    try {
      await apiFetch(`${ROUTES.ADMINAPIMESSAGES}/${msg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_flagged: newVal }),
      });
      if (detail?.id === msg.id) setDetail((d) => d ? { ...d, is_flagged: newVal } : d);
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, is_flagged: !newVal } : m))
      );
      setActionError("Failed to update flag status");
    }
  }

  /* ────────────────────────────────────────────────
     Trash
     ──────────────────────────────────────────────── */

  async function trashOne(id: string) {
    setActionLoading(true);
    setActionError("");
    try {
      const r = await apiFetch(ROUTES.ADMINAPIMESSAGETRASH(id), { method: "POST" });
      if (!r.ok) throw new Error("Failed to move to trash");
      setMessages((prev) => prev.filter((m) => m.id !== id));
      setTotal((prev) => prev - 1);
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
      if (activeId === id) backToList();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Failed to move to trash");
    }
    setActionLoading(false);
    setDeleteTarget(null);
  }

  async function bulkTrash() {
    setActionLoading(true);
    setActionError("");
    const ids = Array.from(selected);
    try {
      const r = await apiFetch(ROUTES.ADMINAPIMESSAGESTRASHBULK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_ids: ids }),
      });
      if (!r.ok) throw new Error("Failed to move messages to trash");
      setMessages((prev) => prev.filter((m) => !selected.has(m.id)));
      setTotal((prev) => prev - ids.length);
      setSelected(new Set());
      if (activeId && ids.includes(activeId)) backToList();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Failed to move messages to trash");
    }
    setActionLoading(false);
    setBulkDeleteOpen(false);
  }

  /* ────────────────────────────────────────────────
     Bulk select
     ──────────────────────────────────────────────── */

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === messages.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(messages.map((m) => m.id)));
    }
  }

  /* ────────────────────────────────────────────────
     Tags / Notes (detail pane)
     ──────────────────────────────────────────────── */

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId || !noteInput.trim()) return;
    try {
      const res = await apiFetch(`${ROUTES.ADMINAPIMESSAGES}/${activeId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteInput }),
      });
      if (!res.ok) throw new Error("Failed to add note");
      const note = await res.json();
      setDetail((prev) => prev ? { ...prev, notes: [...prev.notes, note] } : prev);
      setNoteInput("");
    } catch {
      setActionError("Failed to add note");
    }
  }

  async function addTag(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId || !tagInput.trim()) return;
    try {
      const r = await apiFetch(`${ROUTES.ADMINAPIMESSAGES}/${activeId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag_name: tagInput }),
      });
      if (!r.ok) throw new Error("Failed to add tag");
      setTagInput("");
      fetchDetail(activeId);
    } catch {
      setActionError("Failed to add tag");
    }
  }

  async function removeTag(tagId: string) {
    if (!activeId) return;
    try {
      const r = await apiFetch(ROUTES.ADMINAPIMESSAGETAGDELETE(activeId, tagId), {
        method: "DELETE",
      });
      if (!r.ok) throw new Error("Failed to remove tag");
      fetchDetail(activeId);
    } catch {
      setActionError("Failed to remove tag");
    }
  }

  /* ── Pagination ── */
  const totalPages = Math.ceil(total / 20);

  /* ────────────────────────────────────────────────
     RENDER
     ──────────────────────────────────────────────── */

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Error toast ── */}
      {actionError && (
        <div className="shrink-0 mb-2 px-4 py-2 neu-convex rounded-xl flex items-center justify-between text-sm text-red-600">
          <span>{actionError}</span>
          <button onClick={() => setActionError("")} className="p-1 hover:text-red-800">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Three-pane grid ───────────────────────── */}
      <div
        className="flex-1 min-h-0 hidden md:grid gap-3"
        style={{ gridTemplateColumns: "minmax(260px, 28%) minmax(420px, 1fr) minmax(240px, 25%)" }}
      >
        {/* ── Pane 1: Message List ─────────────────── */}
        <div className="flex flex-col min-h-0 gap-2">
          {/* Header + search */}
          <div className="shrink-0 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Search..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm"
              />
            </div>
            <NeuSelect
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v); setPage(1); }}
              options={[
                { value: "", label: "All Statuses" },
                { value: "new", label: "New" },
                { value: "in_progress", label: "In Progress" },
                { value: "waiting", label: "Waiting" },
                { value: "resolved", label: "Resolved" },
                { value: "spam", label: "Spam" },
              ]}
              className="w-full"
            />
          </div>

          {/* Bulk bar */}
          {selected.size > 0 && (
            <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 neu-convex rounded-xl text-xs">
              <input
                type="checkbox"
                checked={selected.size === messages.length && messages.length > 0}
                onChange={toggleSelectAll}
                className="h-3.5 w-3.5 rounded border-border accent-primary"
              />
              <span className="font-medium">{selected.size}</span>
              <div className="flex-1" />
              <button
                onClick={() => setBulkDeleteOpen(true)}
                disabled={actionLoading}
                className="px-2 py-1 neu-btn text-red-500 flex items-center gap-1"
              >
                <Trash2 className="h-3 w-3" /> Trash
              </button>
            </div>
          )}

          {/* List */}
          <div className="neu-flat overflow-y-auto flex-1 min-h-0 text-foreground">
            {loading ? (
              <MessageListSkeleton />
            ) : listError ? (
              <div className="p-6 text-center text-xs text-red-500">{listError}</div>
            ) : messages.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">No messages.</div>
            ) : (
              <div className="divide-y divide-border/50">
                {messages.map((msg) => {
                  const isActive = msg.id === activeId;
                  return (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-2 p-3 cursor-pointer transition-colors ${
                        isActive ? "bg-primary/5" : "hover:bg-muted/30"
                      }`}
                      onClick={() => selectMessage(msg.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(msg.id)}
                        onChange={(e) => { e.stopPropagation(); toggleSelect(msg.id); }}
                        className="h-3.5 w-3.5 rounded border-border accent-primary shrink-0 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {msg.is_pinned && <Pin className="h-3 w-3 text-primary shrink-0 fill-primary" />}
                          {msg.is_flagged && <Flag className="h-3 w-3 text-red-500 shrink-0 fill-red-500" />}
                          <p className="font-medium text-sm truncate">{msg.sender_name || "Anonymous"}</p>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{msg.subject}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColor(msg.status)}`}>
                            {msg.status.replace("_", " ")}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${priorityColor(msg.priority)}`}>
                            {msg.priority}
                          </span>
                          {msg.attachment_count ? (
                            <Paperclip className="h-3 w-3 text-muted-foreground" />
                          ) : null}
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {new Date(msg.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => togglePin(msg)}
                          className={`p-1 rounded-lg transition-colors ${
                            msg.is_pinned ? "text-primary" : "text-muted-foreground hover:text-primary"
                          }`}
                          title={msg.is_pinned ? "Unpin" : "Pin"}
                        >
                          <Pin className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => toggleFlag(msg)}
                          className={`p-1 rounded-lg transition-colors ${
                            msg.is_flagged ? "text-red-500" : "text-muted-foreground hover:text-red-500"
                          }`}
                          title={msg.is_flagged ? "Unflag" : "Flag"}
                        >
                          <Flag className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(msg)}
                          className="p-1 rounded-lg text-muted-foreground hover:text-red-500 transition-colors"
                          title="Move to trash"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="shrink-0 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-1 neu-btn text-xs disabled:opacity-50"
              >
                Prev
              </button>
              <span className="text-xs text-muted-foreground">{page}/{totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2 py-1 neu-btn text-xs disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* ── Pane 2: Message Detail ───────────────── */}
        <div className="flex flex-col min-h-0">
          {detailLoading ? (
            <MessageDetailSkeleton />
          ) : detailError ? (
            <div className="flex-1 flex items-center justify-center text-sm text-red-500">
              {detailError}
            </div>
          ) : !detail ? null : (
            <div className="flex flex-col min-h-0 gap-3">
              {/* Sender header */}
              <div className="shrink-0 neu-flat rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{detail.sender_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{detail.sender_email}</p>
                    <span className="inline-block mt-1 font-mono text-xs neu-concave px-2 py-0.5 rounded-lg text-muted-foreground">
                      {detail.reference}
                    </span>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => togglePin(detail)}
                      className={`p-1.5 neu-btn rounded-lg transition-colors ${
                        detail.is_pinned ? "text-primary" : "text-muted-foreground"
                      }`}
                      title={detail.is_pinned ? "Unpin" : "Pin"}
                    >
                      <Pin className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => toggleFlag(detail)}
                      className={`p-1.5 neu-btn rounded-lg transition-colors ${
                        detail.is_flagged ? "text-red-500" : "text-muted-foreground"
                      }`}
                      title={detail.is_flagged ? "Unflag" : "Flag"}
                    >
                      <Flag className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ id: detail.id, reference: detail.reference, sender_name: detail.sender_name, sender_email: detail.sender_email, subject: detail.subject, status: detail.status, priority: detail.priority, channel: detail.channel, created_at: detail.created_at, is_pinned: detail.is_pinned, is_flagged: detail.is_flagged })}
                      className="p-1.5 neu-btn rounded-lg text-muted-foreground hover:text-red-500 transition-colors"
                      title="Move to trash"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <div className="shrink-0 neu-flat rounded-xl p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground block mb-0.5">Channel</span>
                    <p className="font-medium">{detail.channel}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-0.5">Received</span>
                    <p className="font-medium">
                      {new Date(detail.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      ,{" "}
                      {new Date(detail.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                  {detail.sender_phone && (
                    <div>
                      <span className="text-muted-foreground block mb-0.5">Phone</span>
                      <p className="font-medium">{detail.sender_phone}</p>
                    </div>
                  )}
                  {detail.source_page && (
                    <div>
                      <span className="text-muted-foreground block mb-0.5">Source</span>
                      <p className="font-medium truncate" title={detail.source_page}>{detail.source_page}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="neu-flat rounded-xl p-5 flex-1 min-h-0 overflow-y-auto">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {detail.body}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Pane 3: Sidebar ────────────────── */}
        <div className="flex flex-col min-h-0 h-full gap-3">
          {detailLoading ? (
            <MessageSidebarSkeleton />
          ) : detail ? (
            <>
              {/* Tags card */}
              <div className="shrink-0">
                <div className="w-full flex items-center justify-between p-4">
                  <button
                    type="button"
                    onClick={() => setTagsOpen(v => !v)}
                    className="flex items-center gap-2 text-sm font-semibold"
                  >
                    <Tag className="h-4 w-4 text-primary" /> Tags
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${tagsOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  <button onClick={() => setShowTagModal(true)} className="p-1.5 neu-btn rounded-lg shrink-0" title="Manage tags">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                {tagsOpen && (
                  <div className="neu-flat rounded-xl overflow-hidden shrink-0 mx-2 mb-2">
                    <div className="px-4 py-3">
                      {detail.tags.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No tags yet</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {detail.tags.map((t) => (
                            <span key={t.id} className="px-2.5 py-1 bg-primary/10 text-primary text-xs rounded-full font-medium">
                              {t.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Notes card */}
              <div className="shrink-0">
                <div className="shrink-0 w-full flex items-center justify-between p-4">
                  <button
                    type="button"
                    onClick={() => setNotesOpen(v => !v)}
                    className="flex items-center gap-2 text-sm font-semibold"
                  >
                    <MessageSquare className="h-4 w-4 text-primary" /> Notes
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${notesOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  <button onClick={() => setShowNoteModal(true)} className="p-1.5 neu-btn rounded-lg shrink-0" title="Add note">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                {notesOpen && (
                  <div className="neu-flat rounded-xl overflow-hidden shrink-0 mx-2 mb-2">
                    <div className="px-4 py-3">
                      {detail.notes.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No notes yet</p>
                      ) : (
                        <div className="space-y-2.5">
                          {detail.notes.slice().reverse().slice(0, 5).map((n) => (
                            <div key={n.id} className="p-2.5 neu-concave rounded-xl">
                              <p className="text-xs leading-relaxed">{n.body}</p>
                              <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} &middot;{" "}
                                {new Date(n.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                              </p>
                            </div>
                          ))}
                          {detail.notes.length > 5 && (
                            <button
                              onClick={() => setShowNoteModal(true)}
                              className="text-xs text-primary hover:underline w-full text-center py-1"
                            >
                              View all {detail.notes.length} notes
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Attachments card */}
              {detail.attachments && detail.attachments.length > 0 && (
                <div className="shrink-0">
                  <div className="shrink-0 w-full flex items-center justify-between p-4">
                    <button
                      type="button"
                      onClick={() => setAttachmentsOpen(v => !v)}
                      className="flex items-center gap-2 text-sm font-semibold"
                    >
                      <Paperclip className="h-4 w-4 text-primary" /> Attachments · {detail.attachments.length}
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${attachmentsOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>

                  {attachmentsOpen && (
                    <div className="neu-flat rounded-xl overflow-hidden shrink-0 mx-2 mb-2">
                      <div className="px-4 py-3">
                        <div className="space-y-2">
                          {detail.attachments.map((att) => (
                            <a
                              key={att.id}
                              href={`/api${att.url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 px-3 py-2.5 neu-concave rounded-xl text-sm hover:bg-muted/30 transition-colors"
                            >
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="truncate flex-1 min-w-0">{att.filename}</span>
                              {typeof att.size === "number" && (
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {att.size >= 1048576 ? `${(att.size / 1048576).toFixed(1)} MB` : `${(att.size / 1024).toFixed(1)} KB`}
                                </span>
                              )}
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* ── Mobile: stacked view ──────────────────── */}
      <div className="md:hidden flex flex-col h-full min-h-0">
        {mobileView === "list" ? (
          /* Mobile list */
          <div className="flex flex-col gap-2 h-full min-h-0">
            <div className="shrink-0">
              <h1 className="text-lg font-bold">Inbox</h1>
              <p className="text-muted-foreground text-xs">{total} messages</p>
            </div>
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Search..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm"
              />
            </div>
            {selected.size > 0 && (
              <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 neu-convex rounded-xl text-xs">
                <span className="font-medium">{selected.size} selected</span>
                <div className="flex-1" />
                <button onClick={() => setBulkDeleteOpen(true)} disabled={actionLoading} className="px-2 py-1 neu-btn text-red-500 flex items-center gap-1">
                  <Trash2 className="h-3 w-3" /> Trash
                </button>
              </div>
            )}
            <div className="neu-flat overflow-y-auto flex-1 min-h-0">
              {loading ? (
                <MessageListSkeleton />
              ) : messages.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">No messages.</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {messages.map((msg) => (
                    <div key={msg.id} className="flex items-start gap-2 p-3 hover:bg-muted/30 transition-colors" onClick={() => selectMessage(msg.id)}>
                      <input
                        type="checkbox"
                        checked={selected.has(msg.id)}
                        onChange={(e) => { e.stopPropagation(); toggleSelect(msg.id); }}
                        className="h-3.5 w-3.5 rounded border-border accent-primary shrink-0 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {msg.is_pinned && <Pin className="h-3 w-3 text-primary shrink-0 fill-primary" />}
                          {msg.is_flagged && <Flag className="h-3 w-3 text-red-500 shrink-0 fill-red-500" />}
                          <p className="font-medium text-sm truncate">{msg.sender_name || "Anonymous"}</p>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{msg.subject}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColor(msg.status)}`}>
                            {msg.status.replace("_", " ")}
                          </span>
                          {msg.attachment_count ? <Paperclip className="h-3 w-3 text-muted-foreground" /> : null}
                          <span className="text-[10px] text-muted-foreground ml-auto">{new Date(msg.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  ))}
                </div>
              )}
            </div>
            {totalPages > 1 && (
              <div className="shrink-0 flex items-center justify-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 neu-btn text-xs disabled:opacity-50">Prev</button>
                <span className="text-xs text-muted-foreground">{page}/{totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1 neu-btn text-xs disabled:opacity-50">Next</button>
              </div>
            )}
          </div>
        ) : (
          /* Mobile detail */
          <div className="flex flex-col gap-3 h-full min-h-0">
            <button onClick={backToList} className="shrink-0 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back to inbox
            </button>
            {detailLoading ? (
              <MessageDetailSkeleton />
            ) : detailError ? (
              <div className="flex-1 flex items-center justify-center text-sm text-red-500">{detailError}</div>
            ) : detail ? (
              <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto">
                <div>
                  <h2 className="text-lg font-bold">{detail.subject}</h2>
                  <p className="text-sm text-muted-foreground">{detail.sender_name} &middot; {detail.sender_email}</p>
                </div>
                <div className="neu-flat rounded-xl p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{detail.body}</p>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* ── Modals & Dialogs ───────────────────────── */}

      {/* Tag modal */}
      <Dialog open={showTagModal} onOpenChange={setShowTagModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Tags</DialogTitle>
            <DialogDescription>Organize this message for easier filtering</DialogDescription>
          </DialogHeader>
          {detail && detail.tags.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Current tags</p>
              <div className="flex flex-wrap gap-2">
                {detail.tags.map((t) => (
                  <span key={t.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary text-xs rounded-full">
                    {t.name}
                    <button onClick={() => removeTag(t.id)} className="hover:text-destructive transition-colors" title={`Remove "${t.name}"`}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
          <form onSubmit={addTag} className="flex gap-2">
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Add a tag..."
              className="flex-1 px-3 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button type="submit" disabled={!tagInput.trim()} className="px-4 py-2 neu-btn text-sm font-medium disabled:opacity-50">
              Add
            </button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Note modal */}
      <Dialog open={showNoteModal} onOpenChange={setShowNoteModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Internal Notes</DialogTitle>
            <DialogDescription>Never visible to the client</DialogDescription>
          </DialogHeader>
          <form onSubmit={addNote} className="space-y-3">
            <textarea
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              rows={4}
              placeholder="Add an internal note..."
              className="w-full px-3 py-2.5 neu-concave rounded-xl bg-transparent text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
            <div className="flex justify-end">
              <button type="submit" disabled={!noteInput.trim()} className="px-4 py-2 neu-btn text-sm font-medium disabled:opacity-50">
                Add Note
              </button>
            </div>
          </form>
          {detail && detail.notes.length > 0 && (
            <div className="border-t border-border/50 pt-4 mt-2">
              <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Previous notes</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {detail.notes.slice().reverse().map((n) => (
                  <div key={n.id} className="p-3 neu-concave rounded-xl">
                    <p className="text-sm">{n.body}</p>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} &middot;{" "}
                      {new Date(n.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Single trash dialog */}
      <DeleteMessageDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Move to Trash?"
        message="This message will be moved to Trash and permanently deleted after the retention period."
        confirmLabel="Move to Trash"
        loading={actionLoading}
        onConfirm={() => deleteTarget && trashOne(deleteTarget.id)}
      />

      {/* Bulk trash dialog */}
      <DeleteMessageDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Move selected to Trash?"
        message={`This will move ${selected.size} message${selected.size !== 1 ? "s" : ""} to Trash.`}
        confirmLabel="Move to Trash"
        loading={actionLoading}
        onConfirm={bulkTrash}
      />
    </div>
  );
}
```

```tsx
// File: src\pages\admin\Roles.tsx
import { useState, useEffect } from "react";
import { ROUTES } from "../../lib/routes";
import { apiFetch } from "@/lib/adminApi";
import { getApiErrorMessage } from "@/lib/apiError";
import { useAuth } from "../../contexts/AuthContext";
import {
  Shield,
  ShieldCheck,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { NeuSelect } from "@/components/ui/select";
import { SkeletonTableRows } from "@/components/ui/skeleton";

interface RoleItem {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  level: number;
  user_count: number;
  permissions: string[];
}

interface PermissionItem {
  id: string;
  key: string;
  description: string | null;
  category: string | null;
}

const RANK_PRESETS = [
  { level: 80, label: "Admin-level (80)" },
  { level: 60, label: "Manager-level (60)" },
  { level: 40, label: "Support-level (40)" },
  { level: 20, label: "Viewer-level (20)" },
];

function capitalizeRole(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export default function RolesPage() {
  const { admin: currentAdmin } = useAuth();
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const canManageRoles = ["owner", "admin", "manager"].includes(currentAdmin?.role || "");
  const myLevel = currentAdmin?.role_level ?? null;

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [rolesRes, permsRes] = await Promise.all([
        apiFetch(ROUTES.ADMINAPIROLES),
        apiFetch(ROUTES.ADMINAPIPERMISSIONS),
      ]);
      if (rolesRes.ok) {
        const data = await rolesRes.json();
        setRoles(data.items || []);
      }
      if (permsRes.ok) {
        const data = await permsRes.json();
        setPermissions(data.items || []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(role: RoleItem) {
    setDeleteError("");
    try {
      const res = await apiFetch(ROUTES.ADMINAPIROLESBYID(role.id), { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const detail = getApiErrorMessage(data, "Failed to delete role");
        const messages: Record<string, string> = {
          role_in_use: `Cannot delete "${capitalizeRole(role.name)}" — one or more users still have this role.`,
          system_role_protected: "System roles cannot be deleted.",
          permission_denied: "You do not have permission to delete roles.",
        };
        setDeleteError(messages[detail] || detail);
        return;
      }
      load();
    } catch {
      setDeleteError("Network error while deleting role.");
    }
  }

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6" />
            Roles &amp; Permissions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Custom roles inherit nothing — pick exactly what they can do.
          </p>
        </div>
        {canManageRoles && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 neu-btn text-primary-foreground text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            Create Role
          </button>
        )}
      </div>

      {deleteError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50 shrink-0"
        >
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError("")} aria-label="Dismiss" className="shrink-0 hover:opacity-70 transition-opacity">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="neu-flat overflow-auto flex-1 min-h-0 text-foreground">
        <table className="w-full">
          <thead className="sticky top-0 z-10 border-b border-border/50 bg-background">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-bold text-foreground">Role</th>
              <th className="text-left px-4 py-3 text-sm font-bold text-foreground">Type</th>
              <th className="text-left px-4 py-3 text-sm font-bold text-foreground">Rank</th>
              <th className="text-left px-4 py-3 text-sm font-bold text-foreground">Users</th>
              <th className="text-left px-4 py-3 text-sm font-bold text-foreground">Permissions</th>
              {canManageRoles && <th className="w-10"></th>}
            </tr>
          </thead>
          {loading ? (
            <SkeletonTableRows rows={6} cols={canManageRoles ? 5 : 4} />
          ) : (
          <tbody>
            {roles.length === 0 ? (
              <tr>
                <td colSpan={canManageRoles ? 6 : 5} className="text-center py-8 text-muted-foreground">No roles found</td>
              </tr>
            ) : (
              roles.map((role) => (
                <tr key={role.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-primary" />
                      <span className="font-medium text-sm">{capitalizeRole(role.name)}</span>
                    </div>
                    {role.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 ml-6">{role.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      role.is_system
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                    }`}>
                      {role.is_system ? "System" : "Custom"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{role.level}</td>
                  <td className="px-4 py-3 text-sm">{role.user_count}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{role.permissions.length}</td>
                  {canManageRoles && (
                    <td className="px-4 py-3">
                      {!role.is_system && role.user_count === 0 && (
                        <button
                          onClick={() => handleDelete(role)}
                          title={`Delete ${capitalizeRole(role.name)}`}
                          className="p-1.5 rounded-xl text-red-600 dark:text-red-400 hover:bg-muted/50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
          )}
        </table>
      </div>

      {showCreate && (
        <CreateRoleDialog
          myLevel={myLevel}
          permissions={permissions}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
}

function CreateRoleDialog({ myLevel, permissions, onClose, onCreated }: {
  myLevel: number | null;
  permissions: PermissionItem[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const maxLevel = myLevel != null ? myLevel - 1 : 99;
  const availablePresets = RANK_PRESETS.filter((p) => p.level <= maxLevel);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rankMode, setRankMode] = useState<"preset" | "custom">(availablePresets.length > 0 ? "preset" : "custom");
  const [presetLevel, setPresetLevel] = useState<number>(availablePresets[0]?.level ?? Math.min(40, maxLevel));
  const [customLevel, setCustomLevel] = useState<string>(String(Math.max(1, Math.min(30, maxLevel))));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const effectiveLevel =
    rankMode === "preset" ? presetLevel : Math.max(1, Math.min(maxLevel, parseInt(customLevel, 10) || 1));

  const grouped = permissions.reduce<Record<string, PermissionItem[]>>((acc, p) => {
    const cat = p.category || "other";
    (acc[cat] = acc[cat] || []).push(p);
    return acc;
  }, {});

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch(ROUTES.ADMINAPIROLESCREATE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim().toLowerCase(),
          description: description.trim() || undefined,
          level: effectiveLevel,
          permissions: Array.from(selected),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(getApiErrorMessage(data, "Failed to create role"));
        return;
      }
      onCreated();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog onClose={onClose}>
      <h2 className="text-lg font-semibold mb-4">Create Custom Role</h2>
      {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Role Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. content-editor, temp-support"
            maxLength={64}
            className="w-full px-3 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <p className="mt-1 text-xs text-muted-foreground">Lowercase letters, numbers, dashes and underscores.</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this role for?"
            maxLength={200}
            className="w-full px-3 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Rank *</label>
          <div className="flex gap-2">
            {availablePresets.length > 0 && (
              <NeuSelect
                value={rankMode === "preset" ? String(presetLevel) : "custom"}
                onChange={(v) => {
                  if (v === "custom") setRankMode("custom");
                  else { setRankMode("preset"); setPresetLevel(parseInt(v, 10)); }
                }}
                options={[
                  ...availablePresets.map((p) => ({ value: String(p.level), label: p.label })),
                  { value: "custom", label: "Custom\u2026" },
                ]}
                className="flex-1"
              />
            )}
            {(rankMode === "custom" || availablePresets.length === 0) && (
              <input
                type="number"
                min={1}
                max={maxLevel}
                value={customLevel}
                onChange={(e) => setCustomLevel(e.target.value)}
                className="w-24 px-3 py-2 neu-concave rounded-xl bg-transparent text-sm"
              />
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Higher rank outranks lower. Max for you: {maxLevel}.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Permissions ({selected.size})</label>
          <div className="neu-concave rounded-xl p-3 max-h-56 overflow-y-auto space-y-3">
            {Object.entries(grouped).map(([category, perms]) => (
              <div key={category}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{category}</p>
                <div className="space-y-1">
                  {perms.map((p) => (
                    <label key={p.id} className="flex items-start gap-2 text-sm cursor-pointer hover:bg-muted/30 rounded-lg p-1 transition-colors">
                      <input
                        type="checkbox"
                        checked={selected.has(p.key)}
                        onChange={() => toggle(p.key)}
                        className="mt-0.5 accent-current"
                      />
                      <span>
                        <span className="font-mono text-xs">{p.key}</span>
                        {p.description && (
                          <span className="block text-xs text-muted-foreground">{p.description}</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm neu-btn text-foreground">Cancel</button>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="px-4 py-2 text-sm neu-btn text-primary-foreground font-semibold disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Role"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function Dialog({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative neu-convex w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-muted/50 transition-colors">
          <X className="w-4 h-4" />
        </button>
        {children}
      </div>
    </div>
  );
}
```

```tsx
// File: src\pages\admin\Settings.tsx
import { useEffect, useState } from "react";
import { ROUTES } from "@/lib/routes";
import { apiFetch } from "@/lib/adminApi";
import { getPasswordErrors } from "@/lib/passwordValidation";
import { Shield, Lock, Copy, Check, User, Trash2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { NeuSelect } from "@/components/ui/select";

export default function Settings() {
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [totpSecret, setTotpSecret] = useState("");
  const [provisioningUri, setProvisioningUri] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [retentionDays, setRetentionDays] = useState("30");
  const [retentionSaving, setRetentionSaving] = useState(false);

  useEffect(() => {
    apiFetch(ROUTES.ADMINAPISETTINGS)
      .then((r) => r.json())
      .then((data) => {
        setTotpEnabled(data.totp_enabled);
        if (data.trash_retention_days) setRetentionDays(String(data.trash_retention_days));
      })
      .catch(() => {});
  }, []);

  async function startTotpSetup() {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(ROUTES.ADMINAPITOTPSETUP);
      const data = await res.json();
      setTotpSecret(data.secret);
      setProvisioningUri(data.provisioning_uri || "");
      setShowSetup(true);
    } catch {
      setError("Failed to load TOTP setup");
    } finally {
      setLoading(false);
    }
  }

  async function enableTotp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(ROUTES.ADMINAPITOTPENABLE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: totpCode }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed" }));
        throw new Error(typeof err.detail === "string" ? err.detail : "Failed");
      }
      setTotpEnabled(true);
      setShowSetup(false);
      setProvisioningUri("");
      setMsg("TOTP enabled successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(totpSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement("textarea");
      el.value = totpSecret;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function disableTotp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(ROUTES.ADMINAPITOTPDISABLE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totp_code: totpCode }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed" }));
        throw new Error(typeof err.detail === "string" ? err.detail : "Failed");
      }
      setTotpEnabled(false);
      setShowSetup(false);
      setMsg("TOTP disabled successfully");
      setTotpCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    const pwErrors = getPasswordErrors(newPassword);
    if (pwErrors.length > 0) {
      setError(`Password requirements not met: ${pwErrors.join(", ")}`);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(ROUTES.ADMINAPICHANGEPASSWORD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed" }));
        throw new Error(typeof err.detail === "string" ? err.detail : "Failed");
      }
      setMsg("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveRetention() {
    setRetentionSaving(true);
    setError("");
    setMsg("");
    try {
      const res = await apiFetch(ROUTES.ADMINAPISETTINGS, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trash_retention_days: parseInt(retentionDays) }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setMsg("Retention period saved");
    } catch {
      setError("Failed to save retention period");
    }
    setRetentionSaving(false);
  }

  return (
    <div className="flex flex-col gap-4 h-full min-h-0 max-w-2xl overflow-auto">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your security settings</p>
      </div>

      {msg && <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-xl text-sm">{msg}</div>}
      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm">{error}</div>}

      <Tabs defaultValue="totp" className="flex flex-col min-h-0">
        <TabsList className="self-start">
          <TabsTrigger value="totp" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            TOTP
          </TabsTrigger>
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="trash" className="flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            Trash
          </TabsTrigger>
        </TabsList>

        <TabsContent value="totp">
          <div className="neu-flat p-6">
            <p className="text-sm text-muted-foreground mb-4">
              {totpEnabled ? "TOTP is currently enabled" : "TOTP is currently disabled"}
            </p>
            {!showSetup ? (
              totpEnabled ? (
                <div className="space-y-3">
                  <p className="text-sm">Enter your TOTP code to disable:</p>
                  <form onSubmit={disableTotp} className="flex gap-2">
                    <input
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      className="px-3 py-1 neu-concave rounded-xl text-foreground text-sm font-mono w-32 bg-transparent"
                      maxLength={6}
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                    <button type="submit" disabled={loading} className="px-4 py-1 neu-btn text-destructive-foreground text-sm bg-destructive">
                      Disable
                    </button>
                  </form>
                </div>
              ) : (
                <button onClick={startTotpSetup} disabled={loading} className="px-4 py-2 neu-btn text-primary-foreground text-sm font-semibold">
                  Enable TOTP
                </button>
              )
            ) : (
              <div className="space-y-4">
                {provisioningUri && (
                  <div className="flex justify-center">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(provisioningUri)}&size=200x200&margin=10`}
                      alt="TOTP QR Code"
                      className="rounded-xl"
                      width={200}
                      height={200}
                    />
                  </div>
                )}
                <div className="neu-concave p-4 rounded-xl">
                  <p className="text-xs text-muted-foreground mb-2">Add this secret to your authenticator app:</p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono break-all flex-1">{totpSecret}</code>
                    <button
                      onClick={copySecret}
                      className="p-1.5 rounded-lg hover:bg-muted/40 transition-colors shrink-0"
                      title="Copy secret"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>
                <form onSubmit={enableTotp} className="flex gap-2">
                  <input
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    className="px-3 py-1 neu-concave rounded-xl text-sm font-mono w-32 bg-transparent"
                    maxLength={6}
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <button type="submit" disabled={loading} className="px-4 py-1 neu-btn text-primary-foreground text-sm font-semibold">
                    Verify & Enable
                  </button>
                </form>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="profile">
          <div className="neu-flat p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 neu-btn rounded-xl">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <h2 className="font-semibold">Change Password</h2>
            </div>
            <form onSubmit={changePassword} className="space-y-3">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                className="w-full px-3 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm"
                required
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                className="w-full px-3 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm"
                required
                minLength={6}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full px-3 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm"
                required
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <button type="submit" disabled={loading} className="px-4 py-2 neu-btn text-primary-foreground text-sm font-semibold">
                Change Password
              </button>
            </form>
          </div>
        </TabsContent>

        <TabsContent value="trash">
          <div className="neu-flat p-6 space-y-4">
            <div>
              <h2 className="font-semibold mb-1">Message Trash</h2>
              <p className="text-sm text-muted-foreground">
                Deleted messages are automatically and permanently removed after the selected retention period.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Retention period</label>
              <NeuSelect
                value={retentionDays}
                onChange={setRetentionDays}
                options={[
                  { value: "7", label: "7 days" },
                  { value: "14", label: "14 days" },
                  { value: "30", label: "30 days" },
                  { value: "60", label: "60 days" },
                  { value: "90", label: "90 days" },
                  { value: "180", label: "180 days" },
                  { value: "365", label: "365 days" },
                ]}
                className="w-full sm:w-48"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              New deletions will be retained for {retentionDays} days. Changing this setting does not change the expiration date of messages already in Trash.
            </p>
            <div className="flex justify-end">
              <button
                onClick={saveRetention}
                disabled={retentionSaving}
                className="px-4 py-2 neu-btn text-sm font-medium"
              >
                {retentionSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

```tsx
// File: src\pages\admin\Setup.tsx
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ROUTES } from "@/lib/routes";
import { apiFetch } from "@/lib/adminApi";
import { getPasswordErrors } from "@/lib/passwordValidation";
import { Shield } from "lucide-react";

export default function Setup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);
  const [form, setForm] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    email: "",
    display_name: "",
  });

  const passwordErrors = getPasswordErrors(form.password);

  // Only render the setup form when the backend reports no admins exist.
  useEffect(() => {
    fetch(ROUTES.ADMINAPISETUPREQUIRED)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setSetupRequired(Boolean(data?.required)))
      .catch(() => setSetupRequired(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (passwordErrors.length > 0) {
      setError(`Password requirements not met: ${passwordErrors.join(", ")}`);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(ROUTES.ADMINAPISETUPCREATE, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username,
          password: form.password,
          email: form.email || null,
          display_name: form.display_name || form.username,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Setup failed" }));
        throw new Error(typeof err.detail === "string" ? err.detail : "Setup failed");
      }
      navigate("/vega/admin/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setLoading(false);
    }
  }

  if (setupRequired === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Checking setup status...</p>
      </div>
    );
  }

  if (!setupRequired) {
    return <Navigate to="/vega/admin/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-card border shadow-sm p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-primary/10 rounded-xl">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Initial Setup</h1>
            <p className="text-sm text-muted-foreground">Create your owner account</p>
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Username *</label>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              required
              autoFocus
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Display Name *</label>
            <input
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Email (optional)</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Password *</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              required
              minLength={12}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {form.password.length > 0 && passwordErrors.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {passwordErrors.map((rule) => (
                  <li key={rule}>• {rule}</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label className="text-sm font-medium">Confirm Password *</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              required
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <button type="submit" disabled={loading} className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
            {loading ? "Creating..." : "Create Owner Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

```tsx
// File: src\pages\admin\Trash.tsx
import { useEffect, useState } from "react";
import { ROUTES } from "@/lib/routes";
import { apiFetch } from "@/lib/adminApi";
import { Search, Trash2, RotateCcw } from "lucide-react";
import { NeuSelect } from "@/components/ui/select";
import DeleteMessageDialog from "@/components/admin/DeleteMessageDialog";
import { SkeletonListRows } from "@/components/ui/skeleton";

interface TrashMessage {
  id: string;
  reference: string;
  sender_name: string;
  sender_email: string;
  subject: string;
  deleted_at: string;
  trash_expires_at: string;
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  const exp = new Date(dateStr);
  return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function ExpiryBadge({ expiresAt }: { expiresAt: string }) {
  const days = daysUntil(expiresAt);
  if (days <= 0) return <span className="text-xs font-bold text-red-500">Expires today</span>;
  if (days <= 2) return <span className="text-xs font-bold text-red-500">Expires in {days} day{days !== 1 ? "s" : ""}</span>;
  if (days <= 7) return <span className="text-xs text-amber-600">Expires in {days} days</span>;
  return <span className="text-xs text-muted-foreground">Expires in {days} days</span>;
}

export default function Trash() {
  const [messages, setMessages] = useState<TrashMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [expiryFilter, setExpiryFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Dialogs
  const [deleteTarget, setDeleteTarget] = useState<TrashMessage | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [emptyTrashOpen, setEmptyTrashOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) params.set("search", search);
    if (expiryFilter) params.set("expiry", expiryFilter);
    apiFetch(`${ROUTES.ADMINAPITRASH}?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setMessages(data.items ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search, expiryFilter]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function restoreOne(id: string) {
    setActionLoading(true);
    try {
      await apiFetch(ROUTES.ADMINAPITRASHRESTORE(id), { method: "POST" });
      setMessages((prev) => prev.filter((m) => m.id !== id));
      setTotal((prev) => prev - 1);
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
    } catch {}
    setActionLoading(false);
  }

  async function deleteOne(id: string) {
    setActionLoading(true);
    try {
      await apiFetch(ROUTES.ADMINAPITRASHPERMANENT(id), { method: "DELETE" });
      setMessages((prev) => prev.filter((m) => m.id !== id));
      setTotal((prev) => prev - 1);
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
    } catch {}
    setActionLoading(false);
    setDeleteTarget(null);
  }

  async function bulkRestore() {
    setActionLoading(true);
    const ids = Array.from(selected);
    try {
      await apiFetch(ROUTES.ADMINAPITRASHBULKRESTORE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_ids: ids }),
      });
      setMessages((prev) => prev.filter((m) => !selected.has(m.id)));
      setTotal((prev) => prev - ids.length);
      setSelected(new Set());
    } catch {}
    setActionLoading(false);
  }

  async function bulkDelete() {
    setActionLoading(true);
    const ids = Array.from(selected);
    try {
      await apiFetch(ROUTES.ADMINAPITRASHBULKDELETE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_ids: ids }),
      });
      setMessages((prev) => prev.filter((m) => !selected.has(m.id)));
      setTotal((prev) => prev - ids.length);
      setSelected(new Set());
    } catch {}
    setActionLoading(false);
    setBulkDeleteOpen(false);
  }

  async function emptyTrash() {
    setActionLoading(true);
    try {
      await apiFetch(ROUTES.ADMINAPITRASHEMPTY, { method: "POST" });
      setTotal(0);
      setMessages([]);
      setSelected(new Set());
    } catch {}
    setActionLoading(false);
    setEmptyTrashOpen(false);
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* Header */}
      <div className="shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Trash</h1>
            <p className="text-muted-foreground text-sm">
              {total} deleted message{total !== 1 ? "s" : ""}
            </p>
          </div>
          {total > 0 && (
            <button
              onClick={() => setEmptyTrashOpen(true)}
              className="px-3 py-1.5 text-sm neu-btn text-red-500 flex items-center gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" /> Empty Trash
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search deleted messages..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm"
          />
        </div>
        <NeuSelect
          value={expiryFilter}
          onChange={(v) => { setExpiryFilter(v); setPage(1); }}
          options={[
            { value: "", label: "All" },
            { value: "7", label: "Expiring within 7 days" },
            { value: "30", label: "Expiring within 30 days" },
          ]}
          className="w-full sm:w-auto"
        />
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="shrink-0 flex items-center gap-3 px-4 py-2 neu-convex rounded-xl">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="flex-1" />
          <button
            onClick={bulkRestore}
            disabled={actionLoading}
            className="px-3 py-1.5 text-sm neu-btn flex items-center gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Restore selected
          </button>
          <button
            onClick={() => setBulkDeleteOpen(true)}
            disabled={actionLoading}
            className="px-3 py-1.5 text-sm neu-btn text-red-500 flex items-center gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete permanently
          </button>
        </div>
      )}

      {/* Message list */}
      <div className="neu-flat overflow-auto flex-1 min-h-0 text-foreground">
        {loading ? (
          <SkeletonListRows rows={8} />
        ) : messages.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Trash is empty.</div>
        ) : (
          <div className="divide-y divide-border/50">
            {messages.map((msg) => (
              <div key={msg.id} className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selected.has(msg.id)}
                  onChange={() => toggleSelect(msg.id)}
                  className="h-4 w-4 rounded border-border accent-primary shrink-0"
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{msg.sender_name || "Anonymous"}</p>
                    <span className="text-xs text-muted-foreground">({msg.sender_email})</span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{msg.subject}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground">
                      Deleted {new Date(msg.deleted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <ExpiryBadge expiresAt={msg.trash_expires_at} />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => restoreOne(msg.id)}
                    disabled={actionLoading}
                    className="px-2.5 py-1 text-xs neu-btn flex items-center gap-1"
                    title="Restore to Inbox"
                  >
                    <RotateCcw className="h-3 w-3" /> Restore
                  </button>
                  <button
                    onClick={() => setDeleteTarget(msg)}
                    disabled={actionLoading}
                    className="px-2.5 py-1 text-xs neu-btn text-red-500 flex items-center gap-1"
                    title="Delete forever"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 shrink-0">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 neu-btn text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 neu-btn text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Single permanent delete dialog */}
      <DeleteMessageDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Permanently delete message?"
        message={`This action cannot be undone. The message, attachments, notes and tags will be permanently removed.`}
        confirmLabel="Delete forever"
        danger
        loading={actionLoading}
        onConfirm={() => deleteTarget && deleteOne(deleteTarget.id)}
      />

      {/* Bulk permanent delete dialog */}
      <DeleteMessageDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Permanently delete selected messages?"
        message={`This will permanently delete ${selected.size} message${selected.size !== 1 ? "s" : ""}. This cannot be undone.`}
        confirmLabel="Delete permanently"
        danger
        loading={actionLoading}
        onConfirm={bulkDelete}
      />

      {/* Empty trash dialog */}
      <DeleteMessageDialog
        open={emptyTrashOpen}
        onOpenChange={setEmptyTrashOpen}
        title="Empty Trash?"
        message={`This will permanently delete all ${total} message${total !== 1 ? "s" : ""} currently in Trash. This cannot be undone.`}
        confirmLabel="Delete all forever"
        danger
        loading={actionLoading}
        onConfirm={emptyTrash}
      />
    </div>
  );
}
```

```tsx
// File: src\pages\admin\Users.tsx
import { useState, useEffect } from "react";
import { ROUTES } from "../../lib/routes";
import { apiFetch } from "@/lib/adminApi";
import { getApiErrorMessage } from "@/lib/apiError";
import { isPasswordValid } from "@/lib/passwordValidation";
import { useAuth } from "../../contexts/AuthContext";
import {
  Users as UsersIcon,
  Plus,
  Search,
  MoreVertical,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
  UserCog,
  KeyRound,
  RefreshCw,
  Ban,
  CheckCircle,
  Lock,
  Unlock,
  X,
  Check,
  Copy,
} from "lucide-react";
import { NeuSelect } from "@/components/ui/select";
import { Skeleton, SkeletonTableRows } from "@/components/ui/skeleton";

interface AdminUser {
  id: string;
  username: string;
  email: string | null;
  display_name: string;
  role: string;
  role_level: number | null;
  status: string;
  telegram_chat_id: string | null;
  totp_enabled: boolean;
  last_login_at: string | null;
  locked_until: string | null;
  failed_login_count: number;
  created_at: string | null;
  created_by: { id: string; username: string; display_name: string } | null;
}

interface RoleOption {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  level: number;
}

type AvailabilityStatus = "idle" | "checking" | "available" | "taken";

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  admin: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  manager: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  support: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  viewer: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400",
};

const ROLE_ICONS: Record<string, typeof Shield> = {
  owner: ShieldAlert,
  admin: ShieldCheck,
  manager: Shield,
  support: Shield,
  viewer: Eye,
};

function capitalizeRole(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function isSuspended(user: AdminUser): boolean {
  return !!user.locked_until && new Date(user.locked_until).getTime() > Date.now();
}

const TOP_THREE_ROLES = ["owner", "admin", "manager"];

export default function UsersPage() {
  const { admin: currentAdmin } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<AdminUser | null>(null);
  const [showTotpSetup, setShowTotpSetup] = useState<AdminUser | null>(null);
  const [showResetPassword, setShowResetPassword] = useState<AdminUser | null>(null);
  const [showTotpReset, setShowTotpReset] = useState<AdminUser | null>(null);
  const [showDisable, setShowDisable] = useState<AdminUser | null>(null);
  const [showRevoke, setShowRevoke] = useState<AdminUser | null>(null);
  const [showUnlock, setShowUnlock] = useState<AdminUser | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const res = await apiFetch(ROUTES.ADMINAPIUSERS);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.items || []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }

  const filtered = users.filter((u) => {
    if (search && !u.username.toLowerCase().includes(search.toLowerCase()) &&
        !u.display_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (roleFilter && u.role !== roleFilter) return false;
    if (statusFilter && u.status !== statusFilter) return false;
    return true;
  });

  const canManage = ["owner", "admin", "manager"].includes(currentAdmin?.role || "");
  const canUnlock =
    TOP_THREE_ROLES.includes(currentAdmin?.role || "") &&
    (currentAdmin?.role_level == null || currentAdmin.role_level >= 60);

  function canManageTarget(user: AdminUser): boolean {
    if (!currentAdmin) return false;
    if (currentAdmin.role === "owner") return true;
    const mine = currentAdmin.role_level;
    const theirs = user.role_level;
    if (mine == null || theirs == null) return currentAdmin.role === "admin";
    return mine > theirs;
  }

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UsersIcon className="w-6 h-6" />
            Users
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {users.length} administrator accounts
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 neu-btn text-primary-foreground text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            Create User
          </button>
        )}
      </div>

      <div className="flex gap-3 shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <NeuSelect
          value={roleFilter}
          onChange={setRoleFilter}
          options={[
            { value: "", label: "All Roles" },
            ...Array.from(new Set(users.map((u) => u.role))).sort().map((role) => ({
              value: role,
              label: capitalizeRole(role),
            })),
          ]}
          className="w-full sm:w-auto"
        />
        <NeuSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "", label: "All Status" },
            { value: "active", label: "Active" },
            { value: "disabled", label: "Disabled" },
          ]}
          className="w-full sm:w-auto"
        />
      </div>

      <div className="neu-flat overflow-auto flex-1 min-h-0 text-foreground">
        <table className="w-full">
          <thead className="sticky top-0 z-10 border-b border-border/50 bg-background">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-bold text-foreground">User</th>
              <th className="text-left px-4 py-3 text-sm font-bold text-foreground">Name</th>
              <th className="text-left px-4 py-3 text-sm font-bold text-foreground">Role</th>
              <th className="text-left px-4 py-3 text-sm font-bold text-foreground">Status</th>
              <th className="text-left px-4 py-3 text-sm font-bold text-foreground">Created By</th>
              <th className="text-left px-4 py-3 text-sm font-bold text-foreground">2FA</th>
              <th className="text-left px-4 py-3 text-sm font-bold text-foreground">Last Login</th>
              {canManage && <th className="w-10"></th>}
            </tr>
          </thead>
          {loading ? (
            <SkeletonTableRows rows={8} cols={canManage ? 7 : 6} />
          ) : (
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 8 : 7} className="text-center py-8 text-muted-foreground">No users found</td>
              </tr>
            ) : (
              filtered.map((user) => {
                const RoleIcon = ROLE_ICONS[user.role] || Shield;
                const manageTarget = canManage && canManageTarget(user);
                const unlockable = canUnlock && isSuspended(user);
                const hasActions = manageTarget || unlockable;
                return (
                  <tr key={user.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-sm">{user.username}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">{user.display_name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.role] || ""}`}>
                        <RoleIcon className="w-3 h-3" />
                        {capitalizeRole(user.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        user.status === "active"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }`}>
                        {user.status === "active" ? <CheckCircle className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                        {user.status}
                      </span>
                      {isSuspended(user) && (
                        <span
                          className="ml-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                          title={`Locked until ${new Date(user.locked_until!).toLocaleString()}`}
                        >
                          <Lock className="w-3 h-3" />
                          Suspended
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {user.created_by
                        ? (user.created_by.display_name || user.created_by.username)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {user.totp_enabled ? (
                        <span className="text-green-600 dark:text-green-400 font-medium">T+T</span>
                      ) : user.telegram_chat_id ? (
                        <span className="text-blue-600 dark:text-blue-400 font-medium">T</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {user.last_login_at
                        ? new Date(user.last_login_at).toLocaleDateString()
                        : "Never"}
                    </td>
                    {hasActions && (
                      <td className="px-4 py-3 relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === user.id ? null : user.id)}
                          className="p-1.5 rounded-xl hover:bg-muted/50 transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {openMenuId === user.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                            <div className="absolute right-0 top-full mt-1 z-50 w-52 neu-convex py-1">
                              {manageTarget && (
                                <>
                              <MenuItem icon={UserCog} label="Edit" onClick={() => { setShowEdit(user); setOpenMenuId(null); }} />
                              <MenuItem icon={KeyRound} label="Configure TOTP" onClick={() => { setShowTotpSetup(user); setOpenMenuId(null); }} />
                              <MenuItem icon={RefreshCw} label="Reset Password" onClick={() => { setShowResetPassword(user); setOpenMenuId(null); }} />
                              <MenuItem icon={RefreshCw} label="Reset TOTP" onClick={() => { setShowTotpReset(user); setOpenMenuId(null); }} danger={user.totp_enabled} />
                              <MenuItem icon={Ban} label="Revoke Sessions" onClick={() => { setShowRevoke(user); setOpenMenuId(null); }} />
                              {user.status === "active" ? (
                                <MenuItem icon={Ban} label="Disable User" onClick={() => { setShowDisable(user); setOpenMenuId(null); }} danger />
                              ) : (
                                <MenuItem icon={CheckCircle} label="Enable User" onClick={async () => {
                                  await apiFetch(ROUTES.ADMINAPIUSERENABLE(user.id), { method: "POST" });
                                  loadUsers();
                                  setOpenMenuId(null);
                                }} />
                              )}
                                </>
                              )}
                              {unlockable && (
                                <MenuItem
                                  icon={Unlock}
                                  label="Unlock Suspension"
                                  onClick={() => { setShowUnlock(user); setOpenMenuId(null); }}
                                />
                              )}
                            </div>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
          )}
        </table>
      </div>

      {showCreate && (
        <CreateUserDialog onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); loadUsers(); }} />
      )}
      {showEdit && (
        <EditUserDialog user={showEdit} onClose={() => setShowEdit(null)} onUpdated={() => { setShowEdit(null); loadUsers(); }} />
      )}
      {showTotpSetup && (
        <TotpSetupDialog user={showTotpSetup} onClose={() => setShowTotpSetup(null)} onDone={() => { setShowTotpSetup(null); loadUsers(); }} />
      )}
      {showResetPassword && (
        <ResetPasswordDialog user={showResetPassword} onClose={() => setShowResetPassword(null)} onDone={() => { setShowResetPassword(null); loadUsers(); }} />
      )}
      {showTotpReset && (
        <ConfirmDialog
          title="Reset TOTP"
          message="This will invalidate the user's authenticator configuration and require TOTP enrollment again."
          confirmLabel="Reset TOTP"
          danger
          onClose={() => setShowTotpReset(null)}
          onConfirm={async () => {
            await apiFetch(ROUTES.ADMINAPIUSERTOTPRESET(showTotpReset.id), { method: "POST" });
            setShowTotpReset(null);
            loadUsers();
          }}
        />
      )}
      {showDisable && (
        <ConfirmDialog
          title={`Disable ${showDisable.username}?`}
          message="The user will be logged out immediately and cannot log in until re-enabled."
          confirmLabel="Disable"
          danger
          onClose={() => setShowDisable(null)}
          onConfirm={async () => {
            await apiFetch(ROUTES.ADMINAPIUSERDISABLE(showDisable.id), { method: "POST" });
            setShowDisable(null);
            loadUsers();
          }}
        />
      )}
      {showRevoke && (
        <ConfirmDialog
          title={`Revoke sessions for ${showRevoke.username}?`}
          message="All active sessions for this user will be terminated."
          confirmLabel="Revoke"
          onClose={() => setShowRevoke(null)}
          onConfirm={async () => {
            await apiFetch(ROUTES.ADMINAPIUSERREVOKE(showRevoke.id), { method: "POST" });
            setShowRevoke(null);
          }}
        />
      )}
      {showUnlock && (
        <ConfirmDialog
          title={`Unlock ${showUnlock.username}?`}
          message="This clears the failed-login suspension immediately and resets the failed attempt counter, so the user can sign in again right away."
          confirmLabel="Unlock"
          onClose={() => setShowUnlock(null)}
          onConfirm={async () => {
            await apiFetch(ROUTES.ADMINAPIUSERUNLOCK(showUnlock.id), { method: "POST" });
            setShowUnlock(null);
            loadUsers();
          }}
        />
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: typeof Shield; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted/30 transition-colors ${
        danger ? "text-red-600 dark:text-red-400" : ""
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function useAssignableRoles(): RoleOption[] {
  const { admin: currentAdmin } = useAuth();
  const [roles, setRoles] = useState<RoleOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiFetch(ROUTES.ADMINAPIROLES)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.items) return;
        const items: RoleOption[] = data.items;
        if (currentAdmin?.role === "owner") {
          setRoles(items);
        } else {
          const mine = currentAdmin?.role_level ?? null;
          setRoles(mine == null ? items : items.filter((r) => r.level < mine));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentAdmin?.role, currentAdmin?.role_level]);

  return roles;
}

function CreateUserDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    username: "", display_name: "", email: "", password: "", confirmPassword: "", role: "support", telegram_chat_id: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [usernameStatus, setUsernameStatus] = useState<AvailabilityStatus>("idle");
  const [emailStatus, setEmailStatus] = useState<AvailabilityStatus>("idle");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const roles = useAssignableRoles();

  useEffect(() => {
    const value = form.username.trim();
    if (value.length < 3) {
      setUsernameStatus("idle");
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    setUsernameStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(
          `${ROUTES.ADMINAPIUSERSAVAILABILITY}?username=${encodeURIComponent(value)}`
        );
        if (cancelled || !res.ok) {
          if (!cancelled) setUsernameStatus("idle");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        const u = data.username;
        setUsernameStatus(u?.available ? "available" : u?.taken ? "taken" : "idle");
        setSuggestions(u?.suggestions || []);
      } catch {
        if (!cancelled) setUsernameStatus("idle");
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [form.username]);

  useEffect(() => {
    const value = form.email.trim();
    if (!value) {
      setEmailStatus("idle");
      return;
    }
    let cancelled = false;
    setEmailStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(
          `${ROUTES.ADMINAPIUSERSAVAILABILITY}?email=${encodeURIComponent(value)}`
        );
        if (cancelled || !res.ok) {
          if (!cancelled) setEmailStatus("idle");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        const e = data.email;
        setEmailStatus(e?.available ? "available" : e?.taken ? "taken" : "idle");
      } catch {
        if (!cancelled) setEmailStatus("idle");
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [form.email]);

  const passwordsMatch =
    form.confirmPassword.length > 0 && form.password === form.confirmPassword;

  const availabilityBlocked =
    usernameStatus === "taken" || emailStatus === "taken";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch(ROUTES.ADMINAPIUSERSCREATE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username,
          display_name: form.display_name,
          email: form.email || undefined,
          password: form.password,
          role: form.role,
          telegram_chat_id: form.telegram_chat_id || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(getApiErrorMessage(data, "Failed to create user"));
        return;
      }
      onCreated();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog onClose={onClose}>
      <h2 className="text-lg font-semibold mb-4">Create Admin User</h2>
      {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <AvailabilityInput
            label="Username *"
            value={form.username}
            onChange={(v) => setForm({ ...form, username: v })}
            placeholder="3-64 characters"
            status={usernameStatus}
          />
          {usernameStatus === "available" && (
            <p className="mt-1 text-xs text-green-600 dark:text-green-400">Username available</p>
          )}
          {usernameStatus === "taken" && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">Username already taken</p>
          )}
          {usernameStatus === "taken" && suggestions.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Try:</span>
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm({ ...form, username: s })}
                  className="px-2 py-0.5 rounded-lg neu-concave text-xs text-foreground hover:bg-muted/40 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
        <NeuInput label="Display Name *" value={form.display_name} onChange={(v) => setForm({ ...form, display_name: v })} />
        <div>
          <AvailabilityInput
            label="Email"
            type="email"
            value={form.email}
            onChange={(v) => setForm({ ...form, email: v })}
            status={emailStatus}
          />
          {emailStatus === "available" && (
            <p className="mt-1 text-xs text-green-600 dark:text-green-400">Email available</p>
          )}
          {emailStatus === "taken" && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">Email already registered</p>
          )}
        </div>
        <div>
          <PasswordInput
            label="Password *"
            value={form.password}
            onChange={(v) => setForm({ ...form, password: v })}
            visible={showPassword}
            onToggle={() => setShowPassword((v) => !v)}
          />
          <PasswordRequirements password={form.password} username={form.username} />
        </div>
        <div>
          <PasswordInput
            label="Confirm Password *"
            value={form.confirmPassword}
            onChange={(v) => setForm({ ...form, confirmPassword: v })}
            visible={showConfirmPassword}
            onToggle={() => setShowConfirmPassword((v) => !v)}
          />
          <MatchIndicator match={passwordsMatch} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Role *</label>
          <NeuSelect
            value={form.role}
            onChange={(v) => setForm({ ...form, role: v })}
            options={
              !roles.some((r) => r.name === form.role)
                ? [{ value: form.role, label: capitalizeRole(form.role) }, ...roles.map((r) => ({ value: r.name, label: capitalizeRole(r.name) }))]
                : roles.map((r) => ({ value: r.name, label: capitalizeRole(r.name) }))
            }
            className="w-full"
          />
        </div>
        <NeuInput label="Telegram Chat ID" value={form.telegram_chat_id} onChange={(v) => setForm({ ...form, telegram_chat_id: v })} placeholder="e.g. 123456789" />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm neu-btn text-foreground">Cancel</button>
          <button type="submit" disabled={
            loading ||
            !form.username ||
            !form.display_name ||
            availabilityBlocked ||
            !(isPasswordValid(form.password, form.username) && form.password === form.confirmPassword)
          } className="px-4 py-2 text-sm neu-btn text-primary-foreground font-semibold disabled:opacity-50">
            {loading ? "Creating..." : "Create User"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function EditUserDialog({ user, onClose, onUpdated }: { user: AdminUser; onClose: () => void; onUpdated: () => void }) {
  const { admin: currentAdmin } = useAuth();
  const [form, setForm] = useState({ display_name: user.display_name, email: user.email || "", role: user.role });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const roles = useAssignableRoles();
  const isSelf = currentAdmin?.id === user.id;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch(ROUTES.ADMINAPIUSERSBYID(user.id), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(getApiErrorMessage(data, "Failed to update"));
        return;
      }
      onUpdated();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog onClose={onClose}>
      <h2 className="text-lg font-semibold mb-4">Edit {user.username}</h2>
      {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <NeuInput label="Display Name" value={form.display_name} onChange={(v) => setForm({ ...form, display_name: v })} />
        <NeuInput label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <div>
          <label className="block text-sm font-medium mb-1">Role</label>
          <NeuSelect
            value={form.role}
            onChange={(v) => setForm({ ...form, role: v })}
            options={
              !roles.some((r) => r.name === form.role)
                ? [{ value: form.role, label: capitalizeRole(form.role) }, ...roles.map((r) => ({ value: r.name, label: capitalizeRole(r.name) }))]
                : roles.map((r) => ({ value: r.name, label: capitalizeRole(r.name) }))
            }
            disabled={isSelf}
            className="w-full"
          />
          {isSelf && (
            <p className="mt-1 text-xs text-muted-foreground">You cannot change your own role</p>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm neu-btn text-foreground">Cancel</button>
          <button type="submit" disabled={loading} className="px-4 py-2 text-sm neu-btn text-primary-foreground font-semibold disabled:opacity-50">
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function TotpSetupDialog({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: () => void }) {
  const [secret, setSecret] = useState("");
  const [otpauthUri, setOtpauthUri] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"loading" | "scan" | "done">("loading");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiFetch(ROUTES.ADMINAPIUSERTOTPSETUP(user.id))
      .then((r) => r.json())
      .then((data) => {
        setSecret(data.secret);
        setOtpauthUri(data.otpauth_uri || "");
        setStep("scan");
      })
      .catch(() => setError("Failed to load TOTP setup"));
  }, [user.id]);

  async function handleEnable() {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(ROUTES.ADMINAPIUSERTOTPENABLE(user.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(getApiErrorMessage(data, "Invalid code"));
        return;
      }
      setStep("done");
      setTimeout(onDone, 1000);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement("textarea");
      el.value = secret;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <Dialog onClose={onClose}>
      <h2 className="text-lg font-semibold mb-4">Configure TOTP for {user.username}</h2>
      {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm">{error}</div>}

      {step === "loading" && (
        <div className="flex flex-col items-center py-6">
          <Skeleton className="h-[200px] w-[200px] rounded-xl" />
          <Skeleton className="h-3 w-40 mt-4" />
        </div>
      )}

      {step === "scan" && (
        <>
          <p className="text-sm text-muted-foreground mb-3">
            Add this account to your authenticator app (Google Authenticator, Authy, etc.):
          </p>
          {otpauthUri && (
            <div className="flex justify-center mb-3">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(otpauthUri)}&size=200x200&margin=10`}
                alt="TOTP QR Code"
                className="rounded-xl"
                width={200}
                height={200}
              />
            </div>
          )}
          <div className="neu-concave p-3 rounded-xl mb-3">
            <p className="text-xs text-muted-foreground mb-1">Secret (manual entry):</p>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono break-all flex-1">{secret}</code>
              <button
                onClick={copySecret}
                className="p-1.5 rounded-lg hover:bg-muted/40 transition-colors shrink-0"
                title="Copy secret"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Enter 6-digit code from authenticator</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="w-full px-3 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm font-mono"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm neu-btn text-foreground">Cancel</button>
            <button onClick={handleEnable} disabled={loading || code.length !== 6} className="px-4 py-2 text-sm neu-btn text-primary-foreground font-semibold disabled:opacity-50">
              {loading ? "Verifying..." : "Verify & Enable"}
            </button>
          </div>
        </>
      )}

      {step === "done" && (
        <div className="text-center py-4">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
          <p className="font-medium">TOTP enabled successfully</p>
        </div>
      )}
    </Dialog>
  );
}

function ResetPasswordDialog({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const passwordsMatch = confirm.length > 0 && password === confirm;

  async function handleSubmit() {
    if (password !== confirm) { setError("Passwords do not match"); return; }
    setLoading(true);
    try {
      const res = await apiFetch(ROUTES.ADMINAPIUSERRESETPW(user.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_password: password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(getApiErrorMessage(data, "Failed"));
        return;
      }
      onDone();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog onClose={onClose}>
      <h2 className="text-lg font-semibold mb-4">Reset Password for {user.username}</h2>
      {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm">{error}</div>}
      <p className="text-sm text-muted-foreground mb-3">The user will be logged out after password reset.</p>
      <div>
        <PasswordInput
          label="New Password"
          value={password}
          onChange={setPassword}
          visible={showPassword}
          onToggle={() => setShowPassword((v) => !v)}
        />
        <PasswordRequirements password={password} username={user.username} />
      </div>
      <div>
        <PasswordInput
          label="Confirm Password"
          value={confirm}
          onChange={setConfirm}
          visible={showConfirm}
          onToggle={() => setShowConfirm((v) => !v)}
        />
        <MatchIndicator match={passwordsMatch} />
      </div>
      <div className="flex justify-end gap-2 pt-3">
        <button onClick={onClose} className="px-4 py-2 text-sm neu-btn text-foreground">Cancel</button>
        <button onClick={handleSubmit} disabled={loading || !isPasswordValid(password, user.username) || password !== confirm} className="px-4 py-2 text-sm neu-btn text-primary-foreground font-semibold disabled:opacity-50">
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </div>
    </Dialog>
  );
}

function ConfirmDialog({ title, message, confirmLabel, danger, onClose, onConfirm }: {
  title: string; message: string; confirmLabel: string; danger?: boolean;
  onClose: () => void; onConfirm: () => void;
}) {
  const [loading, setLoading] = useState(false);
  return (
    <Dialog onClose={onClose}>
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground mb-4">{message}</p>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm neu-btn text-foreground">Cancel</button>
        <button
          onClick={async () => { setLoading(true); await onConfirm(); }}
          disabled={loading}
          className={`px-4 py-2 text-sm neu-btn text-white font-semibold disabled:opacity-50 ${
            danger ? "bg-destructive" : "bg-primary"
          }`}
        >
          {loading ? "..." : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}

function PasswordInput({ label, value, onChange, visible, onToggle }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="new-password"
          className="w-full px-3 py-2 pr-11 neu-concave rounded-xl bg-transparent text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function AvailabilityInput({ label, type = "text", value, onChange, placeholder, status }: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  status: AvailabilityStatus;
}) {
  const ring =
    status === "available"
      ? "ring-1 ring-green-500/50 focus:ring-green-500/60"
      : status === "taken"
        ? "ring-1 ring-red-500/50 focus:ring-red-500/60"
        : "focus:ring-primary/50";
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full px-3 py-2 pr-10 neu-concave rounded-xl bg-transparent text-foreground text-sm focus:outline-none focus:ring-2 ${ring}`}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {status === "checking" && <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />}
          {status === "available" && <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />}
          {status === "taken" && <X className="w-4 h-4 text-red-600 dark:text-red-400" />}
        </span>
      </div>
    </div>
  );
}

function MatchIndicator({ match }: { match: boolean | null }) {
  if (match === null) return null;
  return (
    <div className={`mt-1 flex items-center gap-1 text-xs ${
      match ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
    }`}>
      {match ? (
        <>
          <CheckCircle className="w-3.5 h-3.5" />
          Passwords match
        </>
      ) : (
        <>
          <X className="w-3.5 h-3.5" />
          Passwords do not match
        </>
      )}
    </div>
  );
}

function PasswordRequirements({ password, username }: { password: string; username: string }) {
  if (!password) return null;

  return (
    <div className="mt-1 space-y-1">
      {[
        { label: "At least 12 characters", ok: password.length >= 12 },
        { label: "Uppercase letter", ok: /[A-Z]/.test(password) },
        { label: "Lowercase letter", ok: /[a-z]/.test(password) },
        { label: "Number", ok: /[0-9]/.test(password) },
        { label: "Special character", ok: /[^A-Za-z0-9]/.test(password) },
        { label: "No leading/trailing whitespace", ok: password === password.trim() },
        { label: "Not the same as username", ok: !username || password.toLowerCase() !== username.toLowerCase() },
      ].map((r) => (
        <div key={r.label} className="flex items-center gap-1.5 text-xs">
          {r.ok ? (
            <Check className="w-3 h-3 text-green-500" />
          ) : (
            <X className="w-3 h-3 text-red-400" />
          )}
          <span className={r.ok ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}>
            {r.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function Dialog({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative neu-convex w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-muted/50 transition-colors">
          <X className="w-4 h-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

function NeuInput({ label, type = "text", value, onChange, placeholder }: {
  label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
    </div>
  );
}
```

```tsx
// File: src\pages\AdminLogin.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { RateLimitError } from "../contexts/AuthContext";
import OtpDigitInput from "../components/OtpDigitInput";
import { AuthWebSocket } from "../lib/wsAuth";
import { loadTurnstile, renderTurnstile, resetTurnstile } from "../lib/turnstile";
import {
  ArrowRight, Loader2, Shield, MessageSquare, KeyRound,
  Clock, AlertTriangle, Lock,
} from "lucide-react";

type Step = "credentials" | "otp" | "totp";

function CooldownTimer({
  seconds,
  maxSeconds,
  variant,
}: {
  seconds: number;
  maxSeconds: number;
  variant: "warning" | "danger";
}) {
  const pct = maxSeconds > 0 ? (seconds / maxSeconds) * 100 : 0;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  const colors =
    variant === "danger"
      ? {
          bg: "bg-red-50 dark:bg-red-950/30",
          border: "border-red-200 dark:border-red-800/40",
          text: "text-red-700 dark:text-red-400",
          bar: "bg-red-500 dark:bg-red-400",
          icon: "text-red-500 dark:text-red-400",
        }
      : {
          bg: "bg-amber-50 dark:bg-amber-950/30",
          border: "border-amber-200 dark:border-amber-800/40",
          text: "text-amber-700 dark:text-amber-400",
          bar: "bg-amber-500 dark:bg-amber-400",
          icon: "text-amber-500 dark:text-amber-400",
        };

  return (
    <div className={`rounded-xl border p-4 ${colors.bg} ${colors.border}`}>
      <div className="flex items-center gap-3 mb-3">
        {variant === "danger" ? (
          <Lock className={`w-5 h-5 ${colors.icon}`} />
        ) : (
          <Clock className={`w-5 h-5 ${colors.icon}`} />
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${colors.text}`}>
            {variant === "danger" ? "Account temporarily suspended" : "Please wait"}
          </p>
          <p className={`text-xs mt-0.5 ${colors.text} opacity-80`}>
            {variant === "danger"
              ? "Too many failed password attempts — contact an administrator for earlier access"
              : "Too many failed attempts"}
          </p>
        </div>
        <span className={`text-2xl font-bold tabular-nums ${colors.text}`}>
          {timeStr}
        </span>
      </div>
      <div className={`h-1.5 rounded-full overflow-hidden ${variant === "danger" ? "bg-red-100 dark:bg-red-900/40" : "bg-amber-100 dark:bg-amber-900/40"}`}>
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-linear ${colors.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function AdminLogin() {
  const { login, exchangeForTokens } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from =
    (location.state as { from?: string } | null)?.from ??
    "/vega/admin/dashboard";

  const [step, setStep] = useState<Step>("credentials");
  const [transitioning, setTransitioning] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [otpCode, setOtpCode] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [otpError, setOtpError] = useState(false);
  const [totpError, setTotpError] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<AuthWebSocket | null>(null);

  // Turnstile CAPTCHA (initial credential submission only — not on each OTP step)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [turnstileError, setTurnstileError] = useState(false);
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetId = useRef<string | null>(null);

  // Rate limit cooldown state
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [cooldownMax, setCooldownMax] = useState(0);
  const [cooldownType, setCooldownType] = useState<"rate_limited" | "account_locked">("rate_limited");
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearCooldownTimer = useCallback(() => {
    if (cooldownRef.current) {
      clearInterval(cooldownRef.current);
      cooldownRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearCooldownTimer();
      wsRef.current?.disconnect();
      wsRef.current = null;
    };
  }, [clearCooldownTimer]);

  useEffect(() => {
    if (cooldownSeconds <= 0) {
      clearCooldownTimer();
      return;
    }
    cooldownRef.current = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearCooldownTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearCooldownTimer();
  }, [cooldownMax, clearCooldownTimer]);

  // Render the Turnstile widget when the credentials step is visible. Re-entering
  // this step mounts a fresh div, so the old widget handle must be removed and
  // the widget re-rendered into the new node.
  useEffect(() => {
    if (step !== "credentials") return;
    let cancelled = false;
    setCaptchaToken(null);
    setTurnstileError(false);

    const renderWidget = () => {
      const container = turnstileRef.current;
      if (cancelled || !container) return;
      try {
        if (turnstileWidgetId.current) {
          window.turnstile?.remove(turnstileWidgetId.current);
          turnstileWidgetId.current = null;
        }
        container.replaceChildren();
        const widgetId = window.turnstile
          ? renderTurnstile(
              container,
              (token) => setCaptchaToken(token),
              () => setCaptchaToken(null),
              () => setTurnstileError(true)
            )
          : null;
        if (!widgetId) {
          setTurnstileError(true);
          return;
        }
        turnstileWidgetId.current = widgetId;
      } catch (err) {
        console.error("[Turnstile] render failed:", err);
        setTurnstileError(true);
      }
    };

    // If the API is already available (e.g. navigated here in-app, or on a
    // re-render after session restore), render synchronously; otherwise rely
    // on the bounded loader and render once. That removes the failure mode
    // where loadTurnstile() was awaited while the container was still
    // gated behind the session check (hasDiv false) and never rendered.
    if (window.turnstile) {
      renderWidget();
    } else {
      loadTurnstile()
        .then(() => {
          if (!cancelled) renderWidget();
        })
        .catch((error) => {
          console.error("[Turnstile] init failed:", error);
          if (!cancelled) setTurnstileError(true);
        });
    }

    return () => {
      cancelled = true;
      if (turnstileWidgetId.current) {
        window.turnstile?.remove(turnstileWidgetId.current);
        turnstileWidgetId.current = null;
      }
    };
  }, [step]);

  function transitionTo(nextStep: Step) {
    setTransitioning(true);
    setTimeout(() => {
      setStep(nextStep);
      setTransitioning(false);
    }, 150);
  }

  function handleCooldownError(err: RateLimitError) {
    setCooldownSeconds(err.retryAfter);
    setCooldownMax(err.retryAfter);
    setCooldownType(
      err.limitType === "account_locked" ? "account_locked" : "rate_limited"
    );
    setError("");
  }

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await login(username, password, false, captchaToken ?? undefined);
      setOtpSent(false);
      setWsConnected(false);

      const ws = new AuthWebSocket({
        onConnected: () => setWsConnected(true),
        onOtpStatus: (status) => {
          if (status === "sent") setOtpSent(true);
        },
        onState: (state) => {
          if (state === "awaiting_totp") {
            transitionTo("totp");
          }
        },
        onAuthSuccess: async ({ exchange_code }) => {
          try {
            await exchangeForTokens(exchange_code);
            navigate(from, { replace: true });
          } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed");
            transitionTo("credentials");
          }
        },
        onError: (code, retryAfter) => {
          if (code === "rate_limited" && retryAfter) {
            setCooldownSeconds(retryAfter);
            setCooldownMax(retryAfter);
            setCooldownType("rate_limited");
          } else if (code === "invalid_code") {
            setOtpError(true);
          } else if (code === "connection_error") {
            setError("Connection lost. Please try again.");
          } else {
            setError("Verification failed. Please try again.");
          }
        },
        onClosed: () => setWsConnected(false),
      });
      wsRef.current = ws;
      ws.connect(result.ws_ticket);

      if (result.methods.includes("totp") && !result.methods.includes("telegram_otp")) {
        transitionTo("totp");
      } else if (result.methods.includes("telegram_otp")) {
        transitionTo("otp");
      } else {
        setError("No second-factor method configured for this account");
      }
    } catch (err) {
      if (err instanceof RateLimitError) {
        handleCooldownError(err);
      } else {
        setError(err instanceof Error ? err.message : "Login failed");
      }
    } finally {
      setLoading(false);
      // Turnstile tokens are single-use — reset and require a fresh token.
      resetTurnstile(turnstileWidgetId.current);
      setCaptchaToken(null);
    }
  }

  function handleOtpVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOtpError(false);
    if (otpCode.length === 6 && wsRef.current) {
      wsRef.current.verify("telegram_otp", otpCode);
    }
  }

  function handleTotpVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setTotpError(false);
    if (totpCode.length === 6 && wsRef.current) {
      wsRef.current.verify("totp", totpCode);
    }
  }

  const isLocked = cooldownSeconds > 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--color-cream)] via-[var(--color-cream)] to-[var(--color-pink-muted)] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 neu-convex rounded-2xl mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {step === "credentials" && "Sign in to your account"}
            {step !== "credentials" && "Two-step verification"}
          </p>
        </div>

        <div className="neu-convex px-8 py-10">
          {isLocked && (
            <div className="mb-4">
              <CooldownTimer
                seconds={cooldownSeconds}
                maxSeconds={cooldownMax}
                variant={cooldownType === "account_locked" ? "danger" : "warning"}
              />
            </div>
          )}

          {error && !isLocked && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="relative overflow-hidden">
            {step === "credentials" && (
              <div className={transitioning ? "login-step-exit" : "login-step-active"}>
                <form onSubmit={handleCredentials} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-4 py-2.5 neu-concave rounded-xl bg-transparent text-night-800 dark:text-cream-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      required
                      autoFocus
                      disabled={isLocked}
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-2.5 neu-concave rounded-xl bg-transparent text-night-800 dark:text-cream-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      required
                      disabled={isLocked}
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </div>
                  <div className="flex justify-center">
                    <div ref={turnstileRef} />
                  </div>

                  {turnstileError && (
                    <p className="text-xs text-red-600 dark:text-red-400 text-center">
                      Security verification failed to load. Please refresh the page.
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading || isLocked || !captchaToken || turnstileError}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/30 hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    {loading ? "Signing in..." : isLocked ? `Locked — wait ${cooldownSeconds}s` : "Sign In"}
                  </button>
                </form>
              </div>
            )}

            {step === "otp" && (
              <div className={transitioning ? "login-step-exit" : "login-step-active"}>
                <form onSubmit={handleOtpVerify} className="space-y-4">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
                    <MessageSquare className="w-4 h-4 shrink-0" />
                    <span>
                      {wsConnected && otpSent
                        ? "Code sent to your Telegram"
                        : wsConnected
                        ? "Enter the 6-digit code sent to your Telegram"
                        : "Establishing secure connection…"}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-center">OTP Code</label>
                    <OtpDigitInput
                      value={otpCode}
                      onChange={(v) => {
                        setOtpCode(v);
                        setOtpError(false);
                      }}
                      autoFocus
                      disabled={isLocked || !wsConnected}
                      error={otpError}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || otpCode.length !== 6 || isLocked || !wsConnected}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/30 hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    {loading ? "Verifying..." : "Verify Code"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { transitionTo("credentials"); setOtpCode(""); setError(""); setCooldownSeconds(0); wsRef.current?.disconnect(); wsRef.current = null; }}
                    className="w-full py-2 rounded-xl neu-concave text-sm font-medium text-muted-foreground hover:text-glow-600 dark:hover:text-glow-400 transition-colors"
                  >
                    Back to login
                  </button>
                </form>
              </div>
            )}

            {step === "totp" && (
              <div className={transitioning ? "login-step-exit" : "login-step-active"}>
                <form onSubmit={handleTotpVerify} className="space-y-4">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
                    <KeyRound className="w-4 h-4 shrink-0" />
                    <span>Enter the 6-digit code from your authenticator app</span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-center">TOTP Code</label>
                    <OtpDigitInput
                      value={totpCode}
                      onChange={(v) => {
                        setTotpCode(v);
                        setTotpError(false);
                      }}
                      autoFocus
                      disabled={isLocked || !wsConnected}
                      error={totpError}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || totpCode.length !== 6 || isLocked || !wsConnected}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/30 hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    {loading ? "Verifying..." : "Verify & Sign In"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { transitionTo("credentials"); setTotpCode(""); setError(""); setCooldownSeconds(0); wsRef.current?.disconnect(); wsRef.current = null; }}
                    className="w-full py-2 rounded-xl neu-concave text-sm font-medium text-muted-foreground hover:text-glow-600 dark:hover:text-glow-400 transition-colors"
                  >
                    Back to login
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

```tsx
// File: src\pages\Apps.tsx
import { site } from "@/config/site";

const categoryColors: Record<string, string> = {
  Android: "bg-glow-500",
  Web: "bg-mist-500",
};

const statusConfig: Record<string, { label: string; className: string }> = {
  live: { label: "Live", className: "status-live" },
  beta: { label: "Beta", className: "status-beta" },
  "coming-soon": { label: "Coming Soon", className: "status-coming-soon" },
};

function ShareIcon() {
  return (
    <svg
      className="h-7 w-7 text-glow-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
      />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg
      className="h-7 w-7 text-mist-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
      />
    </svg>
  );
}

const iconMap: Record<string, React.FC> = {
  share: ShareIcon,
  building: BuildingIcon,
};

export default function Apps() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-20">
      <h1 className="text-3xl md:text-4xl font-bold text-night-800 dark:text-cream-50 mb-4">
        Apps
      </h1>
      <p className="text-night-800/70 dark:text-cream-100/70 max-w-2xl mb-12">
        Applications I have developed — from mobile utilities to web management
        tools. Each app solves a specific problem with a clean, focused solution.
      </p>

      <div className="grid sm:grid-cols-2 gap-6">
        {site.apps.map((app, i) => {
          const Icon = iconMap[app.icon ?? ""] ?? ShareIcon;
          const status = statusConfig[app.status] ?? statusConfig["coming-soon"]!;
          return (
            <div
              key={app.title}
              className="reveal p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 flex flex-col"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-3">
                {"logo" in app && app.logo ? (
                  <img src={app.logo} alt={`${app.title} logo`} className="h-7 w-7 rounded-lg object-contain" />
                ) : (
                  <Icon />
                )}
                <span
                  className={`h-2 w-2 rounded-full ${categoryColors[app.category] ?? "bg-glow-500"}`}
                />
                <span className="text-xs font-medium text-night-800/50 dark:text-cream-100/50 uppercase tracking-wide">
                  {app.category}
                </span>
                <span className={`ml-auto text-xs px-2.5 py-0.5 rounded-full font-medium ${status.className}`}>
                  {status.label}
                </span>
              </div>

              {/* Title + Description */}
              <h3 className="font-semibold text-night-800 dark:text-cream-50 mb-2">
                {app.title}
              </h3>
              <p className="text-sm text-night-800/60 dark:text-cream-100/60 mb-4">
                {app.description}
              </p>

              {/* Screenshots */}
              {"screenshots" in app && app.screenshots && app.screenshots.length > 0 ? (
                <div className={`grid ${app.screenshots.length > 1 ? "grid-cols-2" : "grid-cols-1"} gap-2 mb-4`}>
                  {app.screenshots.map((src: string, idx: number) => (
                    <img
                      key={idx}
                      src={src}
                      alt={`${app.title} screenshot ${idx + 1}`}
                      className="h-36 w-full rounded-xl object-cover border border-cream-300 dark:border-night-600"
                    />
                  ))}
                </div>
              ) : (
                <div className="h-36 rounded-xl bg-cream-200 dark:bg-night-700 flex items-center justify-center mb-4 border border-cream-300 dark:border-night-600">
                  <span className="text-xs text-night-800/30 dark:text-cream-100/30">
                    Screenshot coming soon
                  </span>
                </div>
              )}

              {/* Features */}
              <ul className="text-sm text-night-800/60 dark:text-cream-100/60 mb-4 space-y-1.5 flex-1">
                {app.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-glow-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {/* Tech Stack */}
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-night-800/40 dark:text-cream-100/40 mb-2">
                  Tech Stack
                </p>
                <div className="flex flex-wrap gap-2">
                  {app.techStack.map((t) => (
                    <span
                      key={t}
                      className="text-xs px-2.5 py-1 rounded-full bg-glow-500/10 border border-glow-500/20 text-glow-600 dark:text-glow-400"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {app.tags.map((t) => (
                  <span
                    key={t}
                    className="text-xs px-2.5 py-1 rounded-full bg-cream-200 dark:bg-night-700 text-night-800/70 dark:text-cream-100/70"
                  >
                    {t}
                  </span>
                ))}
              </div>

              {/* CTA */}
              <a
                href={app.link.url}
                target={app.link.url.startsWith("http") ? "_blank" : undefined}
                rel={app.link.url.startsWith("http") ? "noopener noreferrer" : undefined}
                className={`inline-block text-center px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  app.link.url.startsWith("http")
                    ? "btn-primary bg-glow-500 text-white hover:bg-glow-600"
                    : "btn-outline border border-cream-300 dark:border-night-600 text-night-800/70 dark:text-cream-100/70 hover:bg-cream-200 dark:hover:bg-night-700"
                }`}
              >
                {app.link.label}
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

```tsx
// File: src\pages\Contact.tsx
import { useEffect, useRef, useState } from "react";
import { site } from "@/config/site";
import { ROUTES } from "@/lib/routes";
import {
  CONTACT_SITE_KEY,
  loadTurnstile,
  removeTurnstile,
  renderTurnstile,
  resetTurnstile,
} from "@/lib/turnstile";

/** FastAPI errors: {"detail": "msg"} or {"detail": [{msg}, ...]} on 422. */
function apiErrorMessage(data: unknown): string {
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string } | undefined;
    return first?.msg ?? "Invalid submission.";
  }
  return "";
}

function PhoneIcon() {
  return (
    <svg className="h-5 w-5 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="h-5 w-5 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg className="h-5 w-5 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg className="h-5 w-5 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="h-5 w-5 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="checklist-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function SuccessIcon() {
  return (
    <div
      className="contact-success-icon mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-sage-500/25 bg-sage-500/10"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-10 w-10 text-sage-500"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path className="contact-success-check" d="M5 12.5l4.25 4.25L19 7" />
      </svg>
    </div>
  );
}

const ALLOWED_EXTENSIONS = [
  "pdf", "doc", "docx", "xls", "xlsx", "csv", "txt",
  "png", "jpg", "jpeg", "gif", "webp",
];
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 5;

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function Contact() {
  const { contact, workingStyle, beforeContacting } = site;

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    projectType: "Legal Research",
    priority: "standard",
    message: "",
    honeypot: "", // bots fill this; humans never see it
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [fileWarnings, setFileWarnings] = useState<string[]>([]);
  // How many attached files the backend rejected on the last successful
  // submit — used to report delivered attachments accurately on the success
  // panel (a selected file is not proof the server stored it).
  const [lastSkipped, setLastSkipped] = useState(0);

  // ── Cloudflare Turnstile ──────────────────────────────────────────
  // The user must actively pass the challenge: the submit button stays
  // disabled until the callback hands us a token, and the backend re-verifies
  // it fail-closed. Widget mode is authoritative in the Cloudflare dashboard
  // (Mode = Managed), so `managed` + `always` below request a visible
  // checkbox rather than a passive auto-pass badge.
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState(false);
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCaptchaToken(null);
    setCaptchaError(false);

    const renderWidget = () => {
      const container = turnstileRef.current;
      if (cancelled || !container) return;
      try {
        removeTurnstile(turnstileWidgetId.current);
        turnstileWidgetId.current = null;
        // A remount (React strict mode double-invoke, or navigating back to
        // this page) leaves the old challenge in the node; clear it so we do
        // not stack two widgets in one container.
        container.replaceChildren();
        const widgetId = window.turnstile
          ? renderTurnstile(
              container,
              (token) => setCaptchaToken(token),
              () => setCaptchaToken(null),
              () => setCaptchaError(true),
              {
                action: "contact_form",
                siteKey: CONTACT_SITE_KEY,
                // Force an explicit human check instead of auto-verifying.
                mode: "managed",
                appearance: "always",
              }
            )
          : null;
        if (!widgetId) {
          setCaptchaError(true);
          return;
        }
        turnstileWidgetId.current = widgetId;
      } catch (err) {
        console.error("[Turnstile] render failed:", err);
        setCaptchaError(true);
      }
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      loadTurnstile()
        .then(() => {
          if (!cancelled) renderWidget();
        })
        .catch((error) => {
          console.error("[Turnstile] init failed:", error);
          if (!cancelled) setCaptchaError(true);
        });
    }

    return () => {
      cancelled = true;
      removeTurnstile(turnstileWidgetId.current);
      turnstileWidgetId.current = null;
    };
  }, []);

  const setField = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const addFiles = (incoming: File[]) => {
    const warnings: string[] = [];
    const next: File[] = [...files];
    for (const file of incoming) {
      const ext = file.name.includes(".")
        ? file.name.split(".").pop()!.toLowerCase()
        : "";
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        warnings.push(`${file.name} — unsupported file type. Use PDF, DOC, XLS, TXT, or an image.`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        warnings.push(`${file.name} — exceeds the 25MB limit.`);
        continue;
      }
      if (next.some((f) => f.name === file.name && f.size === file.size)) {
        continue;
      }
      if (next.length >= MAX_FILES) {
        warnings.push(`You can attach up to ${MAX_FILES} files.`);
        break;
      }
      next.push(file);
    }
    setFiles(next);
    setFileWarnings(warnings);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setFileWarnings([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSent(false);
    setFileWarnings([]);
    setSubmitting(true);
    try {
      const body = new FormData();
      body.append("name", form.name);
      body.append("email", form.email);
      body.append("phone", form.phone);
      body.append("project_type", form.projectType);
      body.append("priority", form.priority);
      body.append("message", form.message);
      body.append("honeypot", form.honeypot);
      body.append("turnstile_token", captchaToken ?? "");
      for (const file of files) {
        body.append("documents", file, file.name);
      }
      const res = await fetch(ROUTES.CONTACT, {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      // A successful FastAPI response is the created record itself — only
      // treat it as a failure when the HTTP status or the body says so.
      if (!res.ok || data?.ok === false) {
        throw new Error(
          apiErrorMessage(data) ||
          "Could not send your message. Please try again."
        );
      }
      const skipped = Array.isArray(data?.skipped) ? data.skipped : [];
      setSent(true);
      setLastSkipped(skipped.length);
      // Turnstile tokens are single-use — burn the widget and demand a fresh
      // one before the form can be submitted again. Form values, files and the
      // file input are intentionally kept populated so the success panel can
      // reference them; handleNewMessage clears everything instead.
      setCaptchaToken(null);
      resetTurnstile(turnstileWidgetId.current);
      setFileWarnings(skipped.length > 0 ? skipped.map((s: { filename?: string; reason?: string }) => {
        const reasons: Record<string, string> = {
          too_large: "exceeds the 25MB limit",
          unsupported_type: "unsupported file type",
          too_many_files: `more than ${MAX_FILES} files`,
          empty_file: "empty file",
          upload_failed: "could not be stored",
        };
        const reason = reasons[s.reason ?? ""] ?? "was rejected";
        return `${s.filename ?? "A file"} was not delivered (${reason}).`;
      }) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your message.");
    } finally {
      setSubmitting(false);
    }
  };

  /** Reset everything and start a fresh submission (used by the success
   *  panel's "Send another message"). Form values, files and the Turnstile
   *  token are all single-use per submission. */
  const handleNewMessage = () => {
    setSent(false);
    setError("");
    setFileWarnings([]);
    setLastSkipped(0);
    setForm({
      name: "",
      email: "",
      phone: "",
      projectType: "Legal Research",
      priority: "standard",
      message: "",
      honeypot: "",
    });
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setCaptchaToken(null);
    resetTurnstile(turnstileWidgetId.current);
  };

  // Attachments the server actually stored on the last submit — a selected
  // file that the backend rejected must not be reported as delivered.
  const submittedAttachmentCount = Math.max(0, files.length - lastSkipped);

  return (
    <div className="max-w-6xl mx-auto px-4 py-20">
      <h1 className="text-3xl md:text-4xl font-bold text-night-800 dark:text-cream-50 mb-4">
        Contact
      </h1>
      <p className="text-night-800/70 dark:text-cream-100/70 max-w-2xl mb-12">
        Ready to start a project? Reach out through any of the channels below.
        I typically respond within 24 hours.
      </p>

      <div className="grid lg:grid-cols-5 gap-8">
        {/* ── Left Column (3 cols) ──────────────── */}
        <div className="lg:col-span-3 space-y-8">
          {/* Contact Cards */}
          <div className="grid sm:grid-cols-2 gap-4">
            <a
              href={contact.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="card-hover flex items-center gap-3 p-5 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 hover:border-glow-500 transition-colors"
            >
              <PhoneIcon />
              <div>
                <p className="text-xs text-night-800/50 dark:text-cream-100/50">WhatsApp</p>
                <p className="text-sm font-medium text-night-800 dark:text-cream-50">{contact.phone}</p>
              </div>
            </a>

            <a
              href={`mailto:${contact.email}`}
              className="card-hover flex items-center gap-3 p-5 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 hover:border-glow-500 transition-colors"
            >
              <MailIcon />
              <div>
                <p className="text-xs text-night-800/50 dark:text-cream-100/50">Email</p>
                <p className="text-sm font-medium text-night-800 dark:text-cream-50">{contact.email}</p>
              </div>
            </a>

            <a
              href={contact.website}
              target="_blank"
              rel="noopener noreferrer"
              className="card-hover flex items-center gap-3 p-5 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 hover:border-glow-500 transition-colors"
            >
              <GlobeIcon />
              <div>
                <p className="text-xs text-night-800/50 dark:text-cream-100/50">Website</p>
                <p className="text-sm font-medium text-night-800 dark:text-cream-50">{contact.website}</p>
              </div>
            </a>

            <div className="card-hover flex items-center gap-3 p-5 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700">
              <MapPinIcon />
              <div>
                <p className="text-xs text-night-800/50 dark:text-cream-100/50">Location</p>
                <p className="text-sm font-medium text-night-800 dark:text-cream-50">{contact.location}</p>
              </div>
            </div>
          </div>

          {/* Before You Contact */}
          <div className="reveal p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700">
            <h2 className="text-lg font-semibold text-night-800 dark:text-cream-50 mb-4">
              Before You Contact
            </h2>
            <p className="text-sm text-night-800/60 dark:text-cream-100/60 mb-4">
              Having these ready helps us scope your project faster and give you a more accurate quote.
            </p>
            <ul className="space-y-3">
              {beforeContacting.map((item) => (
                <li key={item} className="checklist-item">
                  <CheckIcon />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Form */}
          <div
            className={`reveal overflow-hidden rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 contact-form-stage ${
              sent ? "is-sent" : ""
            }`}
          >
            {/* ── Form panel ─────────────────────────────── */}
            <div className="contact-form-panel p-6 md:p-7">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-night-800 dark:text-cream-50">
                    Send a Message
                  </h2>
                  <p className="mt-1 text-sm text-night-800/55 dark:text-cream-100/55">
                    Tell me what you need help with and I'll get back to you.
                  </p>
                </div>
                <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-glow-500/10 text-glow-500 sm:flex">
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.7}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75l-9.75 6-9.75-6" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6.75v10.5A2.25 2.25 0 005.25 19.5h13.5A2.25 2.25 0 0021 17.25V6.75" />
                  </svg>
                </div>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                {/* Name + Email */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-1.5">
                      Name
                    </label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setField("name", e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-cream-50 dark:bg-night-900 border border-cream-200 dark:border-night-600 text-sm text-night-800 dark:text-cream-100 placeholder:text-night-800/35 dark:placeholder:text-cream-100/35 focus:outline-none focus:ring-2 focus:ring-glow-500/15 focus:border-glow-500 transition-all duration-200"
                      placeholder="Your name"
                      autoComplete="name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setField("email", e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-cream-50 dark:bg-night-900 border border-cream-200 dark:border-night-600 text-sm text-night-800 dark:text-cream-100 placeholder:text-night-800/35 dark:placeholder:text-cream-100/35 focus:outline-none focus:ring-2 focus:ring-glow-500/15 focus:border-glow-500 transition-all duration-200"
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                  </div>
                </div>

                {/* Mobile + Project */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-1.5">
                      Mobile
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setField("phone", e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-cream-50 dark:bg-night-900 border border-cream-200 dark:border-night-600 text-sm text-night-800 dark:text-cream-100 placeholder:text-night-800/35 dark:placeholder:text-cream-100/35 focus:outline-none focus:ring-2 focus:ring-glow-500/15 focus:border-glow-500 transition-all duration-200"
                      placeholder="Your mobile number"
                      autoComplete="tel"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-1.5">
                      Project Type
                    </label>
                    <select
                      value={form.projectType}
                      onChange={(e) => setField("projectType", e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-cream-50 dark:bg-night-900 border border-cream-200 dark:border-night-600 text-sm text-night-800 dark:text-cream-100 focus:outline-none focus:ring-2 focus:ring-glow-500/15 focus:border-glow-500 transition-all duration-200"
                    >
                      <option>Legal Research</option>
                      <option>Contract Drafting</option>
                      <option>Data Analysis</option>
                      <option>Legal-Tech Integration</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-2">
                    Priority
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {(
                      [
                        ["standard", "Standard", "Normal response"],
                        ["urgent", "Urgent", "Needs faster attention"],
                      ] as Array<[string, string, string]>
                    ).map(([value, title, description]) => (
                      <label
                        key={value}
                        className={`cursor-pointer rounded-xl border px-4 py-3 transition-all duration-200 ${
                          form.priority === value
                            ? "border-glow-500 bg-glow-500/8 shadow-sm"
                            : "border-cream-200 dark:border-night-600 hover:border-glow-500/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="priority"
                          value={value}
                          checked={form.priority === value}
                          onChange={() => setField("priority", value)}
                          className="sr-only"
                        />
                        <span className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                              form.priority === value
                                ? "border-glow-500"
                                : "border-night-800/25 dark:border-cream-100/25"
                            }`}
                          >
                            {form.priority === value && (
                              <span className="h-2 w-2 rounded-full bg-glow-500" />
                            )}
                          </span>
                          <span>
                            <span className="block text-sm font-medium text-night-800 dark:text-cream-100">
                              {title}
                            </span>
                            <span className="mt-0.5 block text-xs text-night-800/45 dark:text-cream-100/45">
                              {description}
                            </span>
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Documents */}
                <div>
                  <label className="block text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-1.5">
                    Documents <span className="opacity-60">(optional)</span>
                  </label>
                  <label
                    htmlFor="contact-documents"
                    className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-cream-300 dark:border-night-600 bg-cream-50/70 dark:bg-night-900/60 px-5 py-6 text-center transition-all duration-200 hover:border-glow-500/60 hover:bg-glow-500/5"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-glow-500/10 text-glow-500 transition-transform duration-200 group-hover:scale-105">
                      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.7}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V3.75m0 0L7.5 8.25M12 3.75l4.5 4.5" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 13.5v4.125A2.625 2.625 0 007.875 20.25h8.25a2.625 2.625 0 002.625-2.625V13.5" />
                      </svg>
                    </span>
                    <span className="mt-3 text-sm font-medium text-night-800 dark:text-cream-100">
                      Add documents
                    </span>
                    <span className="mt-1 text-xs text-night-800/45 dark:text-cream-100/45">
                      PDF, DOC, XLS, TXT or images · up to 25MB each, max {MAX_FILES} files
                    </span>
                    <input
                      id="contact-documents"
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={(e) => {
                        if (e.target.files) addFiles(Array.from(e.target.files));
                        e.target.value = "";
                      }}
                      className="sr-only"
                    />
                  </label>
                  {fileWarnings.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {fileWarnings.map((warning) => (
                        <li
                          key={warning}
                          className="contact-message text-xs text-red-600 dark:text-red-400"
                        >
                          {warning}
                        </li>
                      ))}
                    </ul>
                  )}
                  {files.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {files.map((file, i) => (
                        <li
                          key={`${file.name}-${file.size}-${i}`}
                          className="contact-file-row flex items-center gap-3 px-3 py-2.5 rounded-xl bg-cream-50 dark:bg-night-900 border border-cream-200 dark:border-night-600 text-xs"
                          style={{ animationDelay: `${i * 45}ms` }}
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-glow-500/10 text-glow-500">
                            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={1.7}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 2.25H6.75A2.25 2.25 0 004.5 4.5v15A2.25 2.25 0 006.75 21.75h10.5a2.25 2.25 0 002.25-2.25V7.5l-5.25-5.25z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 2.25V7.5h5.25" />
                            </svg>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-night-800 dark:text-cream-100">
                              {file.name}
                            </span>
                            <span className="mt-0.5 block text-night-800/40 dark:text-cream-100/40">
                              {fmtBytes(file.size)}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFile(i)}
                            aria-label={`Remove ${file.name}`}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-night-800/40 dark:text-cream-100/40 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Message */}
                <div>
                  <label className="block text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-1.5">
                    Message
                  </label>
                  <textarea
                    rows={5}
                    required
                    value={form.message}
                    onChange={(e) => setField("message", e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-cream-50 dark:bg-night-900 border border-cream-200 dark:border-night-600 text-sm text-night-800 dark:text-cream-100 placeholder:text-night-800/35 dark:placeholder:text-cream-100/35 focus:outline-none focus:ring-2 focus:ring-glow-500/15 focus:border-glow-500 transition-all duration-200 resize-none"
                    placeholder="Tell me about your project..."
                  />
                </div>

                {/* Honeypot — hidden from humans, bots fill it. */}
                <input
                  type="text"
                  value={form.honeypot}
                  onChange={(e) => setField("honeypot", e.target.value)}
                  className="hidden"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                />

                {/* Human verification — must be passed before submitting. Not a <label>:
                  Turnstile renders inside a cross-origin iframe that carries its
                  own accessible name, so there is no control here to label. */}
                <div>
                  <p className="text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-1.5">
                    Verify you are human
                  </p>
                  <div ref={turnstileRef} />
                  {captchaError && (
                    <p className="contact-message text-xs text-red-600 dark:text-red-400 mt-1.5">
                      Could not load the security check. Please refresh the page and
                      try again.
                    </p>
                  )}
                </div>

                {error && (
                  <div
                    role="alert"
                    className="contact-message rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-600 dark:text-red-400"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !captchaToken || captchaError}
                  className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl bg-glow-500 px-6 py-3 text-sm font-medium text-white hover:bg-glow-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <span className="contact-submit-spinner" aria-hidden="true" />
                      <span>Sending message…</span>
                    </>
                  ) : !captchaToken && !captchaError ? (
                    "Verify you are human to send"
                  ) : (
                    <>
                      <span>Send Message</span>
                      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 3.75L10.5 14.25" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 3.75l-4.5 16.5-6.75-6-6-6.75 17.25-3.75z" />
                      </svg>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* ── Success panel ────────────────────────────── */}
            <div
              className="contact-success-panel flex items-center justify-center p-6 md:p-10"
              role="status"
              aria-live="polite"
            >
              <div className="w-full max-w-md text-center">
                <SuccessIcon />

                <div className="mt-7">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sage-500">
                    Message sent
                  </p>
                  <h2 className="mt-2 text-2xl md:text-3xl font-bold text-night-800 dark:text-cream-50">
                    Thank you{form.name ? `, ${form.name}` : ""}.
                  </h2>
                  <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-night-800/60 dark:text-cream-100/60">
                    Your message has been received successfully. I'll review your request
                    and get back to you within 24 hours.
                  </p>
                </div>

                <div className="mx-auto mt-8 max-w-sm overflow-hidden rounded-2xl border border-cream-200 dark:border-night-600 bg-cream-50/70 dark:bg-night-900/60 text-left">
                  <div className="border-b border-cream-200 dark:border-night-600 px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-night-800/40 dark:text-cream-100/40">
                      Submission received
                    </p>
                  </div>
                  <div className="space-y-3 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sage-500/10 text-sage-500">
                        ✓
                      </span>
                      <span className="text-sm text-night-800 dark:text-cream-100">
                        Your details were submitted
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sage-500/10 text-sage-500">
                        ✓
                      </span>
                      <span className="text-sm text-night-800 dark:text-cream-100">
                        {submittedAttachmentCount > 0
                          ? `${submittedAttachmentCount} attachment${submittedAttachmentCount === 1 ? "" : "s"} received`
                          : "No attachments were included"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sage-500/10 text-sage-500">
                        ✓
                      </span>
                      <span className="text-sm text-night-800 dark:text-cream-100">
                        You'll receive a response within 24 hours
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleNewMessage}
                  className="btn-outline mt-8 inline-flex items-center justify-center gap-2 rounded-xl border border-cream-300 dark:border-night-600 px-5 py-2.5 text-sm font-medium text-night-800 dark:text-cream-100 hover:bg-cream-200 dark:hover:bg-night-700"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 101.98-5.1" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5v5h5" />
                  </svg>
                  Send another message
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Column (2 cols) ─────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Response Time */}
          <div className="reveal card-hover p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700">
            <div className="flex items-center gap-3 mb-3">
              <ClockIcon />
              <h3 className="font-semibold text-night-800 dark:text-cream-50">
                Response Time
              </h3>
            </div>
            <p className="text-2xl font-bold text-glow-600 dark:text-glow-400 mb-1">
              {workingStyle.responseTime}
            </p>
            <p className="text-sm text-night-800/60 dark:text-cream-100/60">
              I check messages regularly and aim to get back to you within one business day.
            </p>
          </div>

          {/* Working Style */}
          <div className="reveal card-hover p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700">
            <h3 className="font-semibold text-night-800 dark:text-cream-50 mb-4">
              Working Style
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-night-800/40 dark:text-cream-100/40 mb-0.5">
                  Availability
                </p>
                <p className="text-sm text-night-800 dark:text-cream-100">{workingStyle.availability}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-night-800/40 dark:text-cream-100/40 mb-0.5">
                  Communication
                </p>
                <p className="text-sm text-night-800 dark:text-cream-100">{workingStyle.communication}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-night-800/40 dark:text-cream-100/40 mb-0.5">
                  Timezone
                </p>
                <p className="text-sm text-night-800 dark:text-cream-100">{workingStyle.timezone}</p>
              </div>
            </div>
          </div>

          {/* Confidentiality */}
          <div className="reveal card-hover p-6 rounded-2xl bg-glow-500/10 border border-glow-500/30">
            <p className="text-sm text-night-800 dark:text-cream-100">
              <strong className="text-glow-600 dark:text-glow-400">Confidentiality guaranteed.</strong>{" "}
              All communications and project details are handled under strict NDA. Your privacy is paramount.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

```tsx
// File: src\pages\Freelance.tsx
import { site } from "@/config/site";

function ScaleIcon() {
  return (
    <svg className="h-7 w-7 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.589-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.589-1.202L5.25 4.971z" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg className="h-7 w-7 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="h-7 w-7 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg className="h-7 w-7 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

const iconMap: Record<string, React.FC> = {
  scale: ScaleIcon,
  document: DocumentIcon,
  chart: ChartIcon,
  gear: GearIcon,
};

export default function Freelance() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-20">
      <h1 className="text-3xl md:text-4xl font-bold text-night-800 dark:text-cream-50 mb-4">
        Freelance Services
      </h1>
      <p className="text-night-800/70 dark:text-cream-100/70 max-w-2xl mb-12">
        Professional legal and tech services tailored to your needs. Each engagement
        starts with a clear scope, transparent pricing, and strict confidentiality.
      </p>

      {/* ── Services ────────────────────────────── */}
      <section className="mb-16">
        <div className="grid sm:grid-cols-2 gap-6">
          {site.services.map((s, i) => {
            const Icon = iconMap[s.icon] ?? ScaleIcon;
            return (
              <div
                key={s.title}
                className="reveal card-hover p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 flex flex-col"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <Icon />
                <h3 className="mt-4 font-semibold text-night-800 dark:text-cream-50">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm text-night-800/60 dark:text-cream-100/60 leading-relaxed">
                  {s.description}
                </p>

                <div className="mt-5 pt-4 border-t border-cream-200 dark:border-night-700 space-y-3 flex-1">
                  {/* Ideal For */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-night-800/50 dark:text-cream-100/50 mb-1.5">
                      Ideal For
                    </p>
                    <ul className="space-y-1">
                      {s.idealFor.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-night-800/70 dark:text-cream-100/70">
                          <span className="mt-1.5 h-1 w-1 rounded-full bg-glow-500 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Deliverables */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-night-800/50 dark:text-cream-100/50 mb-1.5">
                      Deliverables
                    </p>
                    <ul className="space-y-1">
                      {s.deliverables.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-night-800/70 dark:text-cream-100/70">
                          <span className="mt-1.5 h-1 w-1 rounded-full bg-glow-500 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Turnaround + Pricing */}
                  <div className="flex flex-wrap gap-3 pt-2">
                    <span className="text-xs px-3 py-1.5 rounded-full bg-cream-200 dark:bg-night-700 text-night-800/70 dark:text-cream-100/70 font-medium">
                      {s.turnaround}
                    </span>
                    <span className="text-xs px-3 py-1.5 rounded-full bg-glow-500/10 border border-glow-500/20 text-glow-600 dark:text-glow-400 font-medium">
                      {s.pricingModel}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Working Principles ──────────────────── */}
      <section>
        <h2 className="text-xl font-semibold text-night-800 dark:text-cream-50 mb-6">
          Working Principles
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {site.principles.map((p, i) => (
            <div
              key={p.title}
              className="reveal card-hover p-5 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <h3 className="font-semibold text-glow-500 mb-2">{p.title}</h3>
              <p className="text-sm text-night-800/60 dark:text-cream-100/60 leading-relaxed">
                {p.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
```

```tsx
// File: src\pages\Home.tsx
import { Link } from "react-router-dom";
import { site } from "@/config/site";

function ScaleIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg className={`${className} text-glow-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.589-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.589-1.202L5.25 4.971z" />
    </svg>
  );
}

function ChartIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg className={`${className} text-glow-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function ShieldIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg className={`${className} text-glow-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function CalendarIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`${className} text-glow-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}

function DiamondIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`${className} text-glow-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      {/* Real diamond outline — previously a copy of the bolt path. */}
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.75l8.25 8.25L12 20.25 3.75 12 12 3.75z" />
    </svg>
  );
}

function MagnifierIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`${className} text-glow-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function BoltIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`${className} text-glow-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function ClockIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`${className} text-glow-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

const highlightIconMap: Record<string, React.FC<{ className?: string }>> = {
  scale: ScaleIcon,
  chart: ChartIcon,
  shield: ShieldIcon,
};

const heroProofIconMap: Record<string, React.FC<{ className?: string }>> = {
  scale: ScaleIcon,
  chart: ChartIcon,
  clock: ClockIcon,
};

const whyHireIconMap: Record<string, React.FC<{ className?: string }>> = {
  shield: ShieldIcon,
  calendar: CalendarIcon,
  diamond: DiamondIcon,
  magnifier: MagnifierIcon,
  bolt: BoltIcon,
};

export default function Home() {
  return (
    <div>
      {/* ── Hero ──────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 py-20 md:py-28">
        <div className="grid md:grid-cols-5 gap-12 items-start">
          <div className="md:col-span-3">
            <p className="text-sm font-medium text-glow-500 mb-4 tracking-wide">
              {site.tagline}
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-night-800 dark:text-cream-50 mb-6 leading-tight">
              {site.name}
            </h1>
            <p className="text-lg text-night-800/70 dark:text-cream-100/70 max-w-xl mb-10 leading-relaxed">
              {site.description}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/freelance"
                className="btn-primary inline-block px-6 py-3 rounded-xl bg-glow-500 text-white font-medium hover:bg-glow-600 text-center"
              >
                View Services
              </Link>
              <Link
                to="/contact"
                className="btn-outline inline-block px-6 py-3 rounded-xl border border-night-300 dark:border-night-500 bg-white/70 dark:bg-night-800 font-medium text-center hover:border-glow-500 hover:text-glow-600 dark:hover:text-glow-400 transition-colors"
              >
                Get in Touch
              </Link>
            </div>
          </div>

          <div className="md:col-span-2 flex flex-col gap-4">
            {site.heroProof.map((badge) => {
              const Icon = heroProofIconMap[badge.icon] ?? ShieldIcon;
              return (
                <div
                  key={badge.label}
                  className="card-hover flex items-center gap-4 p-5 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700"
                >
                  <Icon className="h-6 w-6 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-night-800 dark:text-cream-100">
                      {badge.label}
                    </p>
                    <p className="text-xs text-night-800/60 dark:text-cream-100/60 mt-0.5">
                      {badge.detail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Trust Badges Row (mobile) ─────────────── */}
      <section className="md:hidden max-w-6xl mx-auto px-4 pb-12">
        <div className="flex gap-3 overflow-x-auto">
          {site.heroProof.map((badge) => {
            const Icon = heroProofIconMap[badge.icon] ?? ShieldIcon;
            return (
              <div
                key={badge.label}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 shrink-0"
              >
                <Icon className="h-4 w-4" />
                <span className="text-xs font-medium text-night-800 dark:text-cream-100 whitespace-nowrap">
                  {badge.label}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Highlights ────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 pb-20">
        <h2 className="sr-only">What I Do</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {site.highlights.map((h, i) => {
            const Icon = highlightIconMap[h.icon] ?? ScaleIcon;
            return (
              <div
                key={h.title}
                className="reveal card-hover p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700"
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <Icon />
                <h3 className="mt-4 font-semibold text-night-800 dark:text-cream-50">
                  {h.title}
                </h3>
                <p className="mt-2 text-sm text-night-800/60 dark:text-cream-100/60">
                  {h.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Why Hire Me ───────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 pb-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-night-800 dark:text-cream-50">
            Why Hire Me
          </h2>
          <div className="mt-3 h-1 w-12 mx-auto rounded-full bg-glow-500" />
        </div>
        {/* Flex-wrap (not grid) so the 2-card bottom row centers
            instead of leaving a hole at the end of a 3-column track. */}
        <div className="flex flex-wrap justify-center gap-6">
          {site.whyHireMe.map((item, i) => {
            const Icon = whyHireIconMap[item.icon] ?? ShieldIcon;
            return (
              <div
                key={item.title}
                className="reveal card-hover w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <Icon className="h-6 w-6" />
                <h3 className="mt-3 font-semibold text-night-800 dark:text-cream-50">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-night-800/60 dark:text-cream-100/60 leading-relaxed">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
```

```tsx
// File: src\pages\NotFound.tsx
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-32 text-center">
      <p className="text-6xl font-bold text-glow-500 mb-4">404</p>
      <h1 className="text-2xl font-semibold text-night-800 dark:text-cream-50 mb-2">
        Page Not Found
      </h1>
      <p className="text-night-800/60 dark:text-cream-100/60 mb-8">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        to="/"
        className="inline-block px-6 py-3 rounded-xl bg-glow-500 text-white font-medium hover:bg-glow-600 transition-colors"
      >
        Back to Home
      </Link>
    </div>
  );
}
```

```tsx
// File: src\pages\Portfolio.tsx
import { site } from "@/config/site";

const categoryColors: Record<string, string> = {
  Legal: "bg-sage-500",
  Tech: "bg-mist-500",
};

const categoryBorderColors: Record<string, string> = {
  Legal: "border-l-sage-500",
  Tech: "border-l-mist-500",
};

export default function Portfolio() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-20">
      <h1 className="text-3xl md:text-4xl font-bold text-night-800 dark:text-cream-50 mb-4">
        Portfolio
      </h1>
      <p className="text-night-800/70 dark:text-cream-100/70 max-w-2xl mb-12">
        Selected projects across legal research and technology. Each project follows
        a structured approach: understand the problem, design the solution, deliver measurable outcomes.
      </p>

      <div className="grid sm:grid-cols-2 gap-6">
        {site.projects.map((p, i) => (
          <div
            key={p.title}
            className={`reveal p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 border-l-4 ${categoryBorderColors[p.category] ?? "border-l-glow-500"} flex flex-col`}
            style={{ transitionDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span
                className={`h-2 w-2 rounded-full ${categoryColors[p.category] ?? "bg-glow-500"}`}
              />
              <span className="text-xs font-medium text-night-800/50 dark:text-cream-100/50 uppercase tracking-wide">
                {p.category}
              </span>
            </div>

            <h3 className="font-semibold text-night-800 dark:text-cream-50 mb-4">
              {p.title}
            </h3>

            <div className="space-y-3 flex-1">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-night-800/40 dark:text-cream-100/40 mb-1">
                  Problem
                </p>
                <p className="text-sm text-night-800/70 dark:text-cream-100/70 leading-relaxed">
                  {p.problem}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-night-800/40 dark:text-cream-100/40 mb-1">
                  Solution
                </p>
                <p className="text-sm text-night-800/70 dark:text-cream-100/70 leading-relaxed">
                  {p.solution}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-night-800/40 dark:text-cream-100/40 mb-1">
                  Outcome
                </p>
                <p className="text-sm text-night-800/70 dark:text-cream-100/70 leading-relaxed">
                  {p.outcome}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-cream-200 dark:border-night-700">
              {p.tags.map((t) => (
                <span
                  key={t}
                  className="text-xs px-2.5 py-1 rounded-full bg-cream-200 dark:bg-night-700 text-night-800/70 dark:text-cream-100/70"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

```typescript
// File: src\vite-env.d.ts
/// <reference types="vite/client" />
```

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src", "vite-env.d.ts"]
}
```

```typescript
// File: vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    hmr: { clientPort: 443 },
    proxy: {
      // Dev only: forward /api to the local FastAPI backend.
      // Production routes /api through the Cloudflare Pages function instead.
      "/api": {
        target: process.env.VITE_API_ORIGIN || "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
```
