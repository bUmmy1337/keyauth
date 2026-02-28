// ─────────────────────────────────────────────────────────
// POST /api/projects/[id]/logo — Upload project logo (PNG)
// Max 512KB base64 PNG. Stored as data URI in Project.logoData
// DELETE /api/projects/[id]/logo — Remove project logo
// ─────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { success, error } from "@/lib/api-response";

const MAX_LOGO_BYTES = 512 * 1024; // 512 KB

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

// ─── POST: upload logo ────────────────────────────────────
export async function POST(request: NextRequest, context: RouteContext) {
  const user = await getAuthUser(request);
  if (!user) return error("Unauthorized.", 401);

  const { id } = await context.params;

  // Verify ownership
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
    const { logoData } = body;

    if (!logoData || typeof logoData !== "string") {
      return error("logoData (base64 data URI) is required.", 400);
    }

    // Validate it's a PNG data URI
    if (!logoData.startsWith("data:image/png;base64,")) {
      return error("Only PNG images are supported. Must be a data:image/png;base64,... URI.", 400);
    }

    // Check size (base64 string length ≈ 4/3 × bytes)
    const base64Part = logoData.slice("data:image/png;base64,".length);
    const estimatedBytes = Math.ceil(base64Part.length * 0.75);

    if (estimatedBytes > MAX_LOGO_BYTES) {
      return error(`Logo too large (${Math.round(estimatedBytes / 1024)}KB). Max is ${MAX_LOGO_BYTES / 1024}KB.`, 400);
    }

    await prisma.project.update({
      where: { id },
      data: { logoData },
    });

    return success({ message: "Logo uploaded successfully." });
  } catch {
    return error("Failed to upload logo.", 500);
  }
}

// ─── DELETE: remove logo ──────────────────────────────────
export async function DELETE(request: NextRequest, context: RouteContext) {
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

  await prisma.project.update({
    where: { id },
    data: { logoData: null },
  });

  return success({ message: "Logo removed." });
}
