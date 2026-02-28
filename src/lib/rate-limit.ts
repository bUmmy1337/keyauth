// ─────────────────────────────────────────────────────────
// In-Memory Rate Limiter (Token Bucket)
// For production, back with Vercel KV / Upstash Redis
// ─────────────────────────────────────────────────────────

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

const DEFAULT_MAX_TOKENS = 20; // requests per window
const DEFAULT_REFILL_RATE = 20; // tokens per window
const DEFAULT_WINDOW_MS = 60_000; // 1 minute

export interface RateLimitConfig {
  maxTokens?: number;
  refillRate?: number;
  windowMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = {}
): RateLimitResult {
  const {
    maxTokens = DEFAULT_MAX_TOKENS,
    refillRate = DEFAULT_REFILL_RATE,
    windowMs = DEFAULT_WINDOW_MS,
  } = config;

  const now = Date.now();
  let bucket = buckets.get(identifier);

  if (!bucket) {
    bucket = { tokens: maxTokens - 1, lastRefill: now };
    buckets.set(identifier, bucket);
    return { allowed: true, remaining: bucket.tokens, retryAfterMs: 0 };
  }

  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefill;
  const refillAmount = Math.floor((elapsed / windowMs) * refillRate);

  if (refillAmount > 0) {
    bucket.tokens = Math.min(maxTokens, bucket.tokens + refillAmount);
    bucket.lastRefill = now;
  }

  if (bucket.tokens > 0) {
    bucket.tokens -= 1;
    return { allowed: true, remaining: bucket.tokens, retryAfterMs: 0 };
  }

  const retryAfterMs = windowMs - elapsed;
  return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, retryAfterMs) };
}

/**
 * Extract client IP from request headers (Vercel / Cloudflare / standard)
 */
export function getClientIP(request: Request): string {
  const headers = new Headers(request.headers);
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

// Cleanup stale buckets every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (now - bucket.lastRefill > 300_000) {
        buckets.delete(key);
      }
    }
  }, 300_000);
}
