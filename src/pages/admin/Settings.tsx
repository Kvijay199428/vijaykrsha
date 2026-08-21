import { useEffect, useState } from "react";
import { ROUTES } from "@/lib/routes";
import { apiFetch } from "@/lib/adminApi";
import { Shield, Lock } from "lucide-react";

export default function Settings() {
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [totpSecret, setTotpSecret] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    apiFetch(ROUTES.ADMINAPISETTINGS)
      .then((r) => r.json())
      .then((data) => setTotpEnabled(data.totp_enabled))
      .catch(() => {});
  }, []);

  async function startTotpSetup() {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(ROUTES.ADMINAPITOTPSETUP);
      const data = await res.json();
      setTotpSecret(data.secret);
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
        body: JSON.stringify({ code: totpCode, secret: totpSecret }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed" }));
        throw new Error(typeof err.detail === "string" ? err.detail : "Failed");
      }
      setTotpEnabled(true);
      setShowSetup(false);
      setMsg("TOTP enabled successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
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

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your security settings</p>
      </div>

      {msg && <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-xl text-sm">{msg}</div>}
      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm">{error}</div>}

      <div className="neu-flat p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 neu-btn rounded-xl">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <h2 className="font-semibold">Two-Factor Authentication</h2>
        </div>
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
                  className="px-3 py-1 neu-concave rounded-xl text-sm font-mono w-32 bg-transparent"
                  maxLength={6}
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
            <div className="neu-concave p-4 rounded-xl">
              <p className="text-xs text-muted-foreground mb-2">Add this secret to your authenticator app:</p>
              <code className="text-sm font-mono break-all">{totpSecret}</code>
            </div>
            <form onSubmit={enableTotp} className="flex gap-2">
              <input
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="px-3 py-1 neu-concave rounded-xl text-sm font-mono w-32 bg-transparent"
                maxLength={6}
              />
              <button type="submit" disabled={loading} className="px-4 py-1 neu-btn text-primary-foreground text-sm font-semibold">
                Verify & Enable
              </button>
            </form>
          </div>
        )}
      </div>

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
            className="w-full px-3 py-2 neu-concave rounded-xl bg-transparent text-sm"
            required
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            className="w-full px-3 py-2 neu-concave rounded-xl bg-transparent text-sm"
            required
            minLength={6}
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            className="w-full px-3 py-2 neu-concave rounded-xl bg-transparent text-sm"
            required
          />
          <button type="submit" disabled={loading} className="px-4 py-2 neu-btn text-primary-foreground text-sm font-semibold">
            Change Password
          </button>
        </form>
      </div>
    </div>
  );
}
