import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/lib/routes";
import { Shield } from "lucide-react";

export default function Setup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    email: "",
    display_name: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(ROUTES.ADMINAPISETUPCREATE, {
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
              minLength={6}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Confirm Password *</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              required
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
