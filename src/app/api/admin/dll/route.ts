// ─────────────────────────────────────────────────────────
// POST /api/admin/dll — Finalize DLL upload from Vercel Blob
// DELETE /api/admin/dll — Remove DLL payload from project
// Admin-only endpoint
// ─────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { del, get, put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { success, error } from "@/lib/api-response";
import {
  encryptDllBytes,
  isAllowedBlobUrl,
  streamToUint8Array,
  validateDllBytes,
} from "@/lib/dll-storage";

export const runtime = "nodejs";

/**
 * POST — Finalize client upload: encrypt DLL and store in private Blob
 * Body: { projectId: string, blobUrl: string }
 */
export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) return error("Admin access required.", 403);

  try {
    const body = await request.json();
    const { projectId, blobUrl } = body as { projectId: string; blobUrl: string };

    if (!projectId || !blobUrl) {
      return error("projectId and blobUrl are required.", 400);
    }

    if (!isAllowedBlobUrl(blobUrl)) {
      return error("Invalid blob URL.", 400);
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, ownerId: user.sub },
      select: { id: true, dllBlobUrl: true },
    });

    if (!project) {
      return error("Project not found.", 404);
    }

    const uploadResult = await get(blobUrl, { access: "private", useCache: false });
    if (!uploadResult || uploadResult.statusCode !== 200 || !uploadResult.stream) {
      return error("Uploaded file not found.", 404);
    }

    const expectedPrefix = `dll-uploads/${projectId}/`;
    if (!uploadResult.blob.pathname.startsWith(expectedPrefix)) {
      return error("Upload does not belong to this project.", 403);
    }

    const dllBytes = await streamToUint8Array(uploadResult.stream);
    const validationError = validateDllBytes(dllBytes);
    if (validationError) {
      await del(blobUrl).catch(() => {});
      return error(validationError, 400);
    }

    const { stored, hash } = await encryptDllBytes(dllBytes);

    const encryptedBlob = await put(`dll/${projectId}/payload.enc`, Buffer.from(stored), {
      access: "private",
      contentType: "application/octet-stream",
      addRandomSuffix: false,
    });

    const blobsToDelete = [blobUrl];
    if (project.dllBlobUrl && project.dllBlobUrl !== encryptedBlob.url) {
      blobsToDelete.push(project.dllBlobUrl);
    }

    await Promise.all(blobsToDelete.map((url) => del(url).catch(() => {})));

    await prisma.project.update({
      where: { id: projectId },
      data: {
        dllBlobUrl: encryptedBlob.url,
        dllData: null,
        dllHash: hash,
        dllUploadedAt: new Date(),
      },
    });

    return success({
      message: "DLL uploaded successfully.",
      hash,
      size: dllBytes.length,
      uploadedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("DLL finalize error:", err);
    return error("Failed to upload DLL.", 500);
  }
}

/**
 * DELETE — Remove DLL from a project
 * Body: { projectId: string }
 */
export async function DELETE(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) return error("Admin access required.", 403);

  try {
    const body = await request.json();
    const { projectId } = body as { projectId: string };

    if (!projectId) {
      return error("projectId is required.", 400);
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, ownerId: user.sub },
      select: { id: true, dllBlobUrl: true },
    });

    if (!project) {
      return error("Project not found.", 404);
    }

    if (project.dllBlobUrl) {
      await del(project.dllBlobUrl).catch(() => {});
    }

    await prisma.project.update({
      where: { id: projectId },
      data: {
        dllBlobUrl: null,
        dllData: null,
        dllHash: null,
        dllUploadedAt: null,
      },
    });

    return success({ message: "DLL removed successfully." });
  } catch (err) {
    console.error("DLL delete error:", err);
    return error("Failed to remove DLL.", 500);
  }
}
