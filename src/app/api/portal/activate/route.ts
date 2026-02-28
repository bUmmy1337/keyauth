// ─────────────────────────────────────────────────────────
// POST /api/portal/activate — Activate a license key
// Links a license key to the portal user's account.
// The user then needs to bind HWID via the loader.
// ─────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPortalToken } from "@/lib/portal-auth";
import { decrypt } from "@/lib/crypto";
import { success, error } from "@/lib/api-response";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { isKeyExpired } from "@/lib/license";

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);

  const limit = checkRateLimit(`portal-activate:${ip}`, {
    maxTokens: 10,
    refillRate: 10,
    windowMs: 60_000,
  });

  if (!limit.allowed) {
    return error("Too many attempts. Try again later.", 429);
  }

  const token =
    request.cookies.get("portal_token")?.value ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    return error("Not authenticated.", 401);
  }

  try {
    const payload = await verifyPortalToken(token);

    const { key: licenseKey } = await request.json();

    if (!licenseKey || typeof licenseKey !== "string") {
      return error("License key is required.", 400);
    }

    // Get portal user
    const portalUser = await prisma.portalUser.findUnique({
      where: { id: payload.sub },
      select: { id: true, projectId: true, keyId: true },
    });

    if (!portalUser) {
      return error("User not found.", 404);
    }

    // Check if user already has a key
    if (portalUser.keyId) {
      return error("You already have a key activated. Contact support to change it.", 400);
    }

    // Find matching key in this project
    const projectKeys = await prisma.key.findMany({
      where: {
        projectId: portalUser.projectId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        key: true,
        status: true,
        expiresAt: true,
        portalUser: { select: { id: true } },
      },
    });

    let matchedKey = null;
    for (const k of projectKeys) {
      try {
        const decryptedKey = await decrypt(k.key);
        if (decryptedKey === licenseKey.trim()) {
          matchedKey = k;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!matchedKey) {
      await prisma.log.create({
        data: {
          action: "portal_activate_failed",
          ip,
          payload: JSON.stringify({ reason: "invalid_key", projectId: portalUser.projectId }),
          success: false,
        },
      });
      return error("Invalid license key.", 401);
    }

    // Check if key is already claimed by another portal user
    if (matchedKey.portalUser) {
      return error("This key is already activated by another user.", 409);
    }

    // Check expiry
    if (isKeyExpired(matchedKey.expiresAt)) {
      return error("This license key has expired.", 403);
    }

    // Link key to portal user
    await prisma.portalUser.update({
      where: { id: portalUser.id },
      data: { keyId: matchedKey.id },
    });

    await prisma.log.create({
      data: {
        action: "portal_key_activated",
        ip,
        keyId: matchedKey.id,
        payload: JSON.stringify({
          portalUserId: portalUser.id,
          projectId: portalUser.projectId,
        }),
        success: true,
      },
    });

    // Return updated key info
    const updatedKey = await prisma.key.findUnique({
      where: { id: matchedKey.id },
      select: {
        id: true,
        mask: true,
        plan: true,
        status: true,
        hwidLocked: true,
        expiresAt: true,
      },
    });

    return success({
      message: "Key activated successfully!",
      key: updatedKey,
      needsHwidBinding: !updatedKey?.hwidLocked,
    });
  } catch {
    return error("Invalid or expired token.", 401);
  }
}
