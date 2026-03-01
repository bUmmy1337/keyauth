// ─────────────────────────────────────────────────────────
// In-memory presence store — tracks which cheat users are
// currently in-game, grouped by server IP / map name.
// Entries expire after 30 seconds of no heartbeat.
// ─────────────────────────────────────────────────────────

interface PresenceEntry {
  steamId: string;       // SteamID64
  mapName: string;       // e.g. "de_dust2"
  serverAddr: string;    // IP:port of the game server (or "" if unknown)
  lastSeen: number;      // Date.now()
}

const store = new Map<string, PresenceEntry>();   // steamId → entry

const EXPIRY_MS = 30_000; // 30 seconds

// Cleanup stale entries every 15 seconds
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of store) {
    if (now - entry.lastSeen > EXPIRY_MS) {
      store.delete(id);
    }
  }
}, 15_000);

/**
 * Update presence for a user (called every ~10s by the cheat).
 */
export function updatePresence(
  steamId: string,
  mapName: string,
  serverAddr: string,
): void {
  store.set(steamId, {
    steamId,
    mapName,
    serverAddr,
    lastSeen: Date.now(),
  });
}

/**
 * Get list of other cheat users on the same server.
 * Matches by serverAddr if available, otherwise by mapName.
 */
export function getPresencePeers(
  steamId: string,
  mapName: string,
  serverAddr: string,
): string[] {
  const now = Date.now();
  const peers: string[] = [];

  for (const [id, entry] of store) {
    // Skip self
    if (id === steamId) continue;
    // Skip stale
    if (now - entry.lastSeen > EXPIRY_MS) continue;

    // Match by server address (most reliable)
    if (serverAddr && entry.serverAddr && serverAddr === entry.serverAddr) {
      peers.push(id);
      continue;
    }

    // Fallback: match by map name (less reliable but works for matchmaking)
    if (mapName && entry.mapName === mapName) {
      peers.push(id);
    }
  }

  return peers;
}

/**
 * Remove presence (on deactivate / unload).
 */
export function removePresence(steamId: string): void {
  store.delete(steamId);
}
