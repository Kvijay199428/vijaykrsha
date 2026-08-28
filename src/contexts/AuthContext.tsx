import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ROUTES } from "@/lib/routes";
import { apiFetch, setAccessToken } from "@/lib/adminApi";
import { fetchPublicKey, encryptPassword } from "@/lib/crypto";

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

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  admin: AdminIdentity | null;
  sessionExpiresAt: string | null;
  refreshAuth: () => Promise<boolean>;
  login: (
    username: string,
    password: string,
    rememberMe?: boolean
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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | null>(null);

  const refreshAuth = useCallback(async (): Promise<boolean> => {
    try {
      const response = await apiFetch(ROUTES.ADMINAPIAUTHME, {
        credentials: "include",
        redirectOn401: false,
      });
      if (!response.ok) throw new Error("not authenticated");
      const data = await response.json();
      setIsAuthenticated(true);
      setAdmin({
        id: data.id,
        username: data.username,
        display_name: data.display_name,
        role: data.role,
        role_level: data.role_level,
      });
      setSessionExpiresAt(data.session?.expires_at ?? null);
      return true;
    } catch {
      setIsAuthenticated(false);
      setAdmin(null);
      setSessionExpiresAt(null);
      return false;
    }
  }, []);

  useEffect(() => {
    refreshAuth().finally(() => setIsLoading(false));
  }, [refreshAuth]);

  const login = useCallback(
    async (
      username: string,
      password: string,
      rememberMe = false
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

      setAccessToken(data.access_token);
      setIsAuthenticated(true);
      setAdmin(data.admin);
      return { access_token: data.access_token, admin: data.admin };
    },
    []
  );

  const logout = useCallback(async () => {
    await apiFetch(ROUTES.ADMINAPIAUTHLOGOUT, {
      method: "POST",
      credentials: "include",
    });
    setAccessToken(null);
    setIsAuthenticated(false);
    setAdmin(null);
    setSessionExpiresAt(null);
    window.location.replace("/vega/admin/login");
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        admin,
        sessionExpiresAt,
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
