// ─────────────────────────────────────────────────────────
// GET /api/logs — Audit log listing (user-scoped)
// ADMIN sees all logs, VIEWER sees only own
// ─────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, type AuthPayload } from "@/lib/auth";
import { success, error } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  const token =
    request.cookies.get("auth_token")?.value ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) return error("Unauthorized.", 401);

  let user: AuthPayload;
  try {
    user = await verifyToken(token);
  } catch {
    return error("Invalid token.", 401);
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));
  const action = searchParams.get("action") || undefined;
  const keyId = searchParams.get("keyId") || undefined;

  const where: Record<string, unknown> = {};
  if (action) where.action = { startsWith: action };
  if (keyId) where.keyId = keyId;

  // VIEWER sees only own logs
  if (user.role !== "ADMIN") {
    where.userId = user.sub;
  }

  const [logs, total] = await Promise.all([
    prisma.log.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        action: true,
        ip: true,
        userAgent: true,
        hwid: true,
        success: true,
        createdAt: true,
        user: { select: { email: true } },
        key: { select: { mask: true } },
      },
    }),
    prisma.log.count({ where }),
  ]);

  return success({
    logs,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
