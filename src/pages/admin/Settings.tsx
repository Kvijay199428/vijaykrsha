import { useEffect, useState } from "react";
import { ROUTES } from "@/lib/routes";
import { apiFetch } from "@/lib/adminApi";
import { getPasswordErrors } from "@/lib/passwordValidation";
import { Shield, Lock, Copy, Check, User, Trash2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { NeuSelect } from "@/components/ui/select";

export default function Settings() {
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [totpSecret, setTotpSecret] = useState("");
  const [provisioningUri, setProvisioningUri] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [retentionDays, setRetentionDays] = useState("30");
  const [retentionSaving, setRetentionSaving] = useState(false);

  useEffect(() => {
    apiFetch(ROUTES.ADMINAPISETTINGS)
      .then((r) => r.json())
      .then((data) => {
        setTotpEnabled(data.totp_enabled);
        if (data.trash_retention_days) setRetentionDays(String(data.trash_retention_days));
      })
      .catch(() => {});
  }, []);

  async function startTotpSetup() {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(ROUTES.ADMINAPITOTPSETUP);
      const data = await res.json();
      setTotpSecret(data.secret);
      setProvisioningUri(data.provisioning_uri || "");
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
        body: JSON.stringify({ code: totpCode }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed" }));
        throw new Error(typeof err.detail === "string" ? err.detail : "Failed");
      }
      setTotpEnabled(true);
      setShowSetup(false);
      setProvisioningUri("");
      setMsg("TOTP enabled successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(totpSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement("textarea");
      el.value = totpSecret;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
    const pwErrors = getPasswordErrors(newPassword);
    if (pwErrors.length > 0) {
      setError(`Password requirements not met: ${pwErrors.join(", ")}`);
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

  async function saveRetention() {
    setRetentionSaving(true);
    setError("");
    setMsg("");
    try {
      const res = await apiFetch(ROUTES.ADMINAPISETTINGS, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trash_retention_days: parseInt(retentionDays) }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setMsg("Retention period saved");
    } catch {
      setError("Failed to save retention period");
    }
    setRetentionSaving(false);
  }

  return (
    <div className="flex flex-col gap-4 h-full min-h-0 max-w-2xl overflow-auto">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your security settings</p>
      </div>

      {msg && <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-xl text-sm">{msg}</div>}
      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm">{error}</div>}

      <Tabs defaultValue="totp" className="flex flex-col min-h-0">
        <TabsList className="self-start">
          <TabsTrigger value="totp" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            TOTP
          </TabsTrigger>
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="trash" className="flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            Trash
          </TabsTrigger>
        </TabsList>

        <TabsContent value="totp">
          <div className="neu-flat p-6">
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
                      className="px-3 py-1 neu-concave rounded-xl text-foreground text-sm font-mono w-32 bg-transparent"
                      maxLength={6}
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
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
                {provisioningUri && (
                  <div className="flex justify-center">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(provisioningUri)}&size=200x200&margin=10`}
                      alt="TOTP QR Code"
                      className="rounded-xl"
                      width={200}
                      height={200}
                    />
                  </div>
                )}
                <div className="neu-concave p-4 rounded-xl">
                  <p className="text-xs text-muted-foreground mb-2">Add this secret to your authenticator app:</p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono break-all flex-1">{totpSecret}</code>
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
                <form onSubmit={enableTotp} className="flex gap-2">
                  <input
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    className="px-3 py-1 neu-concave rounded-xl text-sm font-mono w-32 bg-transparent"
                    maxLength={6}
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <button type="submit" disabled={loading} className="px-4 py-1 neu-btn text-primary-foreground text-sm font-semibold">
                    Verify & Enable
                  </button>
                </form>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="profile">
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
                className="w-full px-3 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm"
                required
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                className="w-full px-3 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm"
                required
                minLength={6}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full px-3 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm"
                required
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <button type="submit" disabled={loading} className="px-4 py-2 neu-btn text-primary-foreground text-sm font-semibold">
                Change Password
              </button>
            </form>
          </div>
        </TabsContent>

        <TabsContent value="trash">
          <div className="neu-flat p-6 space-y-4">
            <div>
              <h2 className="font-semibold mb-1">Message Trash</h2>
              <p className="text-sm text-muted-foreground">
                Deleted messages are automatically and permanently removed after the selected retention period.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Retention period</label>
              <NeuSelect
                value={retentionDays}
                onChange={setRetentionDays}
                options={[
                  { value: "7", label: "7 days" },
                  { value: "14", label: "14 days" },
                  { value: "30", label: "30 days" },
                  { value: "60", label: "60 days" },
                  { value: "90", label: "90 days" },
                  { value: "180", label: "180 days" },
                  { value: "365", label: "365 days" },
                ]}
                className="w-full sm:w-48"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              New deletions will be retained for {retentionDays} days. Changing this setting does not change the expiration date of messages already in Trash.
            </p>
            <div className="flex justify-end">
              <button
                onClick={saveRetention}
                disabled={retentionSaving}
                className="px-4 py-2 neu-btn text-sm font-medium"
              >
                {retentionSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
