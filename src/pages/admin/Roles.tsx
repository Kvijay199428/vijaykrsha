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
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={canManageRoles ? 6 : 5} className="text-center py-8 text-muted-foreground">Loading...</td>
              </tr>
            ) : roles.length === 0 ? (
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
