import { ROUTES } from "@/lib/routes";

export interface ApiFetchOptions extends RequestInit {
  /** Set false for auth-probing calls where 401 must not redirect. */
  redirectOn401?: boolean;
  /** Set true to skip the automatic token-refresh-and-retry on 401. */
  skipAutoRefresh?: boolean;
}

/**
 * Outcome of an access-token renewal attempt.
 *
 * - `refreshed`       a new access token is now in memory.
 * - `invalid_session` the server definitively rejected the refresh cookie
 *                     (401/403 or a malformed body). The caller should treat
 *                     the user as logged out.
 * - `network_error`   the request could not reach the server, or the server
 *                     returned a transient (5xx) failure. This is NOT a
 *                     confirmed logout — the caller should surface a
 *                     recoverable error instead of clearing auth state.
 */
export type RefreshResult = "refreshed" | "invalid_session" | "network_error";

let accessToken: string | null = null;
let refreshing: Promise<RefreshResult> | null = null;
let bootstrapping: Promise<boolean> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

function readCsrfToken(): string | null {
  const value = /(?:^|;\s*)vks_csrf=([^;]*)/.exec(document.cookie)?.[1];
  return value ? decodeURIComponent(value) : null;
}

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function buildHeaders(init: RequestInit): Headers {
  const headers = new Headers(init.headers);
  const method = (init.method ?? "GET").toUpperCase();
  if (!headers.has("Content-Type")) {
    if (init.body && method !== "GET") {
      headers.set("Content-Type", "application/json");
    }
  }
  // Always read the live token so a request that follows a refresh carries the
  // fresh Authorization header instead of a stale, captured one.
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  // CSRF double-submit is retained as defense-in-depth: the backend still
  // requires X-CSRF-Token to match the vks_csrf cookie for unsafe methods,
  // even when a Bearer token is present.
  if (UNSAFE_METHODS.has(method)) {
    const token = readCsrfToken();
    if (token) headers.set("X-CSRF-Token", token);
  }
  return headers;
}

async function doFetch(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    credentials: "include",
    headers: buildHeaders(init),
  });
}

/**
 * Renew the in-memory access token using the httpOnly refresh cookie.
 *
 * Single-flight: concurrent callers share one in-flight request so token
 * rotation cannot race. The refresh endpoint is intentionally called with raw
 * `fetch` (never `apiFetch`) so it can never recursively trigger another
 * refresh.
 */
export async function refreshAccessToken(): Promise<RefreshResult> {
  if (refreshing) return refreshing;

  refreshing = (async (): Promise<RefreshResult> => {
    let res: Response;
    try {
      res = await fetch(ROUTES.ADMINAPIAUTHREFRESH, {
        method: "POST",
        credentials: "include", // sends the httpOnly refresh_token cookie
        cache: "no-store",
      });
    } catch {
      // Offline / DNS / TLS failure: not proof of logout.
      return "network_error";
    }

    if (res.status === 401 || res.status === 403) {
      accessToken = null;
      return "invalid_session";
    }
    if (!res.ok) {
      // 5xx / gateway error: transient, keep the caller in a recoverable state.
      return "network_error";
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return "network_error";
    }

    if (
      !data ||
      typeof data !== "object" ||
      typeof (data as { access_token?: unknown }).access_token !== "string" ||
      ((data as { access_token: string }).access_token).length === 0
    ) {
      accessToken = null;
      return "invalid_session";
    }

    accessToken = (data as { access_token: string }).access_token;
    return "refreshed";
  })().finally(() => {
    refreshing = null;
  });

  return refreshing;
}

/**
 * Run the one-time authentication bootstrap. Multiple callers (React Strict
 * Mode double-effects, several components mounting together) share a single
 * execution so refresh-token rotation happens exactly once.
 */
export function bootstrapAuth(run: () => Promise<boolean>): Promise<boolean> {
  if (bootstrapping) return bootstrapping;

  const current = run().finally(() => {
    if (bootstrapping === current) {
      bootstrapping = null;
    }
  });

  bootstrapping = current;
  return current;
}

/**
 * Fetch the authoritative admin session. Requires an access token: this must
 * never be the first authenticated call on a cold load (that is what produced
 * the avoidable 401 + refresh + retry sequence).
 */
export async function fetchAdminSession(): Promise<Response> {
  if (!accessToken) {
    throw new Error("ACCESS_TOKEN_MISSING");
  }
  return fetch(ROUTES.ADMINAPIAUTHSESSION, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
}

/**
 * Single API client for every admin request. Attaches the in-memory access
 * token as a Bearer header, and on 401 automatically attempts a silent
 * refresh using the httpOnly refresh_token cookie, then retries once.
 */
export async function apiFetch(
  url: string,
  options: ApiFetchOptions = {}
): Promise<Response> {
  const { redirectOn401 = true, skipAutoRefresh = false, ...init } = options;

  let response = await doFetch(url, init);

  if (
    !skipAutoRefresh &&
    response.status === 401 &&
    url !== ROUTES.ADMINAPIAUTHLOGIN &&
    url !== ROUTES.ADMINAPIAUTHREFRESH
  ) {
    const result = await refreshAccessToken();
    if (result === "refreshed") {
      response = await doFetch(url, init);
    }
  }

  if (response.status === 401 && redirectOn401) {
    window.location.assign("/vega/admin/login");
    throw new Error("SESSION_EXPIRED");
  }

  return response;
}
