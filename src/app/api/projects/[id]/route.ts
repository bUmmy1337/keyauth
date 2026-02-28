// ─────────────────────────────────────────────────────────
// /api/projects/[id] — Single project operations
// GET: View | PATCH: Update | DELETE: Remove
// ─────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { success, error } from "@/lib/api-response";
import { generateSecureToken } from "@/lib/crypto";

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

// ─── GET: single project details ─────────────────────────
export async function GET(request: NextRequest, context: RouteContext) {
  const user = await getAuthUser(request);
  if (!user) return error("Unauthorized.", 401);

  const { id } = await context.params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      owner: { select: { email: true } },
      _count: { select: { keys: true, portalUsers: true } },
    },
  });

  if (!project) return error("Project not found.", 404);

  if (user.role !== "ADMIN" && project.ownerId !== user.sub) {
    return error("Project not found.", 404);
  }

  return success(project);
}

// ─── PATCH: update project ───────────────────────────────
export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await getAuthUser(request);
  if (!user) return error("Unauthorized.", 401);

  const { id } = await context.params;

  const project = await prisma.project.findUnique({
    where: { id },
    select: { ownerId: true },
  });

  if (!project) return error("Project not found.", 404);
  if (user.role !== "ADMIN" && project.ownerId !== user.sub) {
    return error("Project not found.", 404);
  }

  try {
    const body = await request.json();
    const { name, description, regenerateSecret, slug, portalEnabled, loaderUrl, requireHwidForDownload, dashboardConfig } = body;

    const updateData: Record<string, unknown> = {};

    if (name && typeof name === "string" && name.trim().length > 0) {
      updateData.name = name.trim();
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    if (regenerateSecret === true) {
      updateData.secret = `kv_${generateSecureToken(32)}`;
    }

    if (slug && typeof slug === "string") {
      const cleanSlug = slug.trim().toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .substring(0, 50);
      if (cleanSlug.length > 0) {
        const existingSlug = await prisma.project.findFirst({
          where: { slug: cleanSlug, id: { not: id } },
        });
        if (existingSlug) {
          return error("This slug is already taken.", 409);
        }
        updateData.slug = cleanSlug;
      }
    }

    if (portalEnabled !== undefined) {
      updateData.portalEnabled = Boolean(portalEnabled);
    }

    if (loaderUrl !== undefined) {
      updateData.loaderUrl = loaderUrl?.trim() || null;
    }

    if (requireHwidForDownload !== undefined) {
      updateData.requireHwidForDownload = Boolean(requireHwidForDownload);
    }

    if (dashboardConfig !== undefined) {
      updateData.dashboardConfig = typeof dashboardConfig === "string"
        ? dashboardConfig
        : JSON.stringify(dashboardConfig);
    }

    if (Object.keys(updateData).length === 0) {
      return error("No valid fields to update.", 400);
    }

    const updated = await prisma.project.update({
      where: { id },
      data: updateData,
    });

    await prisma.log.create({
      data: {
        action: "project_updated",
        userId: user.sub,
        payload: JSON.stringify({ projectId: id, fields: Object.keys(updateData) }),
        success: true,
      },
    });

    return success({
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      secret: updated.secret,
      description: updated.description,
      portalEnabled: updated.portalEnabled,
      loaderUrl: updated.loaderUrl,
      requireHwidForDownload: updated.requireHwidForDownload,
      dashboardConfig: updated.dashboardConfig,
    });
  } catch {
    return error("Failed to update project.", 500);
  }
}

// ─── DELETE: remove project (cascades keys) ──────────────
export async function DELETE(request: NextRequest, context: RouteContext) {
  const user = await getAuthUser(request);
  if (!user) return error("Unauthorized.", 401);

  const { id } = await context.params;

  const project = await prisma.project.findUnique({
    where: { id },
    select: { ownerId: true, name: true },
  });

  if (!project) return error("Project not found.", 404);
  if (user.role !== "ADMIN" && project.ownerId !== user.sub) {
    return error("Project not found.", 404);
  }

  try {
    await prisma.project.delete({ where: { id } });

    await prisma.log.create({
      data: {
        action: "project_deleted",
        userId: user.sub,
        payload: JSON.stringify({ projectId: id, name: project.name }),
        success: true,
      },
    });

    return success({ message: "Project deleted." });
  } catch {
    return error("Failed to delete project.", 500);
  }
}
