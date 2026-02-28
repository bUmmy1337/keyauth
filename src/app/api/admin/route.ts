// ─────────────────────────────────────────────────────────
// GET /api/admin/users — Admin-only: list all users
// with their projects and key counts
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

  let user;
  try {
    user = await verifyToken(token);
  } catch {
    return error("Invalid token.", 401);
  }

  if (user.role !== "ADMIN") {
    return error("Admin access required.", 403);
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      _count: {
        select: {
          keys: true,
          projects: true,
        },
      },
      projects: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          slug: true,
          secret: true,
          description: true,
          portalEnabled: true,
          createdAt: true,
          _count: { select: { keys: true, portalUsers: true } },
        },
      },
    },
  });

  // Global stats
  const [totalKeys, totalProjects, activeKeys, totalPortalUsers] = await Promise.all([
    prisma.key.count(),
    prisma.project.count(),
    prisma.key.count({ where: { status: "ACTIVE" } }),
    prisma.portalUser.count(),
  ]);

  return success({
    users,
    stats: {
      totalUsers: users.length,
      totalProjects,
      totalKeys,
      activeKeys,
      totalPortalUsers,
    },
  });
}
