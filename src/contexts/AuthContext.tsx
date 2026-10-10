import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ROUTES } from "@/lib/routes";
import {
  apiFetch,
  setAccessToken,
  getAccessToken,
  bootstrapAuth,
  refreshAccessToken,
  fetchAdminSession,
} from "@/lib/adminApi";
import { fetchPublicKey, encryptPassword } from "@/lib/crypto";
import {
  SessionMonitor,
  SESSION_MONITOR_ENABLED,
  type SessionEvent,
  type WssStatus,
} from "@/lib/sessionMonitor";

interface LoginResult {
  status: "second_factor_required";
  challenge_id: string;
  methods: string[];
  ws_ticket: string;
  remember_me: boolean;
}

export interface RateLimitDetail {
  detail: string;
  type: "rate_limited" | "account_locked" | "resend_cooldown" | "verify_cooldown" | "ip_blocked";
  retry_after: number;
}

export class RateLimitError extends Error {
  retryAfter: number;
  limitType: RateLimitDetail["type"];
  constructor(msg: string, retryAfter: number, limitType: RateLimitDetail["type"]) {
    super(msg);
    this.retryAfter = retryAfter;
    this.limitType = limitType;
  }
}

export interface AdminIdentity {
  id: string;
  username: string;
  display_name?: string;
  role: string;
  role_level?: number | null;
}

/**
 * Explicit authentication lifecycle. "initializing" must never be treated as
 * "logged out" — the app is still deciding.
 */
export type AuthStatus = "initializing" | "authenticated" | "anonymous" | "error";

interface SessionPayload {
  id: string;
  username: string;
  display_name?: string;
  role: string;
  role_level?: number | null;
  session?: { expires_at?: string | null } | null;
}

