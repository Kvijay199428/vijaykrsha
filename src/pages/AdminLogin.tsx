import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, OtpCooldownError } from "@/contexts/AuthContext";
import { ROUTES } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Eye,
  EyeOff,
  Shield,
  AlertTriangle,
  ArrowLeft,
  KeyRound,
  Lock,
  Fingerprint,
  Send,
} from "lucide-react";

type OtpMethod = "telegram" | "totp";

function formatCountdown(s: number) {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { login, loginTotp, loginOtpSend, loginOtpVerify } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [methods, setMethods] = useState<string[]>([]);
  const [method, setMethod] = useState<OtpMethod>("telegram");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpMsg, setOtpMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const [showForgotDialog, setShowForgotDialog] = useState(false);
  const [forgotStep, setForgotStep] = useState<"verify" | "reset">("verify");
  const [forgotChallengeId, setForgotChallengeId] = useState<string | null>(null);
  const [forgotData, setForgotData] = useState({
    username: "",
    totpToken: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);

  useEffect(() => {
    fetch(ROUTES.ADMINAPISETUPREQUIRED, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.required) {
          setSetupRequired(true);
          navigate("/vega/admin/setup", { replace: true });
        }
      })
      .catch(() => {});
  }, [navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const useTelegram = method === "telegram" && methods.includes("telegram_otp");

  function resetSecondFactor() {
    setChallengeId(null);
    setMethods([]);
    setMethod("telegram");
    setCode("");
    setOtpSent(false);
    setOtpMsg(null);
    setCooldown(0);
    setError("");
  }

  async function handleSendOtp() {
    if (!challengeId) return;
    setError("");
    setSending(true);
    setOtpMsg(null);
    try {
      const res = await loginOtpSend(challengeId);
      setOtpSent(true);
      setOtpMsg("Code sent to your Telegram. Check your chat and enter the code below.");
      setCooldown(res.cooldown_seconds ?? 60);
    } catch (err) {
      if (err instanceof OtpCooldownError) {
        setOtpSent(true);
        setCooldown(err.cooldownSeconds);
      } else {
        setError(err instanceof Error ? err.message : "Failed to send code");
      }
    } finally {
      setSending(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(username, password, rememberMe);
      if (result.status === "second_factor_required") {
        setChallengeId(result.challenge_id);
        const m = result.methods ?? [];
        setMethods(m);
        if (m.includes("telegram_otp")) {
          setMethod("telegram");
        } else if (m.includes("totp")) {
          setMethod("totp");
        }
        if (m.includes("telegram_otp")) {
          setTimeout(() => handleSendOtpWithChallenge(result.challenge_id), 100);
        }
      } else {
        navigate("/vega/admin/dashboard", { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtpWithChallenge(cid: string) {
    try {
      const res = await loginOtpSend(cid);
      setOtpSent(true);
      setOtpMsg("Code sent to your Telegram. Check your chat and enter the code below.");
      setCooldown(res.cooldown_seconds ?? 60);
    } catch (err) {
      if (err instanceof OtpCooldownError) {
        setOtpSent(true);
        setCooldown(err.cooldownSeconds);
      } else {
        setError(err instanceof Error ? err.message : "Failed to send code");
      }
    }
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!challengeId) return;
    setError("");
    setLoading(true);
    try {
      if (useTelegram) {
        const result = await loginOtpVerify(challengeId, code);
        if (result.totpRequired && result.challenge_id) {
          setChallengeId(result.challenge_id);
          setMethod("totp");
          setCode("");
          setOtpSent(false);
          setOtpMsg(null);
          return;
        }
      } else {
        await loginTotp(challengeId, code);
      }
      navigate("/vega/admin/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (forgotStep === "verify") {
        const response = await fetch(ROUTES.ADMINAPIPASSWORDFORGOTVERIFY, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: forgotData.username,
            totp_code: forgotData.totpToken,
          }),
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({ detail: "Verification failed" }));
          throw new Error(typeof err.detail === "string" ? err.detail : "Verification failed");
        }
        const data = await response.json();
        setForgotChallengeId(data.challenge_id);
        setForgotStep("reset");
        setSuccess("TOTP verified. Enter your new password.");
      } else {
        if (forgotData.newPassword !== forgotData.confirmPassword) {
          setError("Passwords do not match");
          setLoading(false);
          return;
        }
        if (forgotData.newPassword.length < 6) {
          setError("Password must be at least 6 characters");
          setLoading(false);
          return;
        }
        const response = await fetch(ROUTES.ADMINAPIPASSWORDFORGOTRESET, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            challenge_id: forgotChallengeId,
            new_password: forgotData.newPassword,
          }),
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({ detail: "Reset failed" }));
          throw new Error(typeof err.detail === "string" ? err.detail : "Reset failed");
        }
        setSuccess("Password reset successfully! Redirecting to login...");
        setTimeout(() => {
          setShowForgotDialog(false);
          setForgotStep("verify");
          setForgotChallengeId(null);
          setForgotData({ username: "", totpToken: "", newPassword: "", confirmPassword: "" });
          setSuccess("");
        }, 2000);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Operation failed");
    } finally {
      setLoading(false);
    }
  }

  if (setupRequired) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[auto]">
        <div className="md:col-span-1 md:row-span-2 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10 p-8 flex flex-col items-center justify-center text-center gap-4">
          <div className="p-4 bg-primary/15 rounded-2xl">
            <Shield className="h-12 w-12 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Vega Admin</h1>
            <p className="text-muted-foreground text-sm mt-1">Secure management console</p>
          </div>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-3">
              <Lock className="h-4 w-4 text-primary shrink-0" />
              <span>End-to-end encrypted auth</span>
            </div>
            <div className="flex items-center gap-3">
              <Fingerprint className="h-4 w-4 text-primary shrink-0" />
              <span>Two-factor protection</span>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4 text-primary shrink-0" />
              <span>Session-based access control</span>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 rounded-2xl bg-card border shadow-sm p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold">
              {challengeId ? "Two-Factor Authentication" : "Sign in to your account"}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              {challengeId ? "Verify your identity to continue" : "Enter your credentials to continue"}
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {otpMsg && (
            <Alert className="mb-4 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
              <Send className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 dark:text-blue-200">{otpMsg}</AlertDescription>
            </Alert>
          )}

          {!challengeId ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setError(""); }}
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(""); }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 text-sm">
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="rounded border-gray-300" />
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => { setShowForgotDialog(true); setForgotStep("verify"); setError(""); setSuccess(""); }}
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Please wait..." : "Login"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              {methods.length > 1 && (
                <div className="flex gap-2 p-1 bg-muted rounded-lg">
                  {methods.includes("telegram_otp") && (
                    <button
                      type="button"
                      onClick={() => { setMethod("telegram"); setCode(""); setOtpSent(false); setOtpMsg(null); }}
                      className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                        method === "telegram" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Send className="h-4 w-4 inline-block mr-1.5" />
                      Telegram OTP
                    </button>
                  )}
                  {methods.includes("totp") && (
                    <button
                      type="button"
                      onClick={() => { setMethod("totp"); setCode(""); setOtpSent(false); setOtpMsg(null); }}
                      className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                        method === "totp" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <KeyRound className="h-4 w-4 inline-block mr-1.5" />
                      Authenticator
                    </button>
                  )}
                </div>
              )}

              {useTelegram ? (
                <>
                  {!otpSent ? (
                    <Button type="button" variant="outline" className="w-full" onClick={handleSendOtp} disabled={sending}>
                      <Send className="h-4 w-4 mr-2" />
                      {sending ? "Sending..." : "Send code via Telegram"}
                    </Button>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="otp-code" className="flex items-center gap-2">
                          <Send className="h-4 w-4" />
                          Telegram Code
                        </Label>
                        <Input
                          id="otp-code"
                          placeholder="000000"
                          value={code}
                          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          required
                          maxLength={6}
                          pattern="\d{6}"
                          className="font-mono text-lg tracking-widest max-w-xs text-center"
                          autoFocus
                        />
                      </div>
                      {cooldown > 0 ? (
                        <p className="text-sm text-muted-foreground text-center">Resend available in {formatCountdown(cooldown)}</p>
                      ) : (
                        <Button type="button" variant="ghost" className="w-full" onClick={handleSendOtp}>
                          <Send className="h-4 w-4 mr-2" />
                          Resend OTP
                        </Button>
                      )}
                    </>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="totp-code" className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    Authenticator Code
                  </Label>
                  <Input
                    id="totp-code"
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                    maxLength={6}
                    pattern="\d{6}"
                    className="font-mono text-lg tracking-widest max-w-xs text-center"
                    autoFocus
                  />
                </div>
              )}

              {!(useTelegram && !otpSent) && (
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Verifying..." : "Verify"}
                </Button>
              )}

              <Button type="button" variant="ghost" className="w-full" onClick={resetSecondFactor}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to login
              </Button>
            </form>
          )}
        </div>

        <div className="md:col-span-1 rounded-2xl bg-card border shadow-sm p-6 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium">System Online</span>
          </div>
          <p className="text-xs text-muted-foreground">All services operational. Session timeout: 30 minutes.</p>
        </div>
      </div>

      <Dialog open={showForgotDialog} onOpenChange={setShowForgotDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              {forgotStep === "verify"
                ? "Enter your username and TOTP code to verify your identity."
                : "Create a new password for your account."}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="mb-4 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
              <AlertDescription className="text-green-800 dark:text-green-200">{success}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-username">Username</Label>
              <Input
                id="forgot-username"
                placeholder="Enter your username"
                value={forgotData.username}
                onChange={(e) => setForgotData({ ...forgotData, username: e.target.value })}
                required
                disabled={forgotStep === "reset"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="forgot-totp" className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                TOTP Code
              </Label>
              <Input
                id="forgot-totp"
                placeholder="6-digit code from authenticator"
                value={forgotData.totpToken}
                onChange={(e) => setForgotData({ ...forgotData, totpToken: e.target.value })}
                required
                maxLength={6}
                pattern="\d{6}"
                className="font-mono tracking-widest"
                disabled={forgotStep === "reset"}
              />
            </div>
            {forgotStep === "reset" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Minimum 6 characters"
                      value={forgotData.newPassword}
                      onChange={(e) => setForgotData({ ...forgotData, newPassword: e.target.value })}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Confirm your new password"
                    value={forgotData.confirmPassword}
                    onChange={(e) => setForgotData({ ...forgotData, confirmPassword: e.target.value })}
                    required
                  />
                </div>
              </>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Please wait..." : forgotStep === "verify" ? "Verify TOTP" : "Reset Password"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
