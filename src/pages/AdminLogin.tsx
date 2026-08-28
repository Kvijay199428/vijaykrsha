import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { RateLimitError } from "../contexts/AuthContext";
import OtpDigitInput from "../components/OtpDigitInput";
import { AuthWebSocket } from "../lib/wsAuth";
import {
  ArrowRight, Loader2, Shield, MessageSquare, KeyRound,
  Clock, AlertTriangle, Lock,
} from "lucide-react";

type Step = "credentials" | "otp" | "totp";

function CooldownTimer({
  seconds,
  maxSeconds,
  variant,
}: {
  seconds: number;
  maxSeconds: number;
  variant: "warning" | "danger";
}) {
  const pct = maxSeconds > 0 ? (seconds / maxSeconds) * 100 : 0;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  const colors =
    variant === "danger"
      ? {
          bg: "bg-red-50 dark:bg-red-950/30",
          border: "border-red-200 dark:border-red-800/40",
          text: "text-red-700 dark:text-red-400",
          bar: "bg-red-500 dark:bg-red-400",
          icon: "text-red-500 dark:text-red-400",
        }
      : {
          bg: "bg-amber-50 dark:bg-amber-950/30",
          border: "border-amber-200 dark:border-amber-800/40",
          text: "text-amber-700 dark:text-amber-400",
          bar: "bg-amber-500 dark:bg-amber-400",
          icon: "text-amber-500 dark:text-amber-400",
        };

  return (
    <div className={`rounded-xl border p-4 ${colors.bg} ${colors.border}`}>
      <div className="flex items-center gap-3 mb-3">
        {variant === "danger" ? (
          <Lock className={`w-5 h-5 ${colors.icon}`} />
        ) : (
          <Clock className={`w-5 h-5 ${colors.icon}`} />
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${colors.text}`}>
            {variant === "danger" ? "Account temporarily suspended" : "Please wait"}
          </p>
          <p className={`text-xs mt-0.5 ${colors.text} opacity-80`}>
            {variant === "danger"
              ? "Too many failed password attempts — contact an administrator for earlier access"
              : "Too many failed attempts"}
          </p>
        </div>
        <span className={`text-2xl font-bold tabular-nums ${colors.text}`}>
          {timeStr}
        </span>
      </div>
      <div className={`h-1.5 rounded-full overflow-hidden ${variant === "danger" ? "bg-red-100 dark:bg-red-900/40" : "bg-amber-100 dark:bg-amber-900/40"}`}>
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-linear ${colors.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function AdminLogin() {
  const { login, exchangeForTokens, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from =
    (location.state as { from?: string } | null)?.from ??
    "/vega/admin/dashboard";

  const [step, setStep] = useState<Step>("credentials");
  const [transitioning, setTransitioning] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [otpCode, setOtpCode] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [otpError, setOtpError] = useState(false);
  const [totpError, setTotpError] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<AuthWebSocket | null>(null);

  // Rate limit cooldown state
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [cooldownMax, setCooldownMax] = useState(0);
  const [cooldownType, setCooldownType] = useState<"rate_limited" | "account_locked">("rate_limited");
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearCooldownTimer = useCallback(() => {
    if (cooldownRef.current) {
      clearInterval(cooldownRef.current);
      cooldownRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearCooldownTimer();
      wsRef.current?.disconnect();
      wsRef.current = null;
    };
  }, [clearCooldownTimer]);

  useEffect(() => {
    if (cooldownSeconds <= 0) {
      clearCooldownTimer();
      return;
    }
    cooldownRef.current = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearCooldownTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearCooldownTimer();
  }, [cooldownMax, clearCooldownTimer]);

  function transitionTo(nextStep: Step) {
    setTransitioning(true);
    setTimeout(() => {
      setStep(nextStep);
      setTransitioning(false);
    }, 150);
  }

  function handleCooldownError(err: RateLimitError) {
    setCooldownSeconds(err.retryAfter);
    setCooldownMax(err.retryAfter);
    setCooldownType(
      err.limitType === "account_locked" ? "account_locked" : "rate_limited"
    );
    setError("");
  }

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await login(username, password);
      setOtpSent(false);
      setWsConnected(false);

      const ws = new AuthWebSocket({
        onConnected: () => setWsConnected(true),
        onOtpStatus: (status) => {
          if (status === "sent") setOtpSent(true);
        },
        onState: (state) => {
          if (state === "awaiting_totp") {
            transitionTo("totp");
          }
        },
        onAuthSuccess: async ({ exchange_code }) => {
          try {
            await exchangeForTokens(exchange_code);
            navigate(from, { replace: true });
          } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed");
            transitionTo("credentials");
          }
        },
        onError: (code, retryAfter) => {
          if (code === "rate_limited" && retryAfter) {
            setCooldownSeconds(retryAfter);
            setCooldownMax(retryAfter);
            setCooldownType("rate_limited");
          } else if (code === "invalid_code") {
            setOtpError(true);
          } else if (code === "connection_error") {
            setError("Connection lost. Please try again.");
          } else {
            setError("Verification failed. Please try again.");
          }
        },
        onClosed: () => setWsConnected(false),
      });
      wsRef.current = ws;
      ws.connect(result.ws_ticket);

      if (result.methods.includes("totp") && !result.methods.includes("telegram_otp")) {
        transitionTo("totp");
      } else if (result.methods.includes("telegram_otp")) {
        transitionTo("otp");
      } else {
        setError("No second-factor method configured for this account");
      }
    } catch (err) {
      if (err instanceof RateLimitError) {
        handleCooldownError(err);
      } else {
        setError(err instanceof Error ? err.message : "Login failed");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleOtpVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOtpError(false);
    if (otpCode.length === 6 && wsRef.current) {
      wsRef.current.verify("telegram_otp", otpCode);
    }
  }

  function handleTotpVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setTotpError(false);
    if (totpCode.length === 6 && wsRef.current) {
      wsRef.current.verify("totp", totpCode);
    }
  }

  const isLocked = cooldownSeconds > 0;

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[var(--color-cream)] via-[var(--color-cream)] to-[var(--color-pink-muted)] p-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground mt-3">Checking session…</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/vega/admin/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--color-cream)] via-[var(--color-cream)] to-[var(--color-pink-muted)] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 neu-convex rounded-2xl mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {step === "credentials" && "Sign in to your account"}
            {step !== "credentials" && "Two-step verification"}
          </p>
        </div>

        <div className="neu-convex px-8 py-10">
          {isLocked && (
            <div className="mb-4">
              <CooldownTimer
                seconds={cooldownSeconds}
                maxSeconds={cooldownMax}
                variant={cooldownType === "account_locked" ? "danger" : "warning"}
              />
            </div>
          )}

          {error && !isLocked && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="relative overflow-hidden">
            {step === "credentials" && (
              <div className={transitioning ? "login-step-exit" : "login-step-active"}>
                <form onSubmit={handleCredentials} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-4 py-2.5 neu-concave rounded-xl bg-transparent text-night-800 dark:text-cream-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      required
                      autoFocus
                      disabled={isLocked}
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-2.5 neu-concave rounded-xl bg-transparent text-night-800 dark:text-cream-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      required
                      disabled={isLocked}
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || isLocked}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/30 hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    {loading ? "Signing in..." : isLocked ? `Locked — wait ${cooldownSeconds}s` : "Sign In"}
                  </button>
                </form>
              </div>
            )}

            {step === "otp" && (
              <div className={transitioning ? "login-step-exit" : "login-step-active"}>
                <form onSubmit={handleOtpVerify} className="space-y-4">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
                    <MessageSquare className="w-4 h-4 shrink-0" />
                    <span>
                      {wsConnected && otpSent
                        ? "Code sent to your Telegram"
                        : wsConnected
                        ? "Enter the 6-digit code sent to your Telegram"
                        : "Establishing secure connection…"}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-center">OTP Code</label>
                    <OtpDigitInput
                      value={otpCode}
                      onChange={(v) => {
                        setOtpCode(v);
                        setOtpError(false);
                      }}
                      autoFocus
                      disabled={isLocked || !wsConnected}
                      error={otpError}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || otpCode.length !== 6 || isLocked || !wsConnected}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/30 hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    {loading ? "Verifying..." : "Verify Code"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { transitionTo("credentials"); setOtpCode(""); setError(""); setCooldownSeconds(0); wsRef.current?.disconnect(); wsRef.current = null; }}
                    className="w-full py-2 rounded-xl neu-concave text-sm font-medium text-muted-foreground hover:text-glow-600 dark:hover:text-glow-400 transition-colors"
                  >
                    Back to login
                  </button>
                </form>
              </div>
            )}

            {step === "totp" && (
              <div className={transitioning ? "login-step-exit" : "login-step-active"}>
                <form onSubmit={handleTotpVerify} className="space-y-4">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
                    <KeyRound className="w-4 h-4 shrink-0" />
                    <span>Enter the 6-digit code from your authenticator app</span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-center">TOTP Code</label>
                    <OtpDigitInput
                      value={totpCode}
                      onChange={(v) => {
                        setTotpCode(v);
                        setTotpError(false);
                      }}
                      autoFocus
                      disabled={isLocked || !wsConnected}
                      error={totpError}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || totpCode.length !== 6 || isLocked || !wsConnected}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/30 hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    {loading ? "Verifying..." : "Verify & Sign In"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { transitionTo("credentials"); setTotpCode(""); setError(""); setCooldownSeconds(0); wsRef.current?.disconnect(); wsRef.current = null; }}
                    className="w-full py-2 rounded-xl neu-concave text-sm font-medium text-muted-foreground hover:text-glow-600 dark:hover:text-glow-400 transition-colors"
                  >
                    Back to login
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
