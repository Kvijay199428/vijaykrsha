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
