import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ROUTES } from "@/lib/routes";

interface SecondFactorResult {
  status: "second_factor_required";
  challenge_id: string;
  methods: string[];
}

export class OtpCooldownError extends Error {
  cooldownSeconds: number;
  constructor(cooldownSeconds: number) {
    super(`Please wait ${cooldownSeconds}s before requesting a new code.`);
    this.cooldownSeconds = cooldownSeconds;
  }
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  admin: { id: string; username: string; role: string } | null;
  login: (
    username: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<SecondFactorResult>;
  loginOtpSend: (challengeId: string) => Promise<{ cooldown_seconds: number }>;
  loginOtpVerify: (
    challengeId: string,
    code: string
  ) => Promise<{ totpRequired: boolean; challenge_id?: string }>;
  loginTotp: (
    challengeId: string,
    code: string
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [admin, setAdmin] = useState<{ id: string; username: string; role: string } | null>(null);

  useEffect(() => {
    fetch(ROUTES.ADMINAPIAUTHME, { credentials: "include" })
      .then((response) => {
        if (response.ok) return response.json();
        throw new Error("not authenticated");
      })
      .then((data) => {
        setIsAuthenticated(true);
        setAdmin(data);
      })
      .catch(() => {
        setIsAuthenticated(false);
        setAdmin(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(
    async (
      username: string,
      password: string,
      rememberMe = false
    ): Promise<SecondFactorResult> => {
      const response = await fetch(ROUTES.ADMINAPIAUTHLOGIN, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, remember_me: rememberMe }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: "Login failed" }));
        throw new Error(typeof err.detail === "string" ? err.detail : "Login failed");
      }

      return await response.json();
    },
    []
  );

  const loginOtpSend = useCallback(
    async (challengeId: string): Promise<{ cooldown_seconds: number }> => {
      const response = await fetch(ROUTES.ADMINAPIAUTHLOGINOTPSEND, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id: challengeId }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: "Failed to send code" }));
        const msg = typeof err.detail === "string" ? err.detail : "Failed to send code";
        if (msg.includes("resend_cooldown")) {
          const match = msg.match(/(\d+)/);
          throw new OtpCooldownError(match ? parseInt(match[1]) : 60);
        }
        throw new Error(msg);
      }

      return await response.json();
    },
    []
  );

  const loginOtpVerify = useCallback(
    async (challengeId: string, code: string) => {
      const response = await fetch(ROUTES.ADMINAPIAUTHLOGINOTPVERIFY, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id: challengeId, code }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: "OTP verification failed" }));
        throw new Error(typeof err.detail === "string" ? err.detail : "OTP verification failed");
      }

      const data = await response.json();
      if (data.status === "totp_required") {
        return { totpRequired: true, challenge_id: data.challenge_id };
      }

      setIsAuthenticated(true);
      setAdmin(data.admin ?? null);
      return { totpRequired: false };
    },
    []
  );

  const loginTotp = useCallback(
    async (challengeId: string, code: string) => {
      const response = await fetch(ROUTES.ADMINAPIAUTHLOGINTOTP, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id: challengeId, code }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: "TOTP verification failed" }));
        throw new Error(typeof err.detail === "string" ? err.detail : "TOTP verification failed");
      }

      const data = await response.json();
      setIsAuthenticated(true);
      setAdmin(data.admin ?? null);
    },
    []
  );

  const logout = useCallback(async () => {
    await fetch(ROUTES.ADMINAPIAUTHLOGOUT, {
      method: "POST",
      credentials: "include",
    });
    setIsAuthenticated(false);
    setAdmin(null);
    window.location.assign("/vega/admin/login");
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        admin,
        login,
        loginOtpSend,
        loginOtpVerify,
        loginTotp,
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
