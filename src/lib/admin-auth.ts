// ─────────────────────────────────────────────────────────
// Admin route auth helper
// ─────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { verifyToken, type AuthPayload } from "@/lib/auth";

export async function requireAdmin(
  request: NextRequest
): Promise<AuthPayload | null> {
  const token =
    request.cookies.get("auth_token")?.value ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) return null;

  try {
    const user = await verifyToken(token);
    if (user.role !== "ADMIN") return null;
    return user;
  } catch {
    return null;
  }
}
