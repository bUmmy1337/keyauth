// ─────────────────────────────────────────────────────────
// POST /api/loader/handshake — Step 1 of secure DLL protocol
//
// Loader sends: { hwid, key, secret, rsaPublicKey }
// Server validates key+hwid, generates AES session key,
// encrypts it with loader's RSA public key, returns it
// along with a one-time download token.
// ─────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt, hashHWID } from "@/lib/crypto";
import { error } from "@/lib/api-response";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { isKeyExpired } from "@/lib/license";
import { storeToken } from "@/lib/loader-tokens";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);

  // Rate limit: 10 handshakes per minute per IP
  const limit = checkRateLimit(`loader:handshake:${ip}`, {
    maxTokens: 10,
    refillRate: 10,
    windowMs: 60_000,
  });

  if (!limit.allowed) {
    return error("Rate limit exceeded.", 429);
  }

  try {
    const body = await request.json();
    const { hwid, key: licenseKey, secret: projectSecret, rsaPublicKey } = body as {
      hwid: string;
      key: string;
      secret: string;
      rsaPublicKey: string; // PEM-encoded RSA public key (SPKI)
    };

    if (!hwid || !licenseKey || !projectSecret || !rsaPublicKey) {
      return error("hwid, key, secret, and rsaPublicKey are required.", 400);
    }

    // Validate RSA key format
    if (
      !rsaPublicKey.includes("-----BEGIN PUBLIC KEY-----") ||
      !rsaPublicKey.includes("-----END PUBLIC KEY-----")
    ) {
      return error("Invalid RSA public key format.", 400);
    }

    // ─── Resolve project ──────────────────────────────────
    const project = await prisma.project.findUnique({
      where: { secret: projectSecret },
      select: { id: true, dllData: true, dllHash: true },
    });

    if (!project) {
      return error("Invalid project.", 401);
    }

    if (!project.dllData) {
      return error("No payload available for this project.", 404);
    }

    // ─── Find and validate key ────────────────────────────
    const allKeys = await prisma.key.findMany({
      where: { status: "ACTIVE", projectId: project.id },
      select: {
        id: true,
        key: true,
        hwid: true,
        hwidLocked: true,
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
        continue;
      }
    }

    if (!matchedKey) {
      return error("Invalid license key.", 401);
    }

    if (isKeyExpired(matchedKey.expiresAt)) {
      return error("License key has expired.", 403);
    }

    // ─── HWID check ───────────────────────────────────────
    const hwidHash = await hashHWID(hwid);

    if (matchedKey.hwidLocked && matchedKey.hwid) {
      if (matchedKey.hwid !== hwidHash) {
        return error("License key is locked to a different machine.", 403);
      }
    }

    // ─── Generate AES-256 session key ─────────────────────
    const aesKey = crypto.getRandomValues(new Uint8Array(32)); // 256-bit
    const aesIv = crypto.getRandomValues(new Uint8Array(12));  // 96-bit GCM nonce

    // ─── Encrypt AES key + IV with loader's RSA public key ──
    let encryptedAesPackage: ArrayBuffer;
    try {
      // Parse PEM to DER
      const pemBody = rsaPublicKey
        .replace("-----BEGIN PUBLIC KEY-----", "")
        .replace("-----END PUBLIC KEY-----", "")
        .replace(/\s/g, "");
      const derBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

      const rsaKey = await crypto.subtle.importKey(
        "spki",
        derBytes,
        { name: "RSA-OAEP", hash: "SHA-256" },
        false,
        ["encrypt"]
      );

      // Package: 32 bytes AES key + 12 bytes IV = 44 bytes
      const aesPackage = new Uint8Array(44);
      aesPackage.set(aesKey, 0);
      aesPackage.set(aesIv, 32);

      encryptedAesPackage = await crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        rsaKey,
        aesPackage
      );
    } catch (err) {
      console.error("RSA encryption error:", err);
      return error("Failed to process RSA key.", 400);
    }

    // ─── Generate one-time download token ─────────────────
    const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
    const downloadToken = Array.from(tokenBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Store with 30-second TTL
    storeToken(downloadToken, {
      aesKey,
      aesIv,
      projectId: project.id,
      hwid: hwidHash,
      expiresAt: Date.now() + 30_000,
    });

    // ─── Return encrypted AES key + token ─────────────────
    const encryptedB64 = btoa(
      String.fromCharCode(...new Uint8Array(encryptedAesPackage))
    );

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          encryptedAesKey: encryptedB64,
          downloadToken,
          expiresIn: 30,
        },
        timestamp: Date.now(),
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "X-Content-Type-Options": "nosniff",
        },
      }
    );
  } catch (err) {
    console.error("Handshake error:", err);
    return error("Handshake failed.", 500);
  }
}
