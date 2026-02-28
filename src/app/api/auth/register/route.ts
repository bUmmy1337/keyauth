// ─────────────────────────────────────────────────────────
// POST /api/auth/register — Register a new user
// • First user: auto-created as ADMIN (setup mode)
// • Subsequent users: requires ADMIN auth token
// ─────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { signToken, verifyToken } from "@/lib/auth";
import { success, error } from "@/lib/api-response";

async function getAuthUser(request: NextRequest) {
  const token =
    request.cookies.get("auth_token")?.value ||
    request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  try {
    return await verifyToken(token);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const userCount = await prisma.user.count();
    const isSetup = userCount === 0;

    // Check if caller is admin (optional — used for role assignment)
    let callerRole: string | null = null;
    if (!isSetup) {
      const caller = await getAuthUser(request);
      if (caller) {
        callerRole = caller.role as string;
      }
    }

    const body = await request.json();
    const { email, password, role } = body;

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

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return error("A user with this email already exists.", 409);
    }

    // First user is always ADMIN; ADMINs can assign roles; self-registration gets VIEWER
    const assignedRole = isSetup
      ? "ADMIN"
      : callerRole === "ADMIN"
        ? (role === "ADMIN" ? "ADMIN" : "VIEWER")
        : "VIEWER";

    const bcrypt = await import("bcryptjs");
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: assignedRole,
      },
    });

    const token = await signToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    await prisma.log.create({
      data: {
        action: isSetup ? "admin_registered" : "user_created",
        userId: user.id,
        payload: isSetup ? undefined : JSON.stringify({ by: callerRole, role: assignedRole }),
        success: true,
      },
    });

    const response = success(
      { token, user: { id: user.id, email: user.email, role: user.role } },
      201
    );

    // Set cookie for self-registration (setup or public)
    if (!callerRole) {
      response.headers.set(
        "Set-Cookie",
        `auth_token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`
      );
    }

    return response;
  } catch (err) {
    console.error("Register error:", err);
    return error("Internal server error.", 500);
  }
}
