# Multi-User Admin + Collapsible Sidebar — Implementation Plan

## Goal
- Make sidebar collapsible (persist state in localStorage)
- Rename route `/admin-users` → `/users` (with redirect)
- Build full RBAC system (roles + permissions)
- Build per-user TOTP management
- Build user CRUD UI (create, edit, disable, reset password, manage 2FA)
- Auto-migrate existing vega user to new RBAC system
- Owner + admin can manage users

## Scope: 4 Phases (all in this session)

---

## Phase 1 — Collapsible Sidebar + Route Rename

### Files to modify
- `src/pages/admin/AdminLayout.tsx`
- `src/App.tsx`
- `src/lib/routes.ts`

### AdminLayout.tsx
- Add `const [collapsed, setCollapsed] = useState(() => localStorage.getItem("admin-sidebar-collapsed") === "true")`
- Toggle function: `setCollapsed(prev => { localStorage.setItem(...); return !prev })`
- Sidebar className: `collapsed ? "w-16" : "w-64"` with `transition-all duration-200`
- When collapsed: hide text labels, keep icons, add `title` for tooltip
- Add toggle button (PanelLeftClose/PanelLeftOpen from lucide-react) in sidebar header
- Keep logout accessible in both states
- Active route highlighting works in both states

### App.tsx
- Change `<Route path="admin-users" element={<AdminUsersPage />} />` to `<Route path="users" element={<AdminUsersPage />} />`
- Add redirect: `<Route path="admin-users" element={<Navigate to="/vega/admin/users" replace />} />`

### routes.ts
- Add new route constants for user management API endpoints

---

## Phase 2 — RBAC Backend

### New database tables

```
admin_roles
  id          UUID PK DEFAULT gen_random_uuid()
  name        VARCHAR(64) UNIQUE NOT NULL
  description TEXT
  is_system   BOOLEAN DEFAULT false
  created_at  TIMESTAMPTZ DEFAULT now()
  updated_at  TIMESTAMPTZ DEFAULT now()

admin_permissions
  id          UUID PK DEFAULT gen_random_uuid()
  key         VARCHAR(128) UNIQUE NOT NULL
  description TEXT
  category    VARCHAR(64)

admin_role_permissions
  role_id       UUID FK -> admin_roles(id) ON DELETE CASCADE
  permission_id UUID FK -> admin_permissions(id) ON DELETE CASCADE
  PRIMARY KEY (role_id, permission_id)
```

### Roles (seeded)
| Name | Description | Permissions |
|------|-------------|-------------|
| owner | Full system access | ALL |
| admin | Administrative access | dashboard.view, messages.*, users.view, users.create, users.update, users.disable, users.reset_password, settings.view, audit_logs.view |
| manager | Message management | dashboard.view, messages.*, settings.view |
| support | Support agent | dashboard.view, messages.view, messages.update, messages.notes |
| viewer | Read-only | dashboard.view, messages.view |

### Permissions (seeded)
```
dashboard.view          - View dashboard
messages.view           - View messages
messages.update         - Update message status/priority
messages.delete         - Delete messages
messages.notes          - Add internal notes
messages.tags           - Manage tags
users.view              - View user list
users.create            - Create users
users.update            - Update user details
users.disable           - Disable/enable users
users.delete            - Delete users
users.reset_password    - Reset user passwords
users.manage_2fa        - Reset user TOTP
settings.view           - View settings
settings.update         - Update settings
audit_logs.view         - View audit logs
roles.view              - View roles
roles.manage            - Create/edit roles
```

### Changes to admin_users table
- Add `role_id UUID FK -> admin_roles(id)` (nullable initially)
- After migration: set role_id based on existing `role` enum value
- Make NOT NULL after migration

### New backend files
- `backend/app/models_rbac.py` — SQLAlchemy models for roles, permissions, role_permissions
- `backend/app/api/admin_users.py` — User CRUD endpoints
- `backend/app/api/admin_totp.py` — Per-user TOTP endpoints
- `backend/app/api/admin_roles.py` — Role/permission endpoints
- `backend/app/deps.py` — Add `require_permission()` dependency

### API endpoints

**User management** (`/admin/api/users`):
```
GET    /admin/api/users                      -- List users (owner + admin)
POST   /admin/api/users                      -- Create user (owner + admin)
GET    /admin/api/users/{id}                 -- Get user detail
PUT    /admin/api/users/{id}                 -- Update user
POST   /admin/api/users/{id}/disable         -- Disable user
POST   /admin/api/users/{id}/enable          -- Enable user
POST   /admin/api/users/{id}/revoke-sessions -- Revoke sessions
POST   /admin/api/users/{id}/reset-password  -- Admin reset password
```

