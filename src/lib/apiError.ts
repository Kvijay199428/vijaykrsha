interface FastAPIValidationDetail {
  type: string;
  loc: (string | number)[];
  msg: string;
  input?: unknown;
}

export function getApiErrorMessage(data: unknown, fallback = "Something went wrong"): string {
  if (!data || typeof data !== "object") return fallback;

  const detail = (data as Record<string, unknown>).detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as FastAPIValidationDetail;
    if (first && typeof first === "object" && typeof first.msg === "string") {
      const field = first.loc?.filter((s) => typeof s === "string" && s !== "body").join(" ");
      const msg = first.msg.charAt(0).toUpperCase() + first.msg.slice(1);
      return field ? `${field}: ${msg}` : msg;
    }
  }

  if (typeof detail === "object" && detail !== null) {
    const d = detail as Record<string, unknown>;
    if (typeof d.message === "string") return d.message;
    if (typeof d.error === "string") return d.error;
  }

  return fallback;
}
