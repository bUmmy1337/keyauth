// ─────────────────────────────────────────────────────────
// DLL storage — encrypt/decrypt at rest, load from Blob or DB
// ─────────────────────────────────────────────────────────

import { get } from "@vercel/blob";

export const MAX_DLL_SIZE = 50 * 1024 * 1024;

export function isAllowedBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export function validateDllBytes(dllBytes: Uint8Array): string | null {
  if (dllBytes.length > MAX_DLL_SIZE) {
    return `DLL exceeds maximum size of ${MAX_DLL_SIZE / 1024 / 1024} MB.`;
  }
  if (dllBytes.length < 64 || dllBytes[0] !== 0x4d || dllBytes[1] !== 0x5a) {
    return "Invalid DLL: missing MZ signature.";
  }
  return null;
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getStorageKey(): Promise<CryptoKey> {
  const encKey = process.env.ENCRYPTION_KEY;
  if (!encKey || encKey.length < 32) {
    throw new Error("Server encryption key not configured.");
  }

  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(encKey).slice(0, 32),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptDllBytes(
  dllBytes: Uint8Array
): Promise<{ stored: Uint8Array; hash: string }> {
  const hash = await sha256Hex(dllBytes);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await getStorageKey();

  const encryptedDll = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource, tagLength: 128 },
    keyMaterial,
    dllBytes as BufferSource
  );

  const stored = new Uint8Array(12 + encryptedDll.byteLength);
  stored.set(iv, 0);
  stored.set(new Uint8Array(encryptedDll), 12);

  return { stored, hash };
}

export async function decryptStoredBytes(stored: Uint8Array): Promise<Uint8Array> {
  if (stored.length < 13) {
    throw new Error("Corrupt encrypted DLL payload.");
  }

  const iv = stored.slice(0, 12);
  const ciphertext = stored.slice(12);
  const keyMaterial = await getStorageKey();

  const decryptedDll = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource, tagLength: 128 },
    keyMaterial,
    ciphertext as BufferSource
  );

  return new Uint8Array(decryptedDll);
}

export async function decryptLegacyDllData(dllData: string): Promise<Uint8Array> {
  const [storedIvB64, storedCtB64] = dllData.split(":");
  const storedIv = new Uint8Array(Buffer.from(storedIvB64, "base64"));
  const storedCt = new Uint8Array(Buffer.from(storedCtB64, "base64"));
  const keyMaterial = await getStorageKey();

  const decryptedDll = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: storedIv, tagLength: 128 },
    keyMaterial,
    storedCt
  );

  return new Uint8Array(decryptedDll);
}

export async function streamToUint8Array(
  stream: ReadableStream<Uint8Array>
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

export async function loadProjectDll(project: {
  dllBlobUrl: string | null;
  dllData: string | null;
}): Promise<Uint8Array | null> {
  if (project.dllBlobUrl) {
    const result = await get(project.dllBlobUrl, {
      access: "private",
      useCache: false,
    });

    if (!result || result.statusCode !== 200 || !result.stream) {
      throw new Error("Failed to load DLL from blob storage.");
    }

    const stored = await streamToUint8Array(result.stream);
    return decryptStoredBytes(stored);
  }

  if (project.dllData) {
    return decryptLegacyDllData(project.dllData);
  }

  return null;
}