**Per-user TOTP** (`/admin/api/users/{id}/totp`):
```
GET    /admin/api/users/{id}/totp/setup      -- Generate secret + URI
POST   /admin/api/users/{id}/totp/enable     -- Verify code, enable
POST   /admin/api/users/{id}/totp/disable    -- Verify code, disable
POST   /admin/api/users/{id}/totp/reset      -- Owner/admin resets (no code needed)
```

**Roles** (`/admin/api/roles`):
```
GET    /admin/api/roles                      -- List roles with permissions
GET    /admin/api/permissions                -- List all permissions
```

### Login flow changes
- `POST /auth/login`: derive `methods` from user's actual config (not global settings)
- `telegram_otp` included if user has `telegram_chat_id`
- `totp` included if `admin.totp_enabled`
- Always require Telegram OTP as first factor (compulsory)
- TOTP is optional second factor (if enabled for that user)

---

## Phase 3 — Database Migration

### Migration 002_rbac.py
1. Create `admin_roles` table
2. Create `admin_permissions` table
3. Create `admin_role_permissions` junction table
4. Seed 5 roles + ~18 permissions + mappings
5. Add `role_id` UUID FK to `admin_users`
6. Migrate existing users: set `role_id` based on current `role` enum
7. Add NOT NULL constraint on `role_id`
8. Update admin role default to reference the role UUID

### Auto-migration logic
```sql
-- For each existing admin_users row:
UPDATE admin_users SET role_id = (
  SELECT id FROM admin_roles WHERE name = admin_users.role::text
);
```

---

## Phase 4 — Users UI

### New/modified files
- `src/pages/admin/Users.tsx` (replaces AdminUsers.tsx)
- `src/components/admin/CreateUserDialog.tsx`
- `src/components/admin/EditUserDialog.tsx`
- `src/components/admin/TotpSetupDialog.tsx`
- `src/components/admin/ResetPasswordDialog.tsx`
- `src/components/admin/UserActionsMenu.tsx`
- `src/lib/routes.ts` (add new API routes)

### Users page layout
```
┌──────────────────────────────────────────────────────────────┐
│ Users                                      + Create User     │
│ N administrator accounts                                    │
├──────────────────────────────────────────────────────────────┤
│ Search users...                       Role ▼  Status ▼       │
├──────────┬────────────┬─────────┬─────────┬──────┬───────────┤
│ User     │ Name       │ Role    │ Status  │ 2FA  │ Actions   │
├──────────┼────────────┼─────────┼─────────┼──────┼───────────┤
│ vega     │ Vijay      │ Owner   │ Active  │ T+T  │ ⋮         │
│ rahul    │ Rahul      │ Admin   │ Active  │ T+T  │ ⋮         │
│ amit     │ Amit       │ Support │ Active  │ T    │ ⋮         │
└──────────┴────────────┴─────────┴─────────┴──────┴───────────┘
```

### Actions menu per user
- View (read-only detail)
- Edit (display name, email)
- Change Role
- Reset Password → confirmation dialog
- Configure TOTP → QR code flow
- Reset TOTP → confirmation dialog
- Revoke Sessions → confirmation dialog
- Disable/Enable toggle

### Create User dialog fields
- Username * (3-64 chars)
- Display Name *
- Email
- Password * + Confirm Password *
- Role * (dropdown, owner only can assign owner)
- Telegram Chat ID * (with "Send Test OTP" verification)
- Status: Active (default)

### TOTP Setup dialog
- GET `/users/{id}/totp/setup` → returns `secret` + `otpauth_uri`
- Show QR code (use `otpauth://` URI rendered as QR)
- Show raw secret as text fallback
- 6-digit code input
- POST `/users/{id}/totp/enable` with `{ code, secret }`
- Success → TOTP enabled

### TOTP Reset confirmation
- "This will invalidate the user's authenticator configuration and require TOTP enrollment again."
- [Cancel] [Reset TOTP]
- POST `/users/{id}/totp/reset`

### Permission-aware UI
- Check `admin.role` to determine what actions to show
- Owner: can do everything
- Admin: can manage users (except other admins/owners)
- Manager/Support/Viewer: read-only user list

---

## Implementation Order

1. **Backend migration** (002_rbac.py) — create tables, seed data, migrate existing user
2. **Backend RBAC models** (models_rbac.py) — SQLAlchemy models
3. **Backend deps.py** — add `require_permission()`
4. **Backend user API** (admin_users.py) — CRUD endpoints
5. **Backend TOTP API** (admin_totp.py) — per-user TOTP
6. **Backend roles API** (admin_roles.py) — role/permission endpoints
7. **Backend auth.py** — update login flow for per-user methods
8. **Frontend AdminLayout.tsx** — collapsible sidebar
9. **Frontend App.tsx + routes.ts** — route rename + new routes
10. **Frontend Users.tsx** — full user management page
11. **Frontend dialogs** — Create, Edit, TOTP, Reset Password
12. **Deploy** — upload to server, rebuild backend, push to GitHub
