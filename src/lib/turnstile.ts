// Cloudflare Turnstile client helper. Explicit render, no third-party wrapper.
// The site key is public and safe to ship in the bundle; the secret key never
// leaves the backend. Tokens are single-use, so a form must reset the widget
// and fetch a fresh token on every attempt.
//
// Each form gets its own Cloudflare widget so the server can pin the expected
// `action` per endpoint. Widget *mode* however is configured in the Cloudflare
// dashboard and wins over anything passed here — a widget created as
// "Non-interactive" or "Invisible" never shows a checkbox and the options
// below cannot override that.

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Widget used by the admin login form. */
export const ADMIN_LOGIN_SITE_KEY: string =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() ||
  "0x4AAAAAAEYNYl20nw8S24aH";

/**
 * Widget used by the public contact form — a separate widget from the admin
 * login one, so the server can pin `action: "contact_form"` and a token minted
 * here cannot be replayed against `/vks/api/auth/login`.
 *
 * Site keys are public by design (they ship in the browser bundle), so the
 * default here is the real key rather than a placeholder — the form works
 * without any build-time env var, same as ADMIN_LOGIN_SITE_KEY. Point
 * VITE_TURNSTILE_CONTACT_SITE_KEY at a different widget to override.
 */
export const CONTACT_SITE_KEY: string =
  (import.meta.env.VITE_TURNSTILE_CONTACT_SITE_KEY as string | undefined)?.trim() ||
  "0x4AAAAAAFRKAxlycVCJSy__";

interface TurnstileOptions {
  sitekey: string;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact" | "flexible";
  action?: string;
  mode?: "managed" | "non-interactive" | "invisible";
  appearance?: "always" | "execute" | "interaction-only";
  execution?: "render" | "execute";
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
}

/** Per-widget render overrides. All fields optional; see `renderTurnstile`. */
export interface TurnstileRenderConfig {
  /** Must match the action the backend expects for this endpoint. */
  action?: string;
  /** Overrides the default site key. */
  siteKey?: string;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact" | "flexible";
  /**
   * `managed` + `always` is what forces a real click: the checkbox is always
   * rendered and the user must pass it. `non-interactive` shows a passive
   * success badge instead, and `invisible` shows nothing at all.
   */
  mode?: "managed" | "non-interactive" | "invisible";
  appearance?: "always" | "execute" | "interaction-only";
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: TurnstileOptions) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const LOAD_TIMEOUT_MS = 10_000;

let scriptPromise: Promise<void> | null = null;

export function loadTurnstile(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Turnstile requires a browser"));
  }
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const fail = (msg: string) => {
      const s = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
      if (s) s.dataset.failed = "true";
      reject(new Error(msg));
    };

    // Bounded poll: a script tag that exists but never yields the API must
    // surface an error, not hang silently (the old wait() never settled).
    const poll = (existing: HTMLScriptElement | null) => {
      const deadline = Date.now() + LOAD_TIMEOUT_MS;
      const check = () => {
        if (window.turnstile) return resolve();
        if (existing?.dataset.failed === "true") {
          return fail("Turnstile script previously failed");
        }
        if (Date.now() > deadline) {
          return fail("Timed out waiting for the Turnstile API");
        }
        window.setTimeout(check, 50);
      };
      check();
    };

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) return poll(existing);

    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => {
      window.setTimeout(() => {
        if (window.turnstile) resolve();
        else fail("Turnstile script loaded but the API is unavailable");
      }, 0);
    };
    s.onerror = () => fail("Failed to load Turnstile");
    document.head.appendChild(s);
    poll(s);
  });

  // A failed load must not poison every later attempt in this page load.
  scriptPromise = scriptPromise.catch((error) => {
    scriptPromise = null;
    throw error;
  });

  return scriptPromise;
}

export function renderTurnstile(
  el: HTMLElement,
  onToken: (token: string) => void,
  onExpire: () => void,
  onError: () => void,
  config: TurnstileRenderConfig = {}
): string | null {
  if (!window.turnstile) return null;
  const {
    action = "admin_login",
    siteKey = ADMIN_LOGIN_SITE_KEY,
    theme = "auto",
    size = "normal",
    mode,
    appearance,
  } = config;
  try {
    return window.turnstile.render(el, {
      sitekey: siteKey,
      theme,
      size,
      action,
      // Only forward these when asked, so the existing admin login widget
      // keeps rendering with exactly the options it always has.
      ...(mode ? { mode } : {}),
      ...(appearance ? { appearance } : {}),
      callback: onToken,
      "expired-callback": onExpire,
      "error-callback": onError,
    });
  } catch (err) {
    console.error("[Turnstile] render failed:", err);
    return null;
  }
}

export function resetTurnstile(widgetId: string | null) {
  if (widgetId && window.turnstile) window.turnstile.reset(widgetId);
}

/**
 * Tear a widget down. Pass the same ref you called resetTurnstile with so the
 * caller can null it out — otherwise a remount orphans the old widget and the
 * container keeps rendering the previous challenge.
 */
export function removeTurnstile(widgetId: string | null) {
  if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
}
