// ─────────────────────────────────────────────────────────
// GET /api/portal/info?slug=xxx — Get public project info
// No auth required. Returns project name, portal config.
// ─────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { success, error } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return error("Project slug is required.", 400);
  }

  const project = await prisma.project.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      portalEnabled: true,
      loaderUrl: true,
      requireHwidForDownload: true,
      dashboardConfig: true,
      logoData: true,
    },
  });

  if (!project || !project.portalEnabled) {
    return error("Project not found.", 404);
  }

  return success({
    id: project.id,
    name: project.name,
    slug: project.slug,
    description: project.description,
    loaderUrl: project.loaderUrl ? true : false, // Don't expose actual URL without auth
    requireHwidForDownload: project.requireHwidForDownload,
    dashboardConfig: project.dashboardConfig
      ? JSON.parse(project.dashboardConfig)
      : null,
    logoData: project.logoData || null,
  });
}
