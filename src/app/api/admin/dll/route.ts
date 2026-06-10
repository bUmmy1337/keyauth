// ─────────────────────────────────────────────────────────
// POST /api/admin/dll — Upload encrypted DLL payload
// DELETE /api/admin/dll — Remove DLL payload from project
// Admin-only endpoint
// ─────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { success, error } from "@/lib/api-response";

export const runtime = "nodejs";

// Max DLL size: 50 MB (base64 encoded will be ~67 MB)
const MAX_DLL_SIZE = 50 * 1024 * 1024;

/**
 * POST — Upload DLL binary for a project
 * Body: { projectId: string, dll: string (base64) }
 */
export async function POST(request: NextRequest) {
  const token =
    request.cookies.get("auth_token")?.value ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) return error("Unauthorized.", 401);

  let user;
  try {
    user = await verifyToken(token);
  } catch {
    return error("Invalid token.", 401);
  }

  if (user.role !== "ADMIN") {
    return error("Admin access required.", 403);
  }

  try {
    const contentType = request.headers.get("content-type") || "";

    let projectId: string;
    let dllBytes: Uint8Array;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      projectId = String(formData.get("projectId") || "");
      const file = formData.get("dll");

      if (!projectId || !file || !(file instanceof File)) {
        return error("projectId and dll file are required.", 400);
      }

      dllBytes = new Uint8Array(await file.arrayBuffer());
    } else {
      const body = await request.json();
      const { projectId: pid, dll } = body as { projectId: string; dll: string };

      if (!pid || !dll) {
        return error("projectId and dll (base64) are required.", 400);
      }

      projectId = pid;

      try {
        dllBytes = new Uint8Array(Buffer.from(dll, "base64"));
      } catch {
        return error("Invalid base64 DLL data.", 400);
      }
    }

    // Validate project belongs to user
    const project = await prisma.project.findFirst({
      where: { id: projectId, ownerId: user.sub },
      select: { id: true },
    });

    if (!project) {
      return error("Project not found.", 404);
    }

    if (dllBytes.length > MAX_DLL_SIZE) {
      return error(`DLL exceeds maximum size of ${MAX_DLL_SIZE / 1024 / 1024} MB.`, 400);
    }

    // Validate PE signature (MZ header)
    if (dllBytes.length < 64 || dllBytes[0] !== 0x4D || dllBytes[1] !== 0x5A) {
      return error("Invalid DLL: missing MZ signature.", 400);
    }

    // Compute SHA-256 hash of the raw DLL
    const hashBuffer = await crypto.subtle.digest("SHA-256", dllBytes as BufferSource);
    const dllHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Encrypt DLL at rest using AES-256-GCM (server ENCRYPTION_KEY)
    const encKey = process.env.ENCRYPTION_KEY;
    if (!encKey || encKey.length < 32) {
      return error("Server encryption key not configured.", 500);
    }

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(encKey).slice(0, 32),
      { name: "AES-GCM" },
      false,
      ["encrypt"]
    );

    const encryptedDll = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as BufferSource, tagLength: 128 },
      keyMaterial,
      dllBytes as BufferSource
    );

    // Store as: iv_base64:ciphertext_base64
    const ivB64 = Buffer.from(iv).toString("base64");
    const ctB64 = Buffer.from(new Uint8Array(encryptedDll)).toString("base64");
    const storedData = `${ivB64}:${ctB64}`;

    await prisma.project.update({
      where: { id: projectId },
      data: {
        dllData: storedData,
        dllHash,
        dllUploadedAt: new Date(),
      },
    });

    return success({
      message: "DLL uploaded successfully.",
      hash: dllHash,
      size: dllBytes.length,
      uploadedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("DLL upload error:", err);
    return error("Failed to upload DLL.", 500);
  }
}

/**
 * DELETE — Remove DLL from a project
 * Body: { projectId: string }
 */
export async function DELETE(request: NextRequest) {
  const token =
    request.cookies.get("auth_token")?.value ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) return error("Unauthorized.", 401);

  let user;
  try {
    user = await verifyToken(token);
  } catch {
    return error("Invalid token.", 401);
  }

  if (user.role !== "ADMIN") {
    return error("Admin access required.", 403);
  }

  try {
    const body = await request.json();
    const { projectId } = body as { projectId: string };

    if (!projectId) {
      return error("projectId is required.", 400);
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, ownerId: user.sub },
      select: { id: true },
    });

    if (!project) {
      return error("Project not found.", 404);
    }

    await prisma.project.update({
      where: { id: projectId },
      data: {
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
