// ─────────────────────────────────────────────────────────
// Secure Loader Token Store — Shared between handshake & download
// In-memory one-time token store with TTL
// ─────────────────────────────────────────────────────────

export interface PendingDownload {
  aesKey: Uint8Array;
  aesIv: Uint8Array;
  projectId: string;
  hwid: string;
  expiresAt: number;
}

// Global store survives across Hot Module Replacement in dev
const globalForTokens = globalThis as typeof globalThis & {
  __loaderTokens?: Map<string, PendingDownload>;
  __loaderCleanupInterval?: ReturnType<typeof setInterval>;
};

if (!globalForTokens.__loaderTokens) {
  globalForTokens.__loaderTokens = new Map();
}

if (!globalForTokens.__loaderCleanupInterval) {
  globalForTokens.__loaderCleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [token, data] of globalForTokens.__loaderTokens!) {
      if (data.expiresAt < now) {
        globalForTokens.__loaderTokens!.delete(token);
      }
    }
  }, 10_000);
}

export const tokenStore = globalForTokens.__loaderTokens;

/**
 * Store a pending download token with data
 */
export function storeToken(token: string, data: PendingDownload): void {
  tokenStore.set(token, data);
}

/**
 * Consume (one-time retrieve & delete) a download token
 */
export function consumeToken(token: string): PendingDownload | null {
  const data = tokenStore.get(token);
  if (!data) return null;
  if (data.expiresAt < Date.now()) {
    tokenStore.delete(token);
    return null;
  }
  // One-time use: delete immediately
  tokenStore.delete(token);
  return data;
}
