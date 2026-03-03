// ─────────────────────────────────────────────────────────
// POST /api/presence — Shared feature presence heartbeat
//
// Cheat clients call this every ~10 seconds with their
// SteamID64 + current map + server address.
// Returns a list of other cheat users on the same server.
//
// Security: requires project secret to prevent abuse.
// ─────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { success, error } from "@/lib/api-response";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import {
  updatePresence,
  getPresencePeers,
  removePresence,
} from "@/lib/presence-store";
import { prisma } from "@/lib/db";

const VALID_SECRET_CACHE = new Map<string, { projectId: string; ts: number }>();
const SECRET_CACHE_TTL = 5 * 60_000; // 5 min

async function validateSecret(secret: string): Promise<string | null> {
  const cached = VALID_SECRET_CACHE.get(secret);
  if (cached && Date.now() - cached.ts < SECRET_CACHE_TTL) {
    return cached.projectId;
  }
  const project = await prisma.project.findUnique({
    where: { secret },
    select: { id: true },
  });
  if (!project) return null;
  VALID_SECRET_CACHE.set(secret, { projectId: project.id, ts: Date.now() });
  return project.id;
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);

  // Rate limit: 12 req/min per IP (heartbeat every ~10s = 6/min normal)
  const limit = checkRateLimit(`presence:${ip}`, {
    maxTokens: 12,
    refillRate: 12,
    windowMs: 60_000,
  });

  if (!limit.allowed) {
    return error("Rate limit exceeded.", 429);
  }

  try {
    const body = await request.json();
    const {
      steamId,
      mapName,
      serverAddr,
      secret,
      action,
      players,
    } = body as {
      steamId?: string;
      mapName?: string;
      serverAddr?: string;
      secret?: string;
      action?: string;
      players?: string[];
    };

    // Validate required fields
    if (!steamId || !secret) {
      return error("steamId and secret are required.", 400);
    }

    // Validate project secret
    const projectId = await validateSecret(secret);
    if (!projectId) {
      return error("Invalid secret.", 401);
    }

    // Handle deactivation
    if (action === "deactivate") {
      removePresence(steamId);
      return success({ status: "removed" });
    }

    if (!mapName) {
      return error("mapName is required for presence update.", 400);
    }

    // Update our presence
    const playerList = Array.isArray(players) ? players.filter(p => typeof p === "string") : [];
    updatePresence(steamId, mapName, serverAddr || "", playerList);

    // Get peers on the same server/map
    const peers = getPresencePeers(steamId, mapName, serverAddr || "", playerList);

    return success({
      status: "ok",
      peers,   // array of SteamID64 strings
    });
  } catch (err) {
    console.error("Presence error:", err);
    return error("Internal error.", 500);
  }
}
