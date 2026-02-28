// ─────────────────────────────────────────────────────────
// Portal Auth Utilities — JWT for portal users (key holders)
// ─────────────────────────────────────────────────────────

import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export interface PortalAuthPayload extends JWTPayload {
  sub: string;       // PortalUser ID
  username: string;
  projectId: string;
  type: "portal";    // Distinguish from admin tokens
}

function getJWTSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

/**
 * Sign a portal JWT token (valid for 7 days)
 */
export async function signPortalToken(
  payload: Omit<PortalAuthPayload, "iat" | "exp">
): Promise<string> {
  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .setIssuer("self-keyauth")
    .setAudience("self-keyauth-portal")
    .sign(getJWTSecret());
}

/**
 * Verify and decode a portal JWT token
 */
export async function verifyPortalToken(token: string): Promise<PortalAuthPayload> {
  const { payload } = await jwtVerify(token, getJWTSecret(), {
    issuer: "self-keyauth",
    audience: "self-keyauth-portal",
  });
  if ((payload as Record<string, unknown>).type !== "portal") {
    throw new Error("Not a portal token");
  }
  return payload as PortalAuthPayload;
}
