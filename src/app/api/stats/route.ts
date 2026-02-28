// ─────────────────────────────────────────────────────────
// GET /api/stats — Dashboard statistics (user-scoped)
// ADMIN sees global stats, VIEWER sees only own keys
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

  const isAdmin = user.role === "ADMIN";

  // Optional project filter
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") || undefined;

  const keyScope: Record<string, unknown> = isAdmin ? {} : { createdById: user.sub };
  if (projectId) keyScope.projectId = projectId;
  const logScope: Record<string, unknown> = isAdmin ? {} : { userId: user.sub };

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    totalKeys,
    activeKeys,
    expiredKeys,
    bannedKeys,
    totalValidations,
    recentValidations,
    failedValidations,
    totalUsers,
  ] = await Promise.all([
    prisma.key.count({ where: keyScope }),
    prisma.key.count({ where: { ...keyScope, status: "ACTIVE" } }),
    prisma.key.count({ where: { ...keyScope, status: "EXPIRED" } }),
    prisma.key.count({ where: { ...keyScope, status: "BANNED" } }),
    prisma.log.count({ where: { ...logScope, action: { startsWith: "validate:" } } }),
    prisma.log.count({
      where: { ...logScope, action: { startsWith: "validate:" }, createdAt: { gte: dayAgo } },
    }),
    prisma.log.count({
      where: { ...logScope, action: { startsWith: "validate:" }, success: false },
    }),
    isAdmin ? prisma.user.count() : Promise.resolve(1),
  ]);

  // Plan distribution (scoped)
  const planDistribution = await prisma.key.groupBy({
    by: ["plan"],
    where: keyScope,
    _count: { plan: true },
  });

  // Recent activity (scoped)
  const recentActivity = await prisma.log.findMany({
    where: logScope,
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      action: true,
      ip: true,
      success: true,
      createdAt: true,
    },
  });

  return success({
    keys: {
      total: totalKeys,
      active: activeKeys,
      expired: expiredKeys,
      banned: bannedKeys,
    },
    validations: {
      total: totalValidations,
      last24h: recentValidations,
      failed: failedValidations,
    },
    users: totalUsers,
    planDistribution: planDistribution.map((p: { plan: string; _count: { plan: number } }) => ({
      plan: p.plan,
      count: p._count.plan,
    })),
    recentActivity,
  });
}
