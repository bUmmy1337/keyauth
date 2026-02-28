// ─────────────────────────────────────────────────────────
// AES-256-GCM Encryption / Decryption
// Uses Web Crypto API (Edge Runtime compatible)
// ─────────────────────────────────────────────────────────

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96-bit nonce for GCM
const TAG_LENGTH = 128; // 128-bit auth tag

function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new Error(
      "ENCRYPTION_KEY must be set and at least 32 characters long"
    );
  }
  return key;
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret).slice(0, 32),
    { name: ALGORITHM },
    false,
    ["encrypt", "decrypt"]
  );
  return keyMaterial;
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns base64-encoded string: iv:ciphertext
 */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await deriveKey(getEncryptionKey());
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoder = new TextEncoder();

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    encoder.encode(plaintext)
  );

  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));

  return `${ivB64}:${ctB64}`;
}

/**
 * Decrypt AES-256-GCM encrypted string.
 */
export async function decrypt(encrypted: string): Promise<string> {
  const key = await deriveKey(getEncryptionKey());
  const [ivB64, ctB64] = encrypted.split(":");

  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(ctB64), (c) => c.charCodeAt(0));

  const plaintext = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    ciphertext
  );

  return new TextDecoder().decode(plaintext);
}

/**
 * Generate a cryptographically secure random hex string
 */
export function generateSecureToken(bytes: number = 32): string {
  const buffer = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generate a formatted license key: XXXX-XXXX-XXXX-XXXX
 */
export function generateLicenseKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No ambiguous chars
  const segments: string[] = [];

  for (let s = 0; s < 4; s++) {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    let segment = "";
    for (let i = 0; i < 4; i++) {
      segment += chars[bytes[i] % chars.length];
    }
    segments.push(segment);
  }

  return segments.join("-");
}

/**
 * Hash an HWID string using SHA-256 for storage
 */
export async function hashHWID(hwid: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = process.env.HWID_SALT || "self-keyauth-hwid-salt";
  const data = encoder.encode(`${salt}:${hwid}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generate a one-time server nonce (prevents replay attacks)
 */
export function generateNonce(): string {
  return generateSecureToken(16);
}
