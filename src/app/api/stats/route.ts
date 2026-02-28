// ─────────────────────────────────────────────────────────
// GET /api/stats — Dashboard statistics
// ─────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { success, error } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  const token =
    request.cookies.get("auth_token")?.value ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) return error("Unauthorized.", 401);

  try {
    await verifyToken(token);
  } catch {
    return error("Invalid token.", 401);
  }

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
    prisma.key.count(),
    prisma.key.count({ where: { status: "ACTIVE" } }),
    prisma.key.count({ where: { status: "EXPIRED" } }),
    prisma.key.count({ where: { status: "BANNED" } }),
    prisma.log.count({ where: { action: { startsWith: "validate:" } } }),
    prisma.log.count({
      where: { action: { startsWith: "validate:" }, createdAt: { gte: dayAgo } },
    }),
    prisma.log.count({
      where: { action: { startsWith: "validate:" }, success: false },
    }),
    prisma.user.count(),
  ]);

  // Plan distribution
  const planDistribution = await prisma.key.groupBy({
    by: ["plan"],
    _count: { plan: true },
  });

  // Recent activity (last 10 logs)
  const recentActivity = await prisma.log.findMany({
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
