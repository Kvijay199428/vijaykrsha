import { useEffect, useState } from "react";
import { ROUTES } from "@/lib/routes";

interface AdminUser {
  id: string;
  username: string;
  email: string;
  display_name: string;
  role: string;
  status: string;
  totp_enabled: boolean;
  last_login_at: string;
  created_at: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(ROUTES.ADMINAPIUSERS, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setUsers(data.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Users</h1>
          <p className="text-muted-foreground text-sm">{users.length} admin accounts</p>
        </div>
      </div>

      <div className="rounded-xl bg-card border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : (
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="text-left p-4 text-sm font-medium">Username</th>
                <th className="text-left p-4 text-sm font-medium">Display Name</th>
                <th className="text-left p-4 text-sm font-medium">Role</th>
                <th className="text-left p-4 text-sm font-medium">Status</th>
                <th className="text-left p-4 text-sm font-medium">TOTP</th>
                <th className="text-left p-4 text-sm font-medium">Last Login</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30">
                  <td className="p-4 text-sm font-medium">{u.username}</td>
                  <td className="p-4 text-sm">{u.display_name}</td>
                  <td className="p-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      u.role === "owner" ? "bg-purple-100 text-purple-700" :
                      u.role === "admin" ? "bg-blue-100 text-blue-700" :
                      "bg-slate-100 text-slate-700"
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="p-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      u.status === "active" ? "bg-green-100 text-green-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="p-4 text-sm">{u.totp_enabled ? "Yes" : "No"}</td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "Never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
