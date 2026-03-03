// ─────────────────────────────────────────────────────────
// In-memory presence store — tracks which cheat users are
// currently in-game.  Uses player-list overlap to detect
// same-server (no server IP needed).
// Entries expire after 30 seconds of no heartbeat.
// ─────────────────────────────────────────────────────────

interface PresenceEntry {
  steamId: string;          // SteamID64 of the cheat user
  mapName: string;          // e.g. "de_dust2"
  serverAddr: string;       // IP:port (may be "")
  playerList: Set<string>;  // SteamID64s of ALL players in the game
  lastSeen: number;         // Date.now()
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
 * @param players — array of SteamID64 strings of everyone in the game
 */
export function updatePresence(
  steamId: string,
  mapName: string,
  serverAddr: string,
  players: string[] = [],
): void {
  store.set(steamId, {
    steamId,
    mapName,
    serverAddr,
    playerList: new Set(players),
    lastSeen: Date.now(),
  });
}

/**
 * Get list of other cheat users on the **same** server.
 *
 * Matching priority:
 *  1. serverAddr match (if both sides supply it)
 *  2. Player-list overlap: user A is a peer of user B when
 *     A's SteamID is in B's playerList **or** B's SteamID is in A's playerList.
 *     This guarantees both are on the same server.
 */
export function getPresencePeers(
  steamId: string,
  mapName: string,
  serverAddr: string,
  players: string[] = [],
): string[] {
  const now = Date.now();
  const peers: string[] = [];
  const myPlayers = new Set(players);

  for (const [id, entry] of store) {
    if (id === steamId) continue;                     // skip self
    if (now - entry.lastSeen > EXPIRY_MS) continue;   // skip stale

    // 1) Server address match (best, but often unavailable)
    if (serverAddr && entry.serverAddr && serverAddr === entry.serverAddr) {
      peers.push(id);
      continue;
    }

    // 2) Must be on the same map first
    if (!mapName || entry.mapName !== mapName) continue;

    // 3) Player-list cross-check: does my list contain the other user,
    //    or does their list contain me?
    const theyKnowMe = entry.playerList.has(steamId);
    const iKnowThem  = myPlayers.has(id);

    if (theyKnowMe || iKnowThem) {
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
