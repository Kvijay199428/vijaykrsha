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
