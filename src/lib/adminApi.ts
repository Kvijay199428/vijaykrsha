import { ROUTES } from "@/lib/routes";

export interface ApiFetchOptions extends RequestInit {
  /** Set false for auth-probing calls where 401 must not redirect. */
  redirectOn401?: boolean;
  /** Set true to skip the automatic token-refresh-and-retry on 401. */
  skipAutoRefresh?: boolean;
}

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;

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

async function refreshAccessToken(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const res = await fetch(ROUTES.ADMINAPIAUTHREFRESH, {
        method: "POST",
        credentials: "include", // sends the httpOnly refresh_token cookie
      });
      if (!res.ok) {
        accessToken = null;
        return false;
      }
      const data = await res.json();
      accessToken = data.access_token;
      return true;
    } catch {
      accessToken = null;
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
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
    const ok = await refreshAccessToken();
    if (ok) {
      response = await doFetch(url, init);
    }
  }

  if (response.status === 401 && redirectOn401) {
    window.location.assign("/vega/admin/login");
    throw new Error("SESSION_EXPIRED");
  }

  return response;
}