interface AuthContextType {
  status: AuthStatus;
  isAuthenticated: boolean;
  admin: AdminIdentity | null;
  sessionExpiresAt: string | null;
  wssStatus: WssStatus;
  refreshAuth: () => Promise<boolean>;
  login: (
    username: string,
    password: string,
    rememberMe?: boolean,
    turnstileToken?: string
  ) => Promise<LoginResult>;
  exchangeForTokens: (
    exchangeCode: string
  ) => Promise<{ access_token: string; admin: AdminIdentity }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function friendlyAuthError(msg: string): string {
  if (msg === "invalid_credentials") {
    return "Incorrect username or password. Please enter the correct username and password.";
  }
  if (msg === "account_disabled") {
    return "This account has been disabled. Please contact an administrator.";
  }
  if (msg === "encryption_key_expired") {
    return "The encryption key expired. Please try again.";
  }
  return msg;
}

function parseAuthError(response: Response, data: unknown, fallback: string): Error {
  const msg = friendlyAuthError(
    (data as { detail?: unknown })?.detail &&
      typeof (data as { detail?: unknown }).detail === "string"
      ? ((data as { detail: string }).detail as string)
      : fallback
  );
  if (response.status === 429 || response.status === 423) {
    const rd = (data as { retry_after?: number; type?: RateLimitDetail["type"] }) ?? {};
    if (rd.retry_after) {
      return new RateLimitError(msg, rd.retry_after, rd.type || "rate_limited");
    }
  }
  return new Error(msg);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("initializing");
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | null>(null);
  const [wssStatus, setWssStatus] = useState<WssStatus>("disconnected");

  const statusRef = useRef<AuthStatus>("initializing");
  const mountedRef = useRef(true);
  const monitorRef = useRef<SessionMonitor | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      monitorRef.current?.disconnect();
      monitorRef.current = null;
    };
  }, []);

  const updateStatus = useCallback((next: AuthStatus) => {
    statusRef.current = next;
    if (mountedRef.current) setStatus(next);
  }, []);

  const clearAuth = useCallback(() => {
    setAccessToken(null);
    setAdmin(null);
    setSessionExpiresAt(null);
    updateStatus("anonymous");
  }, [updateStatus]);

  const applySession = useCallback(
    (data: SessionPayload) => {
      setAdmin({
        id: data.id,
        username: data.username,
        display_name: data.display_name,
        role: data.role,
        role_level: data.role_level,
      });
      setSessionExpiresAt(data.session?.expires_at ?? null);
      updateStatus("authenticated");
    },
    [updateStatus]
  );

  /**
   * Single-flight authentication bootstrap.
   *
   * Cold load (no in-memory token): refresh FIRST, then call /session — this
   * removes the predictable 401 → refresh → 200 sequence. Warm load (token
   * already in memory): call /session directly.
   */
  const refreshAuth = useCallback((): Promise<boolean> => {
    return bootstrapAuth(async () => {
      const wasAuthenticated = statusRef.current === "authenticated";
      if (!wasAuthenticated) updateStatus("initializing");

      try {
        if (!getAccessToken()) {
          const refreshed = await refreshAccessToken();
          if (refreshed === "network_error") {
            // Inconclusive: preserve an existing session, otherwise expose a
            // recoverable error rather than a false logout.
            if (!wasAuthenticated) updateStatus("error");
            return wasAuthenticated;
          }
          if (refreshed === "invalid_session") {
            clearAuth();
            return false;
          }
        }

        let res = await fetchAdminSession();

        if (res.status === 401) {
          // At most one refresh-and-retry for this bootstrap.
          const refreshed = await refreshAccessToken();
          if (refreshed === "network_error") {
            if (!wasAuthenticated) updateStatus("error");
            return wasAuthenticated;
          }
          if (refreshed === "invalid_session") {
            clearAuth();
            return false;
          }
          res = await fetchAdminSession();
        }

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            clearAuth();
            return false;
          }
          // Transient server failure (5xx): recoverable.
          if (!wasAuthenticated) updateStatus("error");
          return wasAuthenticated;
        }

        const data = (await res.json()) as SessionPayload;
        applySession(data);
        return true;
      } catch {
        // Network failure or missing token: not a confirmed logout.
        if (!wasAuthenticated) updateStatus("error");
        return wasAuthenticated;
      }
    });
  }, [applySession, clearAuth, updateStatus]);

  const handleSessionEvent = useCallback(
    (event: SessionEvent) => {
      switch (event.type) {
        case "session_revoked":
        case "account_disabled":
        case "session_expired":
          monitorRef.current?.disconnect();
          setAccessToken(null);
          clearAuth();
          window.location.replace("/vega/admin/login");
          break;
        case "reauth_required":
          // Revalidate over HTTPS; the monitor reconnects with a fresh ticket.
          void refreshAuth();
          break;
        case "session_expiring":
          if (event.expires_at) setSessionExpiresAt(event.expires_at);
          break;
        default:
          break;
      }
    },
    [clearAuth, refreshAuth]
  );

  // Real-time session monitoring — started only after an HTTPS session is
  // established, and torn down on logout. A dropped socket never logs out.
  useEffect(() => {
    if (status !== "authenticated" || !SESSION_MONITOR_ENABLED) {
      monitorRef.current?.disconnect();
      monitorRef.current = null;
      if (status !== "authenticated") setWssStatus("disconnected");
      return;
    }
    const monitor = new SessionMonitor({
      onStatus: setWssStatus,
      onEvent: handleSessionEvent,
    });
    monitorRef.current = monitor;
    void monitor.connect();
    return () => {
      monitor.disconnect();
      if (monitorRef.current === monitor) monitorRef.current = null;
    };
  }, [status, handleSessionEvent]);

  // Browser lifecycle: when a tab regains visibility after sleep/background,
  // revalidate over HTTPS. This silently refreshes an expired access token
  // before any page request can 401, and picks up server-side revocations.
  useEffect(() => {
    const onVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        statusRef.current === "authenticated"
      ) {
        void refreshAuth();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [refreshAuth]);

  const login = useCallback(
    async (
      username: string,
      password: string,
      rememberMe = false,
      turnstileToken?: string
    ): Promise<LoginResult> => {
      const { key_id, public_key } = await fetchPublicKey();
      const password_cipher = await encryptPassword(password, public_key);

      const response = await apiFetch(ROUTES.ADMINAPIAUTHLOGIN, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password_cipher,
          key_id,
          remember_me: rememberMe,
          turnstile_token: turnstileToken ?? null,
        }),
        redirectOn401: false,
      });

      const data = await response.json().catch(() => ({ detail: "Login failed" }));

      if (!response.ok) {
        throw parseAuthError(response, data, "Login failed");
      }

      return data as LoginResult;
    },
    []
  );

  const exchangeForTokens = useCallback(
    async (exchangeCode: string) => {
      const response = await apiFetch(ROUTES.ADMINAPIAUTHEXCHANGE, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exchange_code: exchangeCode }),
        redirectOn401: false,
      });

      const data = await response.json().catch(() => ({ detail: "Token exchange failed" }));

      if (!response.ok) {
        throw parseAuthError(response, data, "Token exchange failed");
      }

      // Validate before committing any state.
      const token = (data as { access_token?: unknown }).access_token;
      const adminData = (data as { admin?: unknown }).admin;
      if (typeof token !== "string" || token.length === 0 || !adminData) {
        throw new Error("invalid_exchange_response");
      }

      setAccessToken(token);
      setAdmin(adminData as AdminIdentity);
      updateStatus("authenticated");
      return { access_token: token, admin: adminData as AdminIdentity };
    },
    [updateStatus]
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch(ROUTES.ADMINAPIAUTHLOGOUT, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Even if the server call fails, tear down local state.
    }
    monitorRef.current?.disconnect();
    clearAuth();
    window.location.replace("/vega/admin/login");
  }, [clearAuth]);

  return (
    <AuthContext.Provider
      value={{
        status,
        isAuthenticated: status === "authenticated",
        admin,
        sessionExpiresAt,
        wssStatus,
        refreshAuth,
        login,
        exchangeForTokens,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
