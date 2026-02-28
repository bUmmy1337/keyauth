// ─────────────────────────────────────────────────────────
// POST /api/heartbeat — Session heartbeat / deactivation
// Clients ping this to keep sessions alive, or notify exit
// ─────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt, hashHWID } from "@/lib/crypto";
import { success, error } from "@/lib/api-response";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);

  const limit = checkRateLimit(`heartbeat:${ip}`, {
    maxTokens: 60,
    refillRate: 60,
    windowMs: 60_000,
  });

  if (!limit.allowed) {
    return error("Rate limit exceeded.", 429);
  }

  try {
    const { key: licenseKey, hwid, action } = await request.json();

    if (!licenseKey || !hwid) {
      return error("Key and HWID required.", 400);
    }

    // Find the key
    const allKeys = await prisma.key.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, key: true, hwid: true, activeSessions: true },
    });

    let matchedKey = null;
    for (const k of allKeys) {
      try {
        if ((await decrypt(k.key)) === licenseKey) {
          matchedKey = k;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!matchedKey) {
      return error("Invalid key.", 401);
    }

    const hwidHash = await hashHWID(hwid);
    if (matchedKey.hwid !== hwidHash) {
      return error("HWID mismatch.", 403);
    }

    if (action === "deactivate") {
      await prisma.key.update({
        where: { id: matchedKey.id },
        data: {
          activeSessions: Math.max(0, matchedKey.activeSessions - 1),
        },
      });
      return success({ status: "deactivated" });
    }

    // Default: heartbeat acknowledged
    return success({ status: "alive", timestamp: Date.now() });
  } catch (err) {
    console.error("Heartbeat error:", err);
    return error("Internal error.", 500);
  }
}
