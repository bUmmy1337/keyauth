// ─────────────────────────────────────────────────────────
// POST /api/auth/register — Register a new admin user
// • First user: auto-created as ADMIN (setup mode)
// • Subsequent users: requires ADMIN auth token (no self-registration)
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

    // After initial setup, only admins can create new users
    const caller = isSetup ? null : await getAuthUser(request);

    if (!isSetup && (!caller || caller.role !== "ADMIN")) {
      return error("Registration is disabled. Only admins can create new users.", 403);
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

    // First user is always ADMIN; subsequent users: admin assigns role
    const assignedRole = isSetup
      ? "ADMIN"
      : (role === "ADMIN" ? "ADMIN" : "VIEWER");

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
        payload: isSetup ? undefined : JSON.stringify({ by: caller?.role, role: assignedRole }),
        success: true,
      },
    });

    const response = success(
      { token, user: { id: user.id, email: user.email, role: user.role } },
      201
    );

    // Set cookie for initial setup only
    if (isSetup) {
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
