import { ROUTES } from "@/lib/routes";
import { apiFetch } from "@/lib/adminApi";

export interface PublicKeyResponse {
  key_id: string;
  public_key: string;
}

export async function fetchPublicKey(): Promise<PublicKeyResponse> {
  const res = await apiFetch(ROUTES.ADMINAPIAUTHPUBLICKEY, {
    credentials: "include",
    redirectOn401: false,
  });
  if (!res.ok) throw new Error("Could not load encryption key");
  return res.json();
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, "")
    .replace(/-----END PUBLIC KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function encryptPassword(
  password: string,
  publicKeyPem: string
): Promise<string> {
  const keyData = pemToArrayBuffer(publicKeyPem);
  const key = await crypto.subtle.importKey(
    "spki",
    keyData,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );
  const ciphertext = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    key,
    new TextEncoder().encode(password)
  );
  const bytes = new Uint8Array(ciphertext);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary);
}
