// ─────────────────────────────────────────────────────────
// POST /api/telegram — Telegram Bot License Lookup
// The bot receives a PC HWID + license key from the user
// and returns license data. The HWID is the real machine ID
// (generated client-side), NOT the Telegram user ID.
// Supports: validate, info, reset_hwid
// ─────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt, hashHWID, generateNonce } from "@/lib/crypto";
import { success, error } from "@/lib/api-response";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { isKeyExpired } from "@/lib/license";

export const runtime = "nodejs";

interface TelegramRequest {
  action: "validate" | "info" | "reset_hwid";
  key: string;
  hwid?: string;               // PC hardware ID (client-generated)
  telegram_id?: string;        // Optional: for audit logging only
  telegram_username?: string;  // Optional: for audit logging only
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);

  // Rate limit: 20 requests per minute per IP
  const limit = checkRateLimit(`telegram:${ip}`, {
    maxTokens: 20,
    refillRate: 20,
    windowMs: 60_000,
  });

  if (!limit.allowed) {
    return error("Rate limit exceeded. Try again later.", 429);
  }

  try {
    const body: TelegramRequest = await request.json();
    const { action, key: licenseKey, hwid, telegram_id, telegram_username } = body;

    if (!action || !licenseKey) {
      return error("Missing required fields: action, key", 400);
    }

    if (!["validate", "info", "reset_hwid"].includes(action)) {
      return error("Invalid action. Use: validate, info, reset_hwid", 400);
    }

    // Per-key rate limit
    const keyLimit = checkRateLimit(`telegram:key:${licenseKey}`, {
      maxTokens: 10,
      refillRate: 10,
      windowMs: 60_000,
    });

    if (!keyLimit.allowed) {
      return error("Too many requests for this key.", 429);
    }

    // ─── Find the key ───────────────────────────────────────
    const allKeys = await prisma.key.findMany({
      where: { status: { in: ["ACTIVE", "EXPIRED"] } },
      select: {
        id: true,
        key: true,
        plan: true,
        status: true,
        hwid: true,
        hwidLocked: true,
        maxSessions: true,
        activeSessions: true,
        customDays: true,
        note: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    let matchedKey = null;
    for (const k of allKeys) {
      try {
        const decrypted = await decrypt(k.key);
        if (decrypted === licenseKey) {
          matchedKey = k;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!matchedKey) {
      await logTelegram(ip, telegram_id, telegram_username, null, action, false, "invalid_key");
      return error("Invalid license key.", 404);
    }

    // Hash the PC HWID if provided (same algorithm as /api/validate)
    const hashedHwid = hwid ? await hashHWID(hwid) : null;

    // ─── Route by action ──────────────────────────────────
    switch (action) {
      // ── info: read-only lookup, no HWID required ─────────
      case "info": {
        const isExpired = isKeyExpired(matchedKey.expiresAt);
        await logTelegram(ip, telegram_id, telegram_username, matchedKey.id, action, true, "info");
        return success({
          valid: !isExpired && matchedKey.status === "ACTIVE",
          plan: matchedKey.plan,
          customDays: matchedKey.customDays,
          status: isExpired ? "EXPIRED" : matchedKey.status,
          hwid_locked: matchedKey.hwidLocked,
          hwid_match: hashedHwid ? matchedKey.hwid === hashedHwid : null,
          sessions: `${matchedKey.activeSessions}/${matchedKey.maxSessions}`,
          expires_at: matchedKey.expiresAt,
          created_at: matchedKey.createdAt,
          note: matchedKey.note,
        });
      }

      // ── validate: check key + PC HWID binding ───────────
      case "validate": {
        if (!hwid) {
          return error("Missing required field: hwid (PC hardware ID)", 400);
        }

        // Check expiry
        if (isKeyExpired(matchedKey.expiresAt)) {
          await prisma.key.update({
            where: { id: matchedKey.id },
            data: { status: "EXPIRED" },
          });
          await logTelegram(ip, telegram_id, telegram_username, matchedKey.id, action, false, "expired");
          return error("License key has expired.", 403);
        }

        if (matchedKey.status !== "ACTIVE") {
          await logTelegram(ip, telegram_id, telegram_username, matchedKey.id, action, false, "inactive");
          return error(`Key is ${matchedKey.status.toLowerCase()}.`, 403);
        }

        // HWID check (real PC hardware ID)
        if (matchedKey.hwidLocked && matchedKey.hwid) {
          if (matchedKey.hwid !== hashedHwid) {
            await logTelegram(ip, telegram_id, telegram_username, matchedKey.id, action, false, "hwid_mismatch");
            return error("Key is bound to a different machine.", 403);
          }
        } else if (!matchedKey.hwidLocked) {
          // First activation — lock HWID to this PC
          await prisma.key.update({
            where: { id: matchedKey.id },
            data: { hwid: hashedHwid, hwidLocked: true },
          });
        }

        // Rotate nonce
        const nonce = generateNonce();
        await prisma.key.update({
          where: { id: matchedKey.id },
          data: { serverNonce: nonce },
        });

        await logTelegram(ip, telegram_id, telegram_username, matchedKey.id, action, true, "valid");

        return success({
          valid: true,
          plan: matchedKey.plan,
          customDays: matchedKey.customDays,
          expires_at: matchedKey.expiresAt,
          nonce,
          note: matchedKey.note,
        });
      }

      // ── reset_hwid: unbind key from current PC ──────────
      case "reset_hwid": {
        if (!matchedKey.hwidLocked) {
          return success({ message: "Key is not bound to any machine." });
        }

        await prisma.key.update({
          where: { id: matchedKey.id },
          data: {
            hwid: null,
            hwidLocked: false,
            activeSessions: 0,
          },
        });

        await logTelegram(ip, telegram_id, telegram_username, matchedKey.id, action, true, "hwid_reset");

        return success({
          reset: true,
          message: "HWID binding has been removed. Key can be activated on a new machine.",
        });
      }
    }
  } catch (err) {
    console.error("Telegram API error:", err);
    return error("Internal server error.", 500);
  }
}

// ─── Audit Log Helper ─────────────────────────────────────
async function logTelegram(
  ip: string,
  telegramId: string | undefined,
  username: string | undefined,
  keyId: string | null,
  action: string,
  ok: boolean,
  detail: string,
) {
  try {
    await prisma.log.create({
      data: {
        action: `telegram:${action}:${detail}`,
        ip,
        hwid: telegramId ? `tg:${telegramId}` : undefined,
        userAgent: username ? `@${username}` : undefined,
        keyId,
        success: ok,
      },
    });
  } catch {
    // Non-critical, don't block response
  }
}
