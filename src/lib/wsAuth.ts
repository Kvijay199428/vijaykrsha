import { site } from "@/config/site";

export type WsServerEvent =
  | { event: "connected"; challenge_id: string; methods?: string[] }
  | { event: "state"; state: "awaiting_otp" | "awaiting_totp" }
  | { event: "otp_status"; status: "sent" | "delivered" | "expired"; method: string }
  | {
      event: "auth_success";
      exchange_code: string;
      admin: { id: string; username: string; role: string };
    }
  | {
      event: "error";
      code: string;
      retry_after?: number;
    };

type ClientMsg =
  | { action: "verify"; method: "telegram_otp" | "totp"; code: string };

export interface AuthWsCallbacks {
  onConnected?: () => void;
  onState?: (state: "awaiting_otp" | "awaiting_totp") => void;
  onOtpStatus?: (status: "sent" | "delivered" | "expired") => void;
  onAuthSuccess: (result: {
    exchange_code: string;
    admin: { id: string; username: string; role: string };
  }) => void;
  onError?: (code: string, retryAfter?: number) => void;
  onClosed?: () => void;
}

const WS_BASE = site.api.baseUrl.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://");

export class AuthWebSocket {
  private ws: WebSocket | null = null;
  private callbacks: AuthWsCallbacks;

  constructor(callbacks: AuthWsCallbacks) {
    this.callbacks = callbacks;
  }

  connect(ticket: string) {
    const url = `${WS_BASE}/ws/auth?ticket=${encodeURIComponent(ticket)}`;
    this.ws = new WebSocket(url);

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as WsServerEvent;
        this.handleMessage(msg);
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      this.callbacks.onClosed?.();
    };

    this.ws.onerror = () => {
      this.callbacks.onError?.("connection_error");
    };
  }

  verify(method: "telegram_otp" | "totp", code: string) {
    this.send({ action: "verify", method, code });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private send(msg: ClientMsg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private handleMessage(msg: WsServerEvent) {
    switch (msg.event) {
      case "connected":
        this.callbacks.onConnected?.();
        break;
      case "state":
        this.callbacks.onState?.(msg.state);
        break;
      case "otp_status":
        this.callbacks.onOtpStatus?.(msg.status);
        break;
      case "auth_success":
        this.callbacks.onAuthSuccess({
          exchange_code: msg.exchange_code,
          admin: msg.admin,
        });
        break;
      case "error":
        this.callbacks.onError?.(msg.code, msg.retry_after);
        break;
    }
  }
}
