// ─────────────────────────────────────────────────────────
// In-memory presence store — tracks which cheat users are
// currently in-game.  Uses server fingerprint + player-list
// overlap to detect same-server.
// Entries expire after 30 seconds of no heartbeat.
// ─────────────────────────────────────────────────────────

interface PresenceEntry {
  steamId: string;              // SteamID64 of the cheat user
  mapName: string;              // e.g. "de_dust2"
  serverFingerprint: string;    // hash of sorted player SteamIDs (server identity)
  playerList: Set<string>;      // SteamID64s of ALL players in the game
  lastSeen: number;             // Date.now()
}

const store = new Map<string, PresenceEntry>();   // steamId → entry

const EXPIRY_MS = 30_000; // 30 seconds

// Minimum number of common players (excluding the two cheat users) to confirm same server
const MIN_OVERLAP = 2;

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
 * @param players — array of SteamID64 strings of everyone in the game
 * @param serverFingerprint — hash of sorted player IDs (server identity)
 */
export function updatePresence(
  steamId: string,
  mapName: string,
  serverFingerprint: string,
  players: string[] = [],
): void {
  store.set(steamId, {
    steamId,
    mapName,
    serverFingerprint,
    playerList: new Set(players),
    lastSeen: Date.now(),
  });
}

/**
 * Count how many elements two Sets share.
 */
function setOverlap(a: Set<string>, b: Set<string>): number {
  let count = 0;
  const smaller = a.size <= b.size ? a : b;
  const larger  = a.size <= b.size ? b : a;
  for (const v of smaller) {
    if (larger.has(v)) count++;
  }
  return count;
}

/**
 * Get list of other cheat users on the **same** server.
 *
 * Matching priority:
 *  1. Server fingerprint match (best — hash of sorted player IDs)
 *  2. Bidirectional player-list cross-check with overlap threshold:
 *     Both users must see each other in their player lists AND share
 *     at least MIN_OVERLAP common players.
 */
export function getPresencePeers(
  steamId: string,
  mapName: string,
  serverFingerprint: string,
  players: string[] = [],
): string[] {
  const now = Date.now();
  const peers: string[] = [];
  const myPlayers = new Set(players);

  for (const [id, entry] of store) {
    if (id === steamId) continue;                     // skip self
    if (now - entry.lastSeen > EXPIRY_MS) continue;   // skip stale

    // 1) Server fingerprint match (most reliable)
    if (serverFingerprint && entry.serverFingerprint &&
        serverFingerprint === entry.serverFingerprint) {
      peers.push(id);
      continue;
    }

    // 2) Must be on the same map
    if (!mapName || entry.mapName !== mapName) continue;

    // 3) Bidirectional player-list cross-check (both must see each other)
    const theyKnowMe = entry.playerList.has(steamId);
    const iKnowThem  = myPlayers.has(id);

    if (theyKnowMe && iKnowThem) {
      // 4) Require minimum overlap of common players to avoid false positives
      const overlap = setOverlap(myPlayers, entry.playerList);
      // overlap includes the two cheat users themselves, so subtract 2
      if (overlap - 2 >= MIN_OVERLAP) {
        peers.push(id);
      }
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
