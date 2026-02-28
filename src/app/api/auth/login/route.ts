// ─────────────────────────────────────────────────────────
// POST /api/auth/login — Admin Authentication
// ─────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { success, error } from "@/lib/api-response";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 attempts per minute per IP
    const ip = getClientIP(request);
    const limit = checkRateLimit(`login:${ip}`, {
      maxTokens: 5,
      refillRate: 5,
      windowMs: 60_000,
    });

    if (!limit.allowed) {
      return error("Too many login attempts. Try again later.", 429);
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return error("Email and password are required.", 400);
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Constant-time response to prevent enumeration
      return error("Invalid credentials.", 401);
    }

    // Dynamic import for bcryptjs (not Edge compatible, use in Node runtime)
    const bcrypt = await import("bcryptjs");
    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      await prisma.log.create({
        data: {
          action: "login_failed",
          ip,
          userAgent: request.headers.get("user-agent") || undefined,
          userId: user.id,
          success: false,
        },
      });
      return error("Invalid credentials.", 401);
    }

    const token = await signToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    await prisma.log.create({
      data: {
        action: "login_success",
        ip,
        userAgent: request.headers.get("user-agent") || undefined,
        userId: user.id,
        success: true,
      },
    });

    const response = success({ token, user: { id: user.id, email: user.email, role: user.role } });

    // Set HTTP-only cookie
    response.headers.set(
      "Set-Cookie",
      `auth_token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`
    );

    return response;
  } catch (err) {
    console.error("Login error:", err);
    return error("Internal server error.", 500);
  }
}
