// ─────────────────────────────────────────────────────────
// /api/keys — License Key CRUD
// GET: List all keys | POST: Create a new key
// ─────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { success, error } from "@/lib/api-response";
import { encrypt, generateLicenseKey, generateNonce, generateSecureToken } from "@/lib/crypto";
import { getExpiryDate, isPlanValid, formatKeyMask } from "@/lib/license";

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

// ─── GET: List keys (scoped to user + project) ──────────
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return error("Unauthorized.", 401);

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  const status = searchParams.get("status") || undefined;
  const plan = searchParams.get("plan") || undefined;
  const projectId = searchParams.get("projectId") || undefined;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (plan) where.plan = plan;
  if (projectId) where.projectId = projectId;

  // VIEWER sees only own keys, ADMIN sees all
  if (user.role !== "ADMIN") {
    where.createdById = user.sub;
  }

  const [keys, total] = await Promise.all([
    prisma.key.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        mask: true,
        plan: true,
        status: true,
        hwidLocked: true,
        maxSessions: true,
        activeSessions: true,
        note: true,
        expiresAt: true,
        createdAt: true,
        projectId: true,
        project: { select: { name: true } },
        createdBy: { select: { email: true } },
        _count: { select: { logs: true } },
      },
    }),
    prisma.key.count({ where }),
  ]);

  return success({
    keys,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// ─── POST: Create a new key ─────────────────────────────
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return error("Unauthorized.", 401);

  try {
    const body = await request.json();
    const { plan, maxSessions = 1, count = 1, customDays, note, projectId } = body;

    if (!plan || !isPlanValid(plan)) {
      return error("Invalid plan. Must be DAILY, WEEKLY, MONTHLY, LIFETIME, or CUSTOM.", 400);
    }

    if (plan === "CUSTOM" && (!customDays || customDays < 1 || customDays > 3650)) {
      return error("Custom plan requires customDays between 1 and 3650.", 400);
    }

    if (count < 1 || count > 50) {
      return error("Count must be between 1 and 50.", 400);
    }

    // Validate project if provided
    if (projectId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { ownerId: true },
      });
      if (!project) return error("Project not found.", 404);
      if (user.role !== "ADMIN" && project.ownerId !== user.sub) {
        return error("Project not found.", 404);
      }
    }

    const keys = [];

    for (let i = 0; i < count; i++) {
      const rawKey = generateLicenseKey();
      const encryptedKey = await encrypt(rawKey);
      const serverVar = generateSecureToken(16);
      const serverNonce = generateNonce();

      const key = await prisma.key.create({
        data: {
          key: encryptedKey,
          mask: formatKeyMask(rawKey),
          plan,
          maxSessions,
          serverVar: await encrypt(serverVar),
          serverNonce,
          customDays: plan === "CUSTOM" ? customDays : null,
          note: note || null,
          expiresAt: getExpiryDate(plan, customDays),
          createdById: user.sub,
          projectId: projectId || null,
        },
      });

      keys.push({
        id: key.id,
        key: rawKey, // Only returned on creation, never again
        mask: key.mask,
        plan: key.plan,
        note: key.note,
        expiresAt: key.expiresAt,
      });
    }

    await prisma.log.create({
      data: {
        action: "keys_created",
        userId: user.sub,
        payload: JSON.stringify({ count, plan, projectId }),
        success: true,
      },
    });

    return success({ keys }, 201);
  } catch (err) {
    console.error("Key creation error:", err);
    return error("Failed to create keys.", 500);
  }
}
