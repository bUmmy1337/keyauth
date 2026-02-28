// ─────────────────────────────────────────────────────────
// GET /api/portal/chat — Get recent chat messages
// POST /api/portal/chat — Send a chat message
// Requires portal auth. Scoped to the user's project.
// ─────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPortalToken } from "@/lib/portal-auth";
import { success, error } from "@/lib/api-response";

// ─── GET: fetch messages ──────────────────────────────────
export async function GET(request: NextRequest) {
  const token =
    request.cookies.get("portal_token")?.value ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) return error("Not authenticated.", 401);

  try {
    const payload = await verifyPortalToken(token);

    // Optional cursor-based pagination via ?before=<messageId>&limit=50
    const { searchParams } = new URL(request.url);
    const before = searchParams.get("before"); // cursor: message ID
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);

    const where: Record<string, unknown> = { projectId: payload.projectId };
    if (before) {
      const cursor = await prisma.chatMessage.findUnique({
        where: { id: before },
        select: { createdAt: true },
      });
      if (cursor) {
        where.createdAt = { lt: cursor.createdAt };
      }
    }

    const messages = await prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        text: true,
        createdAt: true,
        author: {
          select: { id: true, username: true },
        },
      },
    });

    // Return in chronological order
    return success({ messages: messages.reverse() });
  } catch {
    return error("Invalid or expired token.", 401);
  }
}

// ─── POST: send message ──────────────────────────────────
export async function POST(request: NextRequest) {
  const token =
    request.cookies.get("portal_token")?.value ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) return error("Not authenticated.", 401);

  try {
    const payload = await verifyPortalToken(token);

    const body = await request.json();
    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!text || text.length === 0) {
      return error("Message text is required.", 400);
    }

    if (text.length > 2000) {
      return error("Message too long (max 2000 characters).", 400);
    }

    // Verify user still exists
    const user = await prisma.portalUser.findUnique({
      where: { id: payload.sub },
      select: { id: true, projectId: true },
    });

    if (!user) return error("User not found.", 404);

    // Check project has chat enabled (via dashboardConfig having a chat block)
    const project = await prisma.project.findUnique({
      where: { id: user.projectId },
      select: { portalEnabled: true, dashboardConfig: true },
    });

    if (!project || !project.portalEnabled) {
      return error("Project not available.", 404);
    }

    const message = await prisma.chatMessage.create({
      data: {
        text,
        authorId: user.id,
        projectId: user.projectId,
      },
      select: {
        id: true,
        text: true,
        createdAt: true,
        author: {
          select: { id: true, username: true },
        },
      },
    });

    return success({ message });
  } catch {
    return error("Invalid or expired token.", 401);
  }
}
