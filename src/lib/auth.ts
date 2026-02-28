// ─────────────────────────────────────────────────────────
// JWT Auth Utilities — Edge Runtime compatible (jose)
// ─────────────────────────────────────────────────────────

import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export interface AuthPayload extends JWTPayload {
  sub: string; // User ID
  email: string;
  role: string;
}

function getJWTSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

/**
 * Sign a JWT token (valid for 24 hours by default)
 */
export async function signToken(
  payload: Omit<AuthPayload, "iat" | "exp">
): Promise<string> {
  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .setIssuer("self-keyauth")
    .setAudience("self-keyauth-dashboard")
    .sign(getJWTSecret());
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string): Promise<AuthPayload> {
  const { payload } = await jwtVerify(token, getJWTSecret(), {
    issuer: "self-keyauth",
    audience: "self-keyauth-dashboard",
  });
  return payload as AuthPayload;
}
