// ─────────────────────────────────────────────────────────
// POST /api/auth/register — Create first admin (setup only)
// ─────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { success, error } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    // Only allow registration if no users exist (initial setup)
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      return error("Registration is disabled. Contact admin.", 403);
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return error("Email and password are required.", 400);
    }

    if (password.length < 8) {
      return error("Password must be at least 8 characters.", 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return error("Invalid email format.", 400);
    }

    const bcrypt = await import("bcryptjs");
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: "ADMIN",
      },
    });

    const token = await signToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    await prisma.log.create({
      data: {
        action: "admin_registered",
        userId: user.id,
        success: true,
      },
    });

    const response = success(
      { token, user: { id: user.id, email: user.email, role: user.role } },
      201
    );

    response.headers.set(
      "Set-Cookie",
      `auth_token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`
    );

    return response;
  } catch (err) {
    console.error("Register error:", err);
    return error("Internal server error.", 500);
  }
}
