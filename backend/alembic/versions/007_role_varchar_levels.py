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
