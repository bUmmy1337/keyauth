// ─────────────────────────────────────────────────────────
// API Response Helpers
// ─────────────────────────────────────────────────────────

import { encrypt } from "./crypto";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

/**
 * Create a standardized success response
 */
export function success<T>(data: T, status: number = 200): Response {
  const body: ApiResponse<T> = {
    success: true,
    data,
    timestamp: Date.now(),
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

/**
 * Create a standardized error response
 */
export function error(message: string, status: number = 400): Response {
  const body: ApiResponse = {
    success: false,
    error: message,
    timestamp: Date.now(),
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

/**
 * Create an encrypted response for sensitive payloads
 */
export async function encryptedSuccess<T>(
  data: T,
  status: number = 200
): Promise<Response> {
  const payload = JSON.stringify(data);
  const encrypted = await encrypt(payload);

  return success({ encrypted }, status);
}
