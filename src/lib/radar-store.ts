// ─────────────────────────────────────────────────────────
// In-memory radar session store
// Sessions auto-expire after 5 minutes of inactivity
// ─────────────────────────────────────────────────────────

export interface RadarPlayerData {
  m_idx: number;
  m_name: string;
  m_team: number;       // 2=T, 3=CT
  m_health: number;
  m_is_dead: boolean;
  m_is_local: boolean;
  m_position: { x: number; y: number };
  m_eye_angle: number;
  m_armor: number;
  m_has_helmet: boolean;
  m_active_weapon?: string;
}

export interface RadarBombData {
  active: boolean;
  planted?: boolean;
  x?: number;
  y?: number;
}

export interface RadarFrame {
  session_id: string;
  timestamp: number;
  m_map: string;
  m_local_team: number;
  m_players: RadarPlayerData[];
  m_bomb?: RadarBombData;
}

interface RadarSession {
  lastFrame: RadarFrame;
  lastUpdate: number;    // Date.now()
  listeners: Set<(frame: RadarFrame) => void>;
}

const sessions = new Map<string, RadarSession>();

// Cleanup stale sessions every 60 seconds
const EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastUpdate > EXPIRY_MS) {
      // Notify listeners that session ended
      for (const listener of session.listeners) {
        try { listener(null as unknown as RadarFrame); } catch {}
      }
      sessions.delete(id);
    }
  }
}, 60_000);

export function pushFrame(frame: RadarFrame): boolean {
  const id = frame.session_id;
  if (!id) return false;

  let session = sessions.get(id);
  if (!session) {
    session = {
      lastFrame: frame,
      lastUpdate: Date.now(),
      listeners: new Set(),
    };
    sessions.set(id, session);
  } else {
    session.lastFrame = frame;
    session.lastUpdate = Date.now();
  }

  // Notify all SSE listeners
  for (const listener of session.listeners) {
    try { listener(frame); } catch {}
  }

  return true;
}

export function getLatestFrame(sessionId: string): RadarFrame | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  return session.lastFrame;
}

export function subscribe(sessionId: string, callback: (frame: RadarFrame) => void): () => void {
  let session = sessions.get(sessionId);
  if (!session) {
    // Create a placeholder session so the listener is ready when data arrives
    session = {
      lastFrame: null as unknown as RadarFrame,
      lastUpdate: Date.now(),
      listeners: new Set(),
    };
    sessions.set(sessionId, session);
  }

  session.listeners.add(callback);

  // Return unsubscribe function
  return () => {
    session!.listeners.delete(callback);
  };
}

export function getActiveSessionCount(): number {
  return sessions.size;
}
