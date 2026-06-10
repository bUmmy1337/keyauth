// ─────────────────────────────────────────────────────────
// POST /api/admin/dll/blob — Client upload token for Vercel Blob
// File bytes go directly to Blob (bypasses 4.5 MB serverless limit)
// ─────────────────────────────────────────────────────────

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { MAX_DLL_SIZE } from "@/lib/dll-storage";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let projectId = "";
        try {
          projectId = JSON.parse(clientPayload || "{}").projectId || "";
        } catch {
          throw new Error("Invalid upload payload.");
        }

        if (!projectId) {
          throw new Error("projectId is required.");
        }

        const expectedPrefix = `dll-uploads/${projectId}/`;
        if (!pathname.startsWith(expectedPrefix)) {
          throw new Error("Invalid upload path.");
        }

        const project = await prisma.project.findFirst({
          where: { id: projectId, ownerId: user.sub },
          select: { id: true },
        });

        if (!project) {
          throw new Error("Project not found.");
        }

        return {
          allowedContentTypes: [
            "application/octet-stream",
            "application/x-msdownload",
            "application/x-dosexec",
          ],
          maximumSizeInBytes: MAX_DLL_SIZE,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ projectId, userId: user.sub }),
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload token failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
