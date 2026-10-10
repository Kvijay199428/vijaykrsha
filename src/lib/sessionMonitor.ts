import { ROUTES } from "@/lib/routes";
import { apiFetch } from "@/lib/adminApi";
import { site } from "@/config/site";

export type WssStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

export type SessionEventType =
  | "session_validated"
  | "session_expiring"
  | "session_revoked"
  | "account_disabled"
  | "session_expired"
  | "reauth_required"
  | "server_shutdown";

export interface SessionEvent {
  v: number;
  type: SessionEventType;
  reason?: string;
  server_time?: string;
  expires_at?: string;
}

export interface SessionMonitorCallbacks {
  onStatus?: (status: WssStatus) => void;
  onEvent: (event: SessionEvent) => void;
}

export const SESSION_MONITOR_ENABLED =
  import.meta.env.VITE_SESSION_MONITOR !== "false";

const EVENT_TYPES: ReadonlySet<string> = new Set<SessionEventType>([
  "session_validated",
  "session_expiring",
  "session_revoked",
  "account_disabled",
  "session_expired",
  "reauth_required",
  "server_shutdown",
]);

// Terminal events mean the session is gone; stop reconnecting entirely.
const TERMINAL_EVENTS: ReadonlySet<SessionEventType> = new Set<SessionEventType>([
  "session_revoked",
  "account_disabled",
  "session_expired",
]);

const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

function backoffDelay(attempt: number): number {
  const capped = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attempt);
  const jitter = capped * 0.2 * (Math.random() * 2 - 1);
  return Math.max(BASE_BACKOFF_MS, Math.round(capped + jitter));
}

function parseEvent(raw: unknown): SessionEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.type !== "string" || !EVENT_TYPES.has(obj.type)) return null;
  return {
    v: typeof obj.v === "number" ? obj.v : 1,
    type: obj.type as SessionEventType,
    reason: typeof obj.reason === "string" ? obj.reason : undefined,
    server_time: typeof obj.server_time === "string" ? obj.server_time : undefined,
    expires_at: typeof obj.expires_at === "string" ? obj.expires_at : undefined,
  };
}

/**
 * Real-time session monitor.
 *
 * The WSS channel is a NOTIFICATION mechanism only — it never replaces the
 * authoritative HTTPS session/refresh endpoints. A dropped socket therefore
 * never logs a user out on its own; reconnects always revalidate over HTTPS.
 *
 * The browser's native WebSocket API cannot set an Authorization header, so
 * each connection first requests a short-lived, single-use ticket over the
 * authenticated HTTPS API. No bearer or refresh token is ever placed in a URL.
 */
export class SessionMonitor {
  private ws: WebSocket | null = null;
  private status: WssStatus = "disconnected";
  private stopped = false;
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly callbacks: SessionMonitorCallbacks;

  constructor(callbacks: SessionMonitorCallbacks) {
    this.callbacks = callbacks;
  }

  getStatus(): WssStatus {
    return this.status;
  }

  private setStatus(status: WssStatus) {
    if (this.status === status) return;
    this.status = status;
    this.callbacks.onStatus?.(status);
  }

  async connect(): Promise<void> {
    if (this.stopped) this.stopped = false;
    if (!SESSION_MONITOR_ENABLED) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return; // already connected / connecting — never open duplicates
    }
    await this.open();
  }

  private async open(): Promise<void> {
    if (this.stopped) return;

    this.setStatus(this.attempt === 0 ? "connecting" : "reconnecting");

    let ticket: string;
    try {
      // apiFetch adds the bearer token + CSRF header and retries once after a
      // silent refresh. redirectOn401 is disabled so a definitive 401 is
      // surfaced here (as reauth_required) rather than bouncing the page.
      const res = await apiFetch(ROUTES.ADMINAPIAUTHWSTICKET, {
        method: "POST",
        redirectOn401: false,
      });
      if (res.status === 401 || res.status === 403) {
        // The HTTPS credential no longer authorizes a ticket. Ask the app to
        // revalidate/refresh over HTTPS; do not spin the socket.
        this.emit({ v: 1, type: "reauth_required", reason: "ws_ticket_unauthorized" });
        this.scheduleReconnect();
        return;
      }
      if (!res.ok) {
        this.scheduleReconnect();
        return;
      }
      const data: unknown = await res.json();
      const t = (data as { ticket?: unknown })?.ticket;
      if (typeof t !== "string" || t.length === 0) {
        this.scheduleReconnect();
        return;
      }
      ticket = t;
    } catch {
      this.scheduleReconnect();
      return;
    }

    if (this.stopped) return;

    const url = `${site.api.wsBaseUrl}/ws/admin-session?ticket=${encodeURIComponent(ticket)}`;
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = socket;

    socket.onopen = () => {
      if (this.ws !== socket) return;
      this.attempt = 0;
      this.setStatus("connected");
    };

    socket.onmessage = (e) => {
      if (this.ws !== socket) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(e.data);
      } catch {
        return; // ignore malformed payloads
      }
      const event = parseEvent(parsed);
      if (!event) return;
      this.emit(event);
      if (TERMINAL_EVENTS.has(event.type)) {
        this.stopPermanently();
      } else if (event.type === "reauth_required") {
        // Revalidate over HTTPS, then reconnect with a fresh ticket.
        this.scheduleReconnect();
      }
    };

    socket.onclose = () => {
      if (this.ws !== socket) return;
      this.ws = null;
      if (this.stopped) {
        this.setStatus("disconnected");
        return;
      }
      this.scheduleReconnect();
    };

    socket.onerror = () => {
      // onclose follows and drives the retry; nothing else to do here.
    };
  }

  private emit(event: SessionEvent) {
    this.callbacks.onEvent(event);
  }

  private scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) return;
    this.setStatus("reconnecting");
    const delay = backoffDelay(this.attempt);
    this.attempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.open();
    }, delay);
  }

  private stopPermanently() {
    this.stopped = true;
    this.closeSocket();
    this.setStatus("disconnected");
  }

  private closeSocket() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      try {
        this.ws.close();
      } catch {
        // already closing
      }
      this.ws = null;
    }
  }

  disconnect(): void {
    this.stopped = true;
    this.attempt = 0;
    this.closeSocket();
    this.setStatus("disconnected");
  }
}
