// ─────────────────────────────────────────────────────────
// /api/keys/[id] — Single key operations
// GET: View key | PATCH: Update key | DELETE: Revoke key
// ─────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
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

type RouteContext = { params: Promise<{ id: string }> };

// ─── GET: single key details ────────────────────────────
export async function GET(request: NextRequest, context: RouteContext) {
  const user = await getAuthUser(request);
  if (!user) return error("Unauthorized.", 401);

  const { id } = await context.params;

  const key = await prisma.key.findUnique({
    where: { id },
    include: {
      createdBy: { select: { email: true } },
      project: { select: { id: true, name: true } },
      logs: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          action: true,
          ip: true,
          hwid: true,
          success: true,
          createdAt: true,
        },
      },
    },
  });

  if (!key) return error("Key not found.", 404);

  // VIEWER can only see own keys
  if (user.role !== "ADMIN" && key.createdById !== user.sub) {
    return error("Key not found.", 404);
  }

  // Never return the actual encrypted key or server variables
  const { key: _encKey, serverVar: _sv, serverNonce: _sn, ...safeKey } = key;

  return success(safeKey);
}

// ─── PATCH: update key (status, HWID reset, etc.) ───────
export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await getAuthUser(request);
  if (!user) return error("Unauthorized.", 401);

  const { id } = await context.params;

  // Verify ownership (VIEWER can only edit own keys)
  if (user.role !== "ADMIN") {
    const key = await prisma.key.findUnique({ where: { id }, select: { createdById: true } });
    if (!key || key.createdById !== user.sub) return error("Key not found.", 404);
  }

  try {
    const body = await request.json();
    const { status, resetHwid, maxSessions } = body;

    const updateData: Record<string, unknown> = {};

    if (status && ["ACTIVE", "EXPIRED", "BANNED", "REVOKED"].includes(status)) {
      updateData.status = status;
    }

    if (resetHwid === true) {
      updateData.hwid = null;
      updateData.hwidLocked = false;
      updateData.activeSessions = 0;
    }

    if (maxSessions && maxSessions >= 1 && maxSessions <= 10) {
      updateData.maxSessions = maxSessions;
    }

    if (Object.keys(updateData).length === 0) {
      return error("No valid fields to update.", 400);
    }

    const key = await prisma.key.update({ where: { id }, data: updateData });

    await prisma.log.create({
      data: {
        action: "key_updated",
        userId: user.sub,
        keyId: id,
        payload: JSON.stringify(updateData),
        success: true,
      },
    });

    return success({ id: key.id, status: key.status, hwidLocked: key.hwidLocked });
  } catch {
    return error("Failed to update key.", 500);
  }
}

// ─── DELETE: revoke a key ───────────────────────────────
export async function DELETE(request: NextRequest, context: RouteContext) {
  const user = await getAuthUser(request);
  if (!user) return error("Unauthorized.", 401);

  const { id } = await context.params;

  // Verify ownership
  if (user.role !== "ADMIN") {
    const key = await prisma.key.findUnique({ where: { id }, select: { createdById: true } });
    if (!key || key.createdById !== user.sub) return error("Key not found.", 404);
  }

  try {
    await prisma.key.update({
      where: { id },
      data: { status: "REVOKED" },
    });

    await prisma.log.create({
      data: {
        action: "key_revoked",
        userId: user.sub,
        keyId: id,
        success: true,
      },
    });

    return success({ message: "Key revoked." });
  } catch {
    return error("Failed to revoke key.", 500);
  }
}
