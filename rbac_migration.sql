
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
