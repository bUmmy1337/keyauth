// ─────────────────────────────────────────────────────────
// POST /api/loader/download — Step 2 of secure DLL protocol
//
// Loader sends: AES_Encrypt(token + hwid + timestamp + salt)
// Server decrypts, validates freshness (<5s), HWID match,
// then decrypts stored DLL and re-encrypts with session AES key,
// streaming back the encrypted binary blob.
// ─────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { error } from "@/lib/api-response";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { consumeToken } from "@/lib/loader-tokens";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);

  // Rate limit: 5 download attempts per minute per IP
  const limit = checkRateLimit(`loader:download:${ip}`, {
    maxTokens: 5,
    refillRate: 5,
    windowMs: 60_000,
  });

  if (!limit.allowed) {
    return error("Rate limit exceeded.", 429);
  }

  try {
    const body = await request.json();
    const { encryptedPayload, downloadToken } = body as {
      encryptedPayload: string; // base64(AES_GCM(JSON{token, hwid, timestamp, salt}))
      downloadToken: string;
    };

    if (!encryptedPayload || !downloadToken) {
      return error("encryptedPayload and downloadToken are required.", 400);
    }

    // ─── Consume one-time token ───────────────────────────
    const tokenData = consumeToken(downloadToken);
    if (!tokenData) {
      return error("Invalid or expired download token.", 403);
    }

    // ─── Decrypt the loader's payload using session AES key ──
    let payloadData: {
      token: string;
      hwid: string;
      timestamp: number;
      salt: string;
    };

    try {
      // Decode base64 payload
      const encBytes = new Uint8Array(Buffer.from(encryptedPayload, "base64"));

      // Import session AES key
      const aesKey = await crypto.subtle.importKey(
        "raw",
        tokenData.aesKey as BufferSource,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
      );

      // Decrypt
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: tokenData.aesIv as BufferSource, tagLength: 128 },
        aesKey,
        encBytes as BufferSource
      );

      const jsonStr = new TextDecoder().decode(decrypted);
      payloadData = JSON.parse(jsonStr);
    } catch {
      return error("Failed to decrypt payload. Token may be corrupted.", 403);
    }

    // ─── Validate payload fields ──────────────────────────
    if (
      !payloadData.token ||
      !payloadData.hwid ||
      !payloadData.timestamp ||
      !payloadData.salt
    ) {
      return error("Malformed payload.", 400);
    }

    // Verify token matches
    if (payloadData.token !== downloadToken) {
      return error("Token mismatch.", 403);
    }

    // Verify timestamp freshness (max 5 seconds old)
    const now = Date.now();
    const payloadAge = now - payloadData.timestamp;
    if (payloadAge < -2000 || payloadAge > 5000) {
      // Allow 2s clock skew forward, 5s backward
      return error("Payload timestamp expired or invalid.", 403);
    }

    // Verify HWID matches what was registered during handshake
    // The loader sends raw HWID, we need to hash it for comparison
    const { hashHWID } = await import("@/lib/crypto");
    const hwidHash = await hashHWID(payloadData.hwid);
    if (hwidHash !== tokenData.hwid) {
      return error("HWID mismatch.", 403);
    }

    // ─── Load and decrypt stored DLL ──────────────────────
    const project = await prisma.project.findUnique({
      where: { id: tokenData.projectId },
      select: { dllData: true, dllHash: true },
    });

    if (!project?.dllData) {
      return error("No payload available.", 404);
    }

    // Decrypt DLL from storage (AES-256-GCM with server ENCRYPTION_KEY)
    let rawDllBytes: Uint8Array;
    try {
      const encKey = process.env.ENCRYPTION_KEY;
      if (!encKey || encKey.length < 32) {
        return error("Server configuration error.", 500);
      }

      const [storedIvB64, storedCtB64] = project.dllData.split(":");
      const storedIv = new Uint8Array(Buffer.from(storedIvB64, "base64"));
      const storedCt = new Uint8Array(Buffer.from(storedCtB64, "base64"));

      const storageKey = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(encKey).slice(0, 32),
        { name: "AES-GCM" },
        false,
        ["decrypt"]
      );

      const decryptedDll = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: storedIv, tagLength: 128 },
        storageKey,
        storedCt
      );

      rawDllBytes = new Uint8Array(decryptedDll);
    } catch (err) {
      console.error("DLL decryption error:", err);
      return error("Failed to retrieve payload.", 500);
    }

    // ─── Re-encrypt DLL with session AES key for transfer ──
    // Generate a fresh IV for the download encryption (different from handshake IV)
    const downloadIv = crypto.getRandomValues(new Uint8Array(12));

    const sessionKey = await crypto.subtle.importKey(
      "raw",
      tokenData.aesKey as BufferSource,
      { name: "AES-GCM" },
      false,
      ["encrypt"]
    );

    const encryptedDll = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: downloadIv as BufferSource, tagLength: 128 },
      sessionKey,
      rawDllBytes as BufferSource
    );

    // ─── Build binary response: [12 bytes IV] + [encrypted DLL] ──
    const responseBuffer = new Uint8Array(12 + encryptedDll.byteLength);
    responseBuffer.set(downloadIv, 0);
    responseBuffer.set(new Uint8Array(encryptedDll), 12);

    // Log successful download
    try {
      await prisma.log.create({
        data: {
          action: "loader:download",
          ip,
          userAgent: request.headers.get("user-agent") || undefined,
          hwid: tokenData.hwid,
          success: true,
        },
      });
    } catch {
      // Non-critical
    }

    // ─── Return as binary stream ──────────────────────────
    return new Response(responseBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": responseBuffer.byteLength.toString(),
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Content-Type-Options": "nosniff",
        "X-DLL-Hash": project.dllHash || "",
      },
    });
  } catch (err) {
    console.error("Download error:", err);
    return error("Download failed.", 500);
  }
}
