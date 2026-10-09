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
  const data = await res.json().catch(() => null);
  // Tolerate a camelCase shape ({keyId, publicKey}) but require the
  // contract fields; a missing public_key used to crash as
  // "Cannot read properties of undefined (reading 'replace')".
  const key_id = data?.key_id ?? data?.keyId;
  const public_key = data?.public_key ?? data?.publicKey;
  if (
    typeof key_id !== "string" ||
    typeof public_key !== "string" ||
    !public_key.includes("-----BEGIN PUBLIC KEY-----")
  ) {
    throw new Error("Invalid public encryption key response");
  }
  return { key_id, public_key };
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  if (typeof pem !== "string" || pem.trim() === "") {
    throw new Error("Public encryption key is missing");
  }
  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, "")
    .replace(/-----END PUBLIC KEY-----/, "")
    .replace(/\s+/g, "");
  if (!b64) {
    throw new Error("Public encryption key is empty");
  }
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
