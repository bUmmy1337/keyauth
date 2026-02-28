// ─────────────────────────────────────────────────────────
// POST /api/portal/register — Register a portal user
// Creates an account on a project (no key required)
// ─────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { signPortalToken } from "@/lib/portal-auth";
import { success, error } from "@/lib/api-response";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);

  const limit = checkRateLimit(`portal-register:${ip}`, {
    maxTokens: 5,
    refillRate: 5,
    windowMs: 60_000,
  });

  if (!limit.allowed) {
    return error("Too many registration attempts. Try again later.", 429);
  }

  try {
    const { username, password, projectId } = await request.json();

    if (!username || !password || !projectId) {
      return error("Username, password, and projectId are required.", 400);
    }

    if (typeof username !== "string" || username.trim().length < 3 || username.trim().length > 32) {
      return error("Username must be 3-32 characters.", 400);
    }

    if (/[^a-zA-Z0-9_-]/.test(username.trim())) {
      return error("Username can only contain letters, numbers, hyphens, and underscores.", 400);
    }

    if (typeof password !== "string" || password.length < 6) {
      return error("Password must be at least 6 characters.", 400);
    }

    // Verify project exists and portal is enabled
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, portalEnabled: true },
    });

    if (!project || !project.portalEnabled) {
      return error("Project not found.", 404);
    }

    // Check if username is taken in this project
    const existing = await prisma.portalUser.findUnique({
      where: {
        username_projectId: { username: username.trim().toLowerCase(), projectId },
      },
    });

    if (existing) {
      return error("Username is already taken.", 409);
    }

    const bcrypt = await import("bcryptjs");
    const hashedPassword = await bcrypt.hash(password, 12);

    const portalUser = await prisma.portalUser.create({
      data: {
        username: username.trim().toLowerCase(),
        password: hashedPassword,
        projectId,
      },
    });

    const token = await signPortalToken({
      sub: portalUser.id,
      username: portalUser.username,
      projectId: portalUser.projectId,
      type: "portal",
    });

    await prisma.log.create({
      data: {
        action: "portal_user_registered",
        ip,
        userAgent: request.headers.get("user-agent") || undefined,
        payload: JSON.stringify({ projectId, username: portalUser.username }),
        success: true,
      },
    });

    const response = success(
      {
        token,
        user: {
          id: portalUser.id,
          username: portalUser.username,
          projectId: portalUser.projectId,
          keyId: null,
        },
      },
      201
    );

    response.headers.set(
      "Set-Cookie",
      `portal_token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`
    );

    return response;
  } catch (err) {
    console.error("Portal register error:", err);
    return error("Internal server error.", 500);
  }
}
