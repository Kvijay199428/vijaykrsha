import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, TimerReset } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const WARN_MS = 15 * 60 * 1000;
const CRITICAL_MS = 60 * 1000;
const RESYNC_INTERVAL_MS = 5 * 60 * 1000;

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function SessionExpiryWarning() {
  const { sessionExpiresAt, refreshAuth, logout } = useAuth();
  const navigate = useNavigate();
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const lastResyncRef = useRef(Date.now());
  const expiredRef = useRef(false);

  useEffect(() => {
    if (!sessionExpiresAt) {
      setRemainingMs(null);
      return;
    }
    const expiresAt = new Date(sessionExpiresAt).getTime();
    if (Number.isNaN(expiresAt)) {
      setRemainingMs(null);
      return;
    }

    const tick = () => {
      const left = expiresAt - Date.now();
      setRemainingMs(left);

      // Independent fallback: the server is the authority. If the countdown
      // hits zero (idle window elapsed with no API traffic), re-check; a 401
      // there means the session is truly gone.
      if (left <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        refreshAuth().then((ok) => {
          expiredRef.current = false;
          if (!ok) {
            logout().finally(() => navigate("/vega/admin/login", { replace: true }));
          }
        });
      }

      // Re-sync periodically while active so server-side idle extensions
      // (touch_session) are reflected without a full reload.
      if (Date.now() - lastResyncRef.current >= RESYNC_INTERVAL_MS) {
        lastResyncRef.current = Date.now();
        refreshAuth();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [sessionExpiresAt, refreshAuth, logout, navigate]);

  if (remainingMs === null || remainingMs > WARN_MS) return null;

  const critical = remainingMs <= CRITICAL_MS;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium ${
        critical
          ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/50"
          : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50"
      }`}
    >
      {critical ? (
        <TimerReset className="w-4 h-4 shrink-0" />
      ) : (
        <AlertTriangle className="w-4 h-4 shrink-0" />
      )}
      <span>
        {critical ? (
          <>Your session is about to expire. You will be signed out in {formatRemaining(remainingMs)}.</>
        ) : (
          <>
            For security you will be signed out in{" "}
            <span className="tabular-nums font-semibold">{formatRemaining(remainingMs)}</span>.
            Save your work and sign in again to continue.
          </>
        )}
      </span>
    </div>
  );
}
