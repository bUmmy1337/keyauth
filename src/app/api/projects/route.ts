// ─────────────────────────────────────────────────────────
// /api/projects — Project CRUD
// GET: List projects | POST: Create a new project
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

// ─── GET: List projects (scoped to user) ─────────────────
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return error("Unauthorized.", 401);

  const where: Record<string, unknown> = {};

  // VIEWER sees only own projects, ADMIN sees all
  if (user.role !== "ADMIN") {
    where.ownerId = user.sub;
  }

  const projects = await prisma.project.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { email: true } },
      _count: { select: { keys: true, portalUsers: true } },
    },
  });

  return success({ projects });
}

// ─── POST: Create a new project ──────────────────────────
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return error("Unauthorized.", 401);

  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== "string" || name.trim().length < 1) {
      return error("Project name is required.", 400);
    }

    if (name.trim().length > 100) {
      return error("Project name must be 100 characters or less.", 400);
    }

    // Generate a unique project secret (64-char hex)
    const secret = `kv_${generateSecureToken(32)}`;

    // Generate URL slug from project name
    let slug = name.trim().toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .substring(0, 50);

    // Ensure slug uniqueness
    const existingSlug = await prisma.project.findUnique({ where: { slug } });
    if (existingSlug) {
      slug = `${slug}-${generateSecureToken(4)}`;
    }

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        secret,
        ownerId: user.sub,
        dashboardConfig: JSON.stringify({
          blocks: [
            { type: "key_info", enabled: true, order: 0 },
            { type: "copy_key", enabled: true, label: "Copy Key", order: 1 },
            { type: "download_loader", enabled: true, label: "Download Loader", order: 2 },
            { type: "hwid_status", enabled: true, order: 3 },
          ],
        }),
      },
    });

    await prisma.log.create({
      data: {
        action: "project_created",
        userId: user.sub,
        payload: JSON.stringify({ projectId: project.id, name: project.name }),
        success: true,
      },
    });

    return success({
      id: project.id,
      name: project.name,
      slug: project.slug,
      secret: project.secret,
      description: project.description,
      createdAt: project.createdAt,
    }, 201);
  } catch (err) {
    console.error("Project creation error:", err);
    return error("Failed to create project.", 500);
  }
}
