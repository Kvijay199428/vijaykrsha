import { getApiErrorMessage } from "@/lib/apiError";

export async function apiGet<T = unknown>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(getApiErrorMessage(data, `GET ${url} failed: ${response.status}`));
  }
  return response.json();
}

export async function apiPost<T = unknown>(
  url: string,
  body?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(getApiErrorMessage(data, `POST ${url} failed: ${response.status}`));
  }
  return response.json();
}
