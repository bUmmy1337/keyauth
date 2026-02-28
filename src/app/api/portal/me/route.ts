// ─────────────────────────────────────────────────────────
// GET /api/portal/me — Get current portal user info
// Returns user data, key info, HWID status, project config
// ─────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPortalToken } from "@/lib/portal-auth";
import { success, error } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  const token =
    request.cookies.get("portal_token")?.value ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    return error("Not authenticated.", 401);
  }

  try {
    const payload = await verifyPortalToken(token);

    const portalUser = await prisma.portalUser.findUnique({
      where: { id: payload.sub },
      include: {
        key: {
          select: {
            id: true,
            mask: true,
            plan: true,
            status: true,
            hwid: true,
            hwidLocked: true,
            maxSessions: true,
            activeSessions: true,
            note: true,
            expiresAt: true,
            createdAt: true,
          },
        },
        project: {
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
        },
      },
    });

    if (!portalUser) {
      return error("User not found.", 404);
    }

    // Determine access level
    const hasKey = !!portalUser.key;
    const keyActive = hasKey && portalUser.key!.status === "ACTIVE";
    const hwidBound = hasKey && portalUser.key!.hwidLocked;
    const needsHwidBinding = keyActive && !hwidBound;
    const fullAccess = keyActive && hwidBound;

    // Only expose loader URL if user has full access (or HWID not required)
    const canDownloadLoader =
      hasKey &&
      keyActive &&
      (!portalUser.project.requireHwidForDownload || hwidBound);

    return success({
      user: {
        id: portalUser.id,
        username: portalUser.username,
        projectId: portalUser.projectId,
        createdAt: portalUser.createdAt,
      },
      key: portalUser.key
        ? {
            id: portalUser.key.id,
            mask: portalUser.key.mask,
            plan: portalUser.key.plan,
            status: portalUser.key.status,
            hwidLocked: portalUser.key.hwidLocked,
            maxSessions: portalUser.key.maxSessions,
            activeSessions: portalUser.key.activeSessions,
            note: portalUser.key.note,
            expiresAt: portalUser.key.expiresAt,
            createdAt: portalUser.key.createdAt,
          }
        : null,
      project: {
        id: portalUser.project.id,
        name: portalUser.project.name,
        slug: portalUser.project.slug,
        description: portalUser.project.description,
        dashboardConfig: portalUser.project.dashboardConfig
          ? JSON.parse(portalUser.project.dashboardConfig)
          : null,
        logoData: portalUser.project.logoData || null,
      },
      access: {
        hasKey,
        keyActive,
        hwidBound,
        needsHwidBinding,
        fullAccess,
        canDownloadLoader,
        loaderUrl: canDownloadLoader ? portalUser.project.loaderUrl : null,
      },
    });
  } catch {
    return error("Invalid or expired token.", 401);
  }
}
