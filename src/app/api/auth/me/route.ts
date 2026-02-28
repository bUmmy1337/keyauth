// ─────────────────────────────────────────────────────────
// GET /api/auth/me — Get current authenticated user
// ─────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";
import { success, error } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const token =
      request.cookies.get("auth_token")?.value ||
      request.headers.get("authorization")?.replace("Bearer ", "");

    if (!token) {
      return error("Not authenticated.", 401);
    }

    const payload = await verifyToken(token);

    return success({
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    });
  } catch {
    return error("Invalid or expired token.", 401);
  }
}
