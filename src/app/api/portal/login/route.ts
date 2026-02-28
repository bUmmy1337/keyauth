// ─────────────────────────────────────────────────────────
// POST /api/portal/login — Login portal user
// ─────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { signPortalToken } from "@/lib/portal-auth";
import { success, error } from "@/lib/api-response";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);

  const limit = checkRateLimit(`portal-login:${ip}`, {
    maxTokens: 10,
    refillRate: 10,
    windowMs: 60_000,
  });

  if (!limit.allowed) {
    return error("Too many login attempts. Try again later.", 429);
  }

  try {
    const { username, password, projectId } = await request.json();

    if (!username || !password || !projectId) {
      return error("Username, password, and projectId are required.", 400);
    }

    const portalUser = await prisma.portalUser.findUnique({
      where: {
        username_projectId: {
          username: username.trim().toLowerCase(),
          projectId,
        },
      },
      include: {
        key: {
          select: {
            id: true,
            mask: true,
            plan: true,
            status: true,
            hwidLocked: true,
            expiresAt: true,
          },
        },
      },
    });

    if (!portalUser) {
      return error("Invalid credentials.", 401);
    }

    const bcrypt = await import("bcryptjs");
    const valid = await bcrypt.compare(password, portalUser.password);

    if (!valid) {
      await prisma.log.create({
        data: {
          action: "portal_login_failed",
          ip,
          userAgent: request.headers.get("user-agent") || undefined,
          payload: JSON.stringify({ projectId, username }),
          success: false,
        },
      });
      return error("Invalid credentials.", 401);
    }

    const token = await signPortalToken({
      sub: portalUser.id,
      username: portalUser.username,
      projectId: portalUser.projectId,
      type: "portal",
    });

    await prisma.log.create({
      data: {
        action: "portal_login_success",
        ip,
        userAgent: request.headers.get("user-agent") || undefined,
        payload: JSON.stringify({ projectId, username }),
        success: true,
      },
    });

    const response = success({
      token,
      user: {
        id: portalUser.id,
        username: portalUser.username,
        projectId: portalUser.projectId,
        keyId: portalUser.keyId,
        key: portalUser.key,
      },
    });

    response.headers.set(
      "Set-Cookie",
      `portal_token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`
    );

    return response;
  } catch (err) {
    console.error("Portal login error:", err);
    return error("Internal server error.", 500);
  }
}
