import { ROUTES } from "@/lib/routes";

export interface ApiFetchOptions extends RequestInit {
  /** Set false for auth-probing calls where 401 must not redirect. */
  redirectOn401?: boolean;
}

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function readCsrfToken(): string | null {
  const value = /(?:^|;\s*)vks_csrf=([^;]*)/.exec(document.cookie)?.[1];
  return value ? decodeURIComponent(value) : null;
}

function buildHeaders(init: RequestInit): Headers {
  const headers = new Headers(init.headers);
  const method = (init.method ?? "GET").toUpperCase();
  // Backend rejects non-JSON content types on writes, even with empty bodies.
  if (UNSAFE_METHODS.has(method) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
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
 * Single API client for every admin request: cookies included, CSRF
 * double-submit header attached to state-changing methods, JSON content-type
 * defaulted, and automatic redirect to login on session expiry.
 */
export async function apiFetch(
  url: string,
  options: ApiFetchOptions = {}
): Promise<Response> {
  const { redirectOn401 = true, ...init } = options;

  let response = await doFetch(url, init);

  // CSRF cookie missing (expired or first visit after deploy): the backend
  // issues one on any authenticated GET — grab it via /me and retry once.
  if (
    response.status === 403 &&
    !readCsrfToken() &&
    url !== ROUTES.ADMINAPIAUTHME
  ) {
    await fetch(ROUTES.ADMINAPIAUTHME, { credentials: "include" });
    response = await doFetch(url, init);
  }

  if (response.status === 401 && redirectOn401) {
    window.location.assign("/vega/admin/login");
    throw new Error("SESSION_EXPIRED");
  }

  return response;
}
