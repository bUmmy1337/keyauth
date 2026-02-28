// ─────────────────────────────────────────────────────────
// POST /api/validate — License Validation Endpoint
// Edge Runtime for sub-100ms global latency
// ─────────────────────────────────────────────────────────
//
// Security features:
// - AES-256-GCM encrypted request/response payloads
// - HWID fingerprint locking (Motherboard UUID + Disk Serial)
// - Server-side variable injection (anti memory-patch)
// - One-time nonce rotation (anti replay)
// - Rate limiting per IP + key
// - Full audit logging
// ─────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt, encrypt, hashHWID, generateNonce } from "@/lib/crypto";
import { success, error, encryptedSuccess } from "@/lib/api-response";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { isKeyExpired } from "@/lib/license";

// NOTE: We use Node runtime here because Prisma requires it.
// For true Edge deployment, replace with a fetch-based DB client
// (e.g., Neon HTTP driver, Supabase REST, or PlanetScale HTTP).
export const runtime = "nodejs";

interface ValidateRequest {
  key: string;              // License key in plaintext
  hwid: string;             // Hardware ID fingerprint
  secret?: string;          // Project secret (optional, filters by project)
  encrypted_payload?: string; // Optional E2E encrypted payload
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);

  // ─── Rate Limiting ──────────────────────────────────────
  const ipLimit = checkRateLimit(`validate:${ip}`, {
    maxTokens: 30,
    refillRate: 30,
    windowMs: 60_000,
  });

  if (!ipLimit.allowed) {
    return error("Rate limit exceeded.", 429);
  }

  try {
    // ─── Parse Request ────────────────────────────────────
    let body: ValidateRequest;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      body = await request.json();
    } else {
      return error("Content-Type must be application/json.", 415);
    }

    // If payload is E2E encrypted, decrypt it first
    if (body.encrypted_payload && !body.key) {
      try {
        const decrypted = await decrypt(body.encrypted_payload);
        body = JSON.parse(decrypted);
      } catch {
        return error("Failed to decrypt payload.", 400);
      }
    }

    const { key: licenseKey, hwid, secret: projectSecret } = body;

    if (!licenseKey || !hwid) {
      return error("License key and HWID are required.", 400);
    }

    // Per-key rate limit (stricter)
    const keyLimit = checkRateLimit(`validate:key:${licenseKey}`, {
      maxTokens: 10,
      refillRate: 10,
      windowMs: 60_000,
    });

    if (!keyLimit.allowed) {
      return error("Too many validation attempts for this key.", 429);
    }

    // ─── Resolve project scope ────────────────────────────
    let projectId: string | undefined;
    if (projectSecret) {
      const project = await prisma.project.findUnique({
        where: { secret: projectSecret },
        select: { id: true },
      });
      if (!project) {
        return error("Invalid project secret.", 401);
      }
      projectId = project.id;
    }

    // ─── Find Key ─────────────────────────────────────────
    // We need to check all keys since the stored key is encrypted
    const keyWhere: Record<string, unknown> = { status: "ACTIVE" };
    if (projectId) keyWhere.projectId = projectId;

    const allKeys = await prisma.key.findMany({
      where: keyWhere,
      select: {
        id: true,
        key: true,
        plan: true,
        status: true,
        hwid: true,
        hwidLocked: true,
        maxSessions: true,
        activeSessions: true,
        serverVar: true,
        serverNonce: true,
        note: true,
        expiresAt: true,
      },
    });

    let matchedKey = null;

    for (const k of allKeys) {
      try {
        const decryptedKey = await decrypt(k.key);
        if (decryptedKey === licenseKey) {
          matchedKey = k;
          break;
        }
      } catch {
        continue; // Skip corrupted keys
      }
    }

    if (!matchedKey) {
      await logValidation(ip, request, null, hwid, false, "invalid_key");
      return error("Invalid license key.", 401);
    }

    // ─── Check Expiry ─────────────────────────────────────
    if (isKeyExpired(matchedKey.expiresAt)) {
      await prisma.key.update({
        where: { id: matchedKey.id },
        data: { status: "EXPIRED" },
      });
      await logValidation(ip, request, matchedKey.id, hwid, false, "expired");
      return error("License key has expired.", 403);
    }

    // ─── HWID Verification ────────────────────────────────
    const hwidHash = await hashHWID(hwid);

    if (matchedKey.hwidLocked && matchedKey.hwid) {
      // Key is already locked to a different machine
      if (matchedKey.hwid !== hwidHash) {
        await logValidation(ip, request, matchedKey.id, hwid, false, "hwid_mismatch");
        return error("License key is locked to a different machine.", 403);
      }
    } else {
      // Lock key to this HWID on first use
      await prisma.key.update({
        where: { id: matchedKey.id },
        data: { hwid: hwidHash, hwidLocked: true },
      });
    }

    // ─── Session Check ────────────────────────────────────
    // If the same HWID is re-validating (same machine), reuse its
    // existing session slot instead of allocating a new one.
    const isSameDevice = matchedKey.hwid === hwidHash;

    if (!isSameDevice && matchedKey.activeSessions >= matchedKey.maxSessions) {
      await logValidation(ip, request, matchedKey.id, hwid, false, "max_sessions");
      return error("Maximum concurrent sessions reached.", 403);
    }

    // ─── Rotate Server Nonce (anti-replay) ────────────────
    const newNonce = generateNonce();
    await prisma.key.update({
      where: { id: matchedKey.id },
      data: {
        serverNonce: newNonce,
        // Only increment session count for new devices
        ...(isSameDevice ? {} : { activeSessions: { increment: 1 } }),
      },
    });

    // ─── Decrypt server variable ──────────────────────────
    let serverVariable = null;
    if (matchedKey.serverVar) {
      try {
        serverVariable = await decrypt(matchedKey.serverVar);
      } catch {
        serverVariable = null;
      }
    }

    // ─── Successfully validated ───────────────────────────
    await logValidation(ip, request, matchedKey.id, hwid, true, "validated");

    // Return encrypted response with server-side variables
    return encryptedSuccess({
      valid: true,
      plan: matchedKey.plan,
      expiresAt: matchedKey.expiresAt,
      note: matchedKey.note,
      serverVar: serverVariable,
      nonce: newNonce,
      sessionId: crypto.randomUUID(),
    });
  } catch (err) {
    console.error("Validation error:", err);
    return error("Internal validation error.", 500);
  }
}

// ─── Audit Log Helper ─────────────────────────────────────
async function logValidation(
  ip: string,
  request: NextRequest,
  keyId: string | null,
  hwid: string,
  isSuccess: boolean,
  action: string
) {
  try {
    await prisma.log.create({
      data: {
        action: `validate:${action}`,
        ip,
        userAgent: request.headers.get("user-agent") || undefined,
        hwid: await hashHWID(hwid),
        keyId,
        success: isSuccess,
      },
    });
  } catch (e) {
    console.error("Failed to log validation:", e);
  }
}
