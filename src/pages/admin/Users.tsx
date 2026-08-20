import { useState, useEffect } from "react";
import { ROUTES } from "../../lib/routes";
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
  UserCog,
  KeyRound,
  RefreshCw,
  Ban,
  CheckCircle,
  Trash2,
  X,
} from "lucide-react";

interface AdminUser {
  id: string;
  username: string;
  email: string | null;
  display_name: string;
  role: string;
  status: string;
  telegram_chat_id: string | null;
  totp_enabled: boolean;
  last_login_at: string | null;
  created_at: string | null;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}

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

export default function UsersPage() {
  const { admin: currentAdmin } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Dialogs
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<AdminUser | null>(null);
  const [showTotpSetup, setShowTotpSetup] = useState<AdminUser | null>(null);
  const [showResetPassword, setShowResetPassword] = useState<AdminUser | null>(null);
  const [showTotpReset, setShowTotpReset] = useState<AdminUser | null>(null);
  const [showDisable, setShowDisable] = useState<AdminUser | null>(null);
  const [showRevoke, setShowRevoke] = useState<AdminUser | null>(null);

  useEffect(() => {
    loadUsers();
    loadRoles();
  }, []);

  async function loadUsers() {
    try {
      const res = await fetch(ROUTES.ADMINAPIUSERS, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.items || []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }

  async function loadRoles() {
    try {
      const res = await fetch(ROUTES.ADMINAPIROLES, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setRoles(data.items || []);
      }
    } catch {
    }
  }

  const filtered = users.filter((u) => {
    if (search && !u.username.toLowerCase().includes(search.toLowerCase()) &&
        !u.display_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (roleFilter && u.role !== roleFilter) return false;
    if (statusFilter && u.status !== statusFilter) return false;
    return true;
  });

  const canManage = currentAdmin?.role === "owner" || currentAdmin?.role === "admin";

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
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
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Create User
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg bg-background text-sm"
        >
          <option value="">All Roles</option>
          <option value="owner">Owner</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="support">Support</option>
          <option value="viewer">Viewer</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg bg-background text-sm"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">User</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Name</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Role</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">2FA</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Last Login</th>
              {canManage && <th className="w-10"></th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-muted-foreground">No users found</td>
              </tr>
            ) : (
              filtered.map((user) => {
                const RoleIcon = ROLE_ICONS[user.role] || Shield;
                return (
                  <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <span className="font-medium text-sm">{user.username}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">{user.display_name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.role] || ""}`}>
                        <RoleIcon className="w-3 h-3" />
                        {user.role}
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
                    {canManage && (
                      <td className="px-4 py-3 relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === user.id ? null : user.id)}
                          className="p-1 rounded hover:bg-accent"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {openMenuId === user.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                            <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-card border rounded-lg shadow-lg py-1">
                              <MenuItem icon={UserCog} label="Edit" onClick={() => { setShowEdit(user); setOpenMenuId(null); }} />
                              <MenuItem icon={KeyRound} label="Configure TOTP" onClick={() => { setShowTotpSetup(user); setOpenMenuId(null); }} />
                              <MenuItem icon={RefreshCw} label="Reset Password" onClick={() => { setShowResetPassword(user); setOpenMenuId(null); }} />
                              <MenuItem icon={RefreshCw} label="Reset TOTP" onClick={() => { setShowTotpReset(user); setOpenMenuId(null); }} danger={user.totp_enabled} />
                              <MenuItem icon={Ban} label="Revoke Sessions" onClick={() => { setShowRevoke(user); setOpenMenuId(null); }} />
                              {user.status === "active" ? (
                                <MenuItem icon={Ban} label="Disable User" onClick={() => { setShowDisable(user); setOpenMenuId(null); }} danger />
                              ) : (
                                <MenuItem icon={CheckCircle} label="Enable User" onClick={async () => {
                                  await fetch(ROUTES.ADMINAPIUSERENABLE(user.id), { method: "POST", credentials: "include" });
                                  loadUsers();
                                  setOpenMenuId(null);
                                }} />
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
        </table>
      </div>

      {/* Dialogs */}
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
            await fetch(ROUTES.ADMINAPIUSERTOTPRESET(showTotpReset.id), { method: "POST", credentials: "include" });
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
            await fetch(ROUTES.ADMINAPIUSERDISABLE(showDisable.id), { method: "POST", credentials: "include" });
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
            await fetch(ROUTES.ADMINAPIUSERREVOKE(showRevoke.id), { method: "POST", credentials: "include" });
            setShowRevoke(null);
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
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent ${
        danger ? "text-red-600 dark:text-red-400" : ""
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

// ── Create User Dialog ───────────────────────────────────────────────────────

function CreateUserDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    username: "", display_name: "", email: "", password: "", confirmPassword: "", role: "support", telegram_chat_id: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(ROUTES.ADMINAPIUSERS, {
        method: "POST",
        credentials: "include",
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
        setError(data.detail || "Failed to create user");
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
      {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input label="Username *" value={form.username} onChange={(v) => setForm({ ...form, username: v })} />
        <Input label="Display Name *" value={form.display_name} onChange={(v) => setForm({ ...form, display_name: v })} />
        <Input label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <Input label="Password *" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
        <Input label="Confirm Password *" type="password" value={form.confirmPassword} onChange={(v) => setForm({ ...form, confirmPassword: v })} />
        <div>
          <label className="block text-sm font-medium mb-1">Role *</label>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="support">Support</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>
        <Input label="Telegram Chat ID" value={form.telegram_chat_id} onChange={(v) => setForm({ ...form, telegram_chat_id: v })} placeholder="e.g. 123456789" />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-accent">Cancel</button>
          <button type="submit" disabled={loading} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {loading ? "Creating..." : "Create User"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

// ── Edit User Dialog ─────────────────────────────────────────────────────────

function EditUserDialog({ user, onClose, onUpdated }: { user: AdminUser; onClose: () => void; onUpdated: () => void }) {
  const [form, setForm] = useState({ display_name: user.display_name, email: user.email || "", role: user.role });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(ROUTES.ADMINAPIUSERSBYID(user.id), {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "Failed to update");
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
      {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input label="Display Name" value={form.display_name} onChange={(v) => setForm({ ...form, display_name: v })} />
        <Input label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <div>
          <label className="block text-sm font-medium mb-1">Role</label>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="support">Support</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-accent">Cancel</button>
          <button type="submit" disabled={loading} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

// ── TOTP Setup Dialog ────────────────────────────────────────────────────────

function TotpSetupDialog({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: () => void }) {
  const [secret, setSecret] = useState("");
  const [uri, setUri] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"loading" | "scan" | "done">("loading");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(ROUTES.ADMINAPIUSERTOTPSETUP(user.id), { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setSecret(data.secret);
        setUri(data.otpauth_uri);
        setStep("scan");
      })
      .catch(() => setError("Failed to load TOTP setup"));
  }, [user.id]);

  async function handleEnable() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(ROUTES.ADMINAPIUSERTOTPENABLE(user.id), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, secret }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "Invalid code");
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

  return (
    <Dialog onClose={onClose}>
      <h2 className="text-lg font-semibold mb-4">Configure TOTP for {user.username}</h2>
      {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}

      {step === "loading" && <p className="text-muted-foreground text-sm">Loading...</p>}

      {step === "scan" && (
        <>
          <p className="text-sm text-muted-foreground mb-3">
            Add this account to your authenticator app (Google Authenticator, Authy, etc.):
          </p>
          <div className="bg-muted p-3 rounded-lg mb-3">
            <p className="text-xs text-muted-foreground mb-1">Secret (manual entry):</p>
            <code className="text-sm font-mono break-all">{secret}</code>
          </div>
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Enter 6-digit code from authenticator</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              maxLength={6}
              className="w-full px-3 py-2 border rounded-lg bg-background text-sm font-mono"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-accent">Cancel</button>
            <button onClick={handleEnable} disabled={loading || code.length !== 6} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
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

// ── Reset Password Dialog ────────────────────────────────────────────────────

function ResetPasswordDialog({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (password !== confirm) { setError("Passwords do not match"); return; }
    setLoading(true);
    try {
      const res = await fetch(ROUTES.ADMINAPIUSERRESETPW(user.id), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_password: password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "Failed");
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
      {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}
      <p className="text-sm text-muted-foreground mb-3">The user will be logged out after password reset.</p>
      <Input label="New Password" type="password" value={password} onChange={setPassword} />
      <Input label="Confirm Password" type="password" value={confirm} onChange={setConfirm} />
      <div className="flex justify-end gap-2 pt-3">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-accent">Cancel</button>
        <button onClick={handleSubmit} disabled={loading || password.length < 6} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </div>
    </Dialog>
  );
}

// ── Confirm Dialog ───────────────────────────────────────────────────────────

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
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-accent">Cancel</button>
        <button
          onClick={async () => { setLoading(true); await onConfirm(); }}
          disabled={loading}
          className={`px-4 py-2 text-sm rounded-lg text-white disabled:opacity-50 ${
            danger ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary/90"
          }`}
        >
          {loading ? "..." : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}

// ── Shared Dialog wrapper ────────────────────────────────────────────────────

function Dialog({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border rounded-xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded hover:bg-accent">
          <X className="w-4 h-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

// ── Shared Input ─────────────────────────────────────────────────────────────

function Input({ label, type = "text", value, onChange, placeholder }: {
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
        className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
    </div>
  );
}
