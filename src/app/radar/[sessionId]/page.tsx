"use client";

// ─────────────────────────────────────────────────────────
// Cloud Radar — Liquid Glass Monochrome
// ─────────────────────────────────────────────────────────

import { useParams } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─────────────────────────────────────────────────────────
// Map calibration data (from cs2_webradar_v2)
// ─────────────────────────────────────────────────────────
const MAP_DATA: Record<string, { x: number; y: number; scale: number }> = {
  cs_agency:   { x: -2597.74, y: 2079.37, scale: 4.1817 },
  cs_italy:    { x: -2647, y: 2592, scale: 4.6 },
  cs_office:   { x: -1838, y: 1858, scale: 4.1 },
  de_ancient:  { x: -2953, y: 2164, scale: 5 },
  de_anubis:   { x: -2796, y: 3328, scale: 5.22 },
  de_dust2:    { x: -2476, y: 3239, scale: 4.4 },
  de_golden:   { x: -856.98, y: 2399.29, scale: 4.5067 },
  de_grail:    { x: -4395.90, y: 4203.90, scale: 4.3514 },
  de_inferno:  { x: -2087, y: 3870, scale: 4.9 },
  de_mirage:   { x: -3230, y: 1713, scale: 5.0 },
  de_nuke:     { x: -3453, y: 2887, scale: 7 },
  de_overpass: { x: -4831, y: 1781, scale: 5.2 },
  de_palacio:  { x: -2443.31, y: 1896.15, scale: 3.8676 },
  de_thera:    { x: -85.61, y: 2261.80, scale: 4.847 },
  de_train:    { x: -2308, y: 2078, scale: 4.082 },
  de_vertigo:  { x: -3168, y: 1762, scale: 4.0 },
};

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
interface RadarPlayer {
  m_idx: number;
  m_name: string;
  m_team: number;
  m_health: number;
  m_is_dead: boolean;
  m_is_local?: boolean;
  m_position: { x: number; y: number };
  m_eye_angle: number;
  m_armor: number;
  m_has_helmet: boolean;
  m_active_weapon?: string;
}

interface RadarBomb {
  active: boolean;
  planted?: boolean;
  x?: number;
  y?: number;
}

interface RadarFrame {
  session_id: string;
  timestamp: number;
  m_map: string;
  m_local_team: number;
  m_players: RadarPlayer[];
  m_bomb?: RadarBomb;
}

// ─────────────────────────────────────────────────────────
// Coordinate conversion
// ─────────────────────────────────────────────────────────
function worldToRadar(
  worldX: number,
  worldY: number,
  mapData: { x: number; y: number; scale: number },
  radarSize: number
): { x: number; y: number } {
  const x = ((worldX - mapData.x) / mapData.scale / 1024) * radarSize;
  const y = (((worldY - mapData.y) / mapData.scale) * -1.0 / 1024) * radarSize;
  return { x, y };
}

// ─────────────────────────────────────────────────────────
// Interpolation helpers
// ─────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return a + diff * t;
}

// ─────────────────────────────────────────────────────────
// Animations
// ─────────────────────────────────────────────────────────
const ease = [0.22, 1, 0.36, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 16, filter: "blur(8px)" },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, delay: i * 0.08, ease },
  }),
};

// ─────────────────────────────────────────────────────────
// Colors
// ─────────────────────────────────────────────────────────
const CT_COLOR = "#5b9bd5";
const CT_DIM   = "#3a6fa0";
const T_COLOR  = "#e2b74f";
const T_DIM    = "#b8912f";

// ─────────────────────────────────────────────────────────
// Main Radar Page
// ─────────────────────────────────────────────────────────
export default function RadarPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [frame, setFrame] = useState<RadarFrame | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const lastMapRef = useRef<string>("");
  const frameRef = useRef<RadarFrame | null>(null);
  const interpRef = useRef<Map<number, { x: number; y: number; angle: number }>>(new Map());
  const lastRenderTimeRef = useRef<number>(0);

  // Settings
  const [dotSize, setDotSize] = useState(10);
  const [showNames, setShowNames] = useState(true);
  const [showWeapons, setShowWeapons] = useState(true);
  const [showViewCones, setShowViewCones] = useState(true);
  const [showBomb, setShowBomb] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // SSE Connection
  useEffect(() => {
    if (!sessionId) return;

    const baseUrl = window.location.origin;
    const url = `${baseUrl}/api/radar/pull?session=${sessionId}`;
    const es = new EventSource(url);

    es.onopen = () => {
      setConnected(true);
      setError(null);
    };

    es.onmessage = (event) => {
      try {
        const data: RadarFrame = JSON.parse(event.data);
        frameRef.current = data;
        setFrame(data);
      } catch {}
    };

    es.addEventListener("expired", () => {
      setError("Session expired");
      setConnected(false);
      es.close();
    });

    es.onerror = () => {
      setConnected(false);
      setError("Connection lost. Reconnecting...");
    };

    return () => es.close();
  }, [sessionId]);

  // Load map image
  useEffect(() => {
    if (!frame?.m_map || frame.m_map === lastMapRef.current) return;
    const mapName = frame.m_map;
    lastMapRef.current = mapName;

    if (!MAP_DATA[mapName]) {
      imgRef.current = null;
      return;
    }

    // Self-hosted map tiles in /public/data/
    const url = `/data/${mapName}/radar.png`;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { imgRef.current = img; };
    img.onerror = () => { imgRef.current = null; };
    img.src = url;
  }, [frame?.m_map]);

  // Canvas rendering
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    const f = frameRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = canvas.width;

    // Interpolation timing
    const now = performance.now();
    const dt = lastRenderTimeRef.current ? (now - lastRenderTimeRef.current) / 1000 : 0.016;
    lastRenderTimeRef.current = now;
    const INTERP_SPEED = 15;
    const alpha = 1 - Math.exp(-INTERP_SPEED * dt);

    // Background
    ctx.fillStyle = "#06060a";
    ctx.fillRect(0, 0, size, size);

    // Map image
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.globalAlpha = 0.85;
      ctx.drawImage(img, 0, 0, size, size);
      ctx.globalAlpha = 1.0;
    } else {
      // Grid placeholder
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 0.5;
      for (let i = 0; i < size; i += 50) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
      }
    }

    if (!f || !f.m_map || !MAP_DATA[f.m_map]) {
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "500 14px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Waiting for game data\u2026", size / 2, size / 2);
      return;
    }

    const mapData = MAP_DATA[f.m_map];

    // Bomb
    if (showBomb && f.m_bomb?.active && f.m_bomb.x != null && f.m_bomb.y != null) {
      const bp = worldToRadar(f.m_bomb.x, f.m_bomb.y, mapData, size);
      ctx.save();
      // Glow
      const bombGlow = ctx.createRadialGradient(bp.x, bp.y, 0, bp.x, bp.y, dotSize * 3);
      bombGlow.addColorStop(0, "rgba(255,60,60,0.25)");
      bombGlow.addColorStop(1, "transparent");
      ctx.fillStyle = bombGlow;
      ctx.beginPath();
      ctx.arc(bp.x, bp.y, dotSize * 3, 0, Math.PI * 2);
      ctx.fill();
      // Marker
      ctx.fillStyle = "#ff4444";
      ctx.strokeStyle = "rgba(255,0,0,0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(bp.x, bp.y, dotSize * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.max(8, dotSize * 0.8)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("C4", bp.x, bp.y);
      ctx.restore();
    }

    // Players — interpolate positions & angles
    const activeIds = new Set<number>();
    for (const player of f.m_players) {
      if (player.m_is_dead) continue;
      activeIds.add(player.m_idx);

      // Interpolate world-space position & eye angle
      let interp = interpRef.current.get(player.m_idx);
      if (!interp) {
        interp = { x: player.m_position.x, y: player.m_position.y, angle: player.m_eye_angle };
        interpRef.current.set(player.m_idx, interp);
      } else {
        interp.x = lerp(interp.x, player.m_position.x, alpha);
        interp.y = lerp(interp.y, player.m_position.y, alpha);
        interp.angle = lerpAngle(interp.angle, player.m_eye_angle, alpha);
      }

      const pos = worldToRadar(interp.x, interp.y, mapData, size);
      if (pos.x < -30 || pos.x > size + 30 || pos.y < -30 || pos.y > size + 30) continue;

      const isCt = player.m_team === 3;
      const isLocal = !!player.m_is_local;
      const teamColor = isCt ? CT_COLOR : T_COLOR;
      const teamDark = isCt ? CT_DIM : T_DIM;

      ctx.save();

      // View cone
      if (showViewCones) {
        const yaw = interp.angle * (Math.PI / 180);
        const coneLen = dotSize * 4;
        const coneAngle = 0.35;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(pos.x + Math.cos(yaw - coneAngle) * coneLen, pos.y - Math.sin(yaw - coneAngle) * coneLen);
        ctx.lineTo(pos.x + Math.cos(yaw + coneAngle) * coneLen, pos.y - Math.sin(yaw + coneAngle) * coneLen);
        ctx.closePath();
        const coneGrad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, coneLen);
        coneGrad.addColorStop(0, isCt ? "rgba(91,155,213,0.22)" : "rgba(226,183,79,0.22)");
        coneGrad.addColorStop(1, "transparent");
        ctx.fillStyle = coneGrad;
        ctx.fill();
      }

      // Local glow
      if (isLocal) {
        const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, dotSize * 2);
        glow.addColorStop(0, "rgba(255,255,255,0.15)");
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, dotSize * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Teardrop dot
      ctx.translate(pos.x, pos.y);
      ctx.rotate(Math.PI / 2 - interp.angle * (Math.PI / 180));
      const r = dotSize / 2;

      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.moveTo(-r * 0.6, 0);
      ctx.lineTo(0, -r * 1.8);
      ctx.lineTo(r * 0.6, 0);
      ctx.closePath();
      ctx.fillStyle = teamColor;
      ctx.fill();
      ctx.strokeStyle = teamDark;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Health arc
      if (player.m_health < 100) {
        const hpPct = player.m_health / 100;
        ctx.beginPath();
        ctx.arc(0, 0, r + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpPct);
        ctx.strokeStyle = hpPct > 0.5 ? "#34d399" : hpPct > 0.25 ? "#fbbf24" : "#f87171";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.restore();

      // Name
      if (showNames) {
        ctx.save();
        ctx.font = `500 ${Math.max(9, dotSize * 0.85)}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        const nameY = pos.y - dotSize - 3;
        ctx.strokeStyle = "rgba(0,0,0,0.7)";
        ctx.lineWidth = 2.5;
        ctx.strokeText(player.m_name, pos.x, nameY);
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillText(player.m_name, pos.x, nameY);
        ctx.restore();
      }

      // Weapon
      if (showWeapons && player.m_active_weapon) {
        ctx.save();
        ctx.font = `400 ${Math.max(8, dotSize * 0.65)}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.fillText(player.m_active_weapon, pos.x, pos.y + dotSize + 3);
        ctx.restore();
      }
    }

    // Prune stale interpolation entries (dead/disconnected players)
    for (const key of interpRef.current.keys()) {
      if (!activeIds.has(key)) interpRef.current.delete(key);
    }

    // HUD overlay
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, size, 28);
    ctx.font = "500 11px Inter, system-ui, sans-serif";
    ctx.textBaseline = "middle";

    // Map name
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(f.m_map.toUpperCase(), 10, 14);

    // Team counts
    const tAlive = f.m_players.filter(p => p.m_team === 2 && !p.m_is_dead).length;
    const ctAlive = f.m_players.filter(p => p.m_team === 3 && !p.m_is_dead).length;
    ctx.textAlign = "center";
    ctx.fillStyle = T_COLOR;
    ctx.fillText(`T ${tAlive}`, size / 2 - 24, 14);
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillText(":", size / 2, 14);
    ctx.fillStyle = CT_COLOR;
    ctx.fillText(`${ctAlive} CT`, size / 2 + 24, 14);

    // Player count
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillText(`${f.m_players.filter(p => !p.m_is_dead).length} alive`, size - 10, 14);
    ctx.restore();
  }, [dotSize, showNames, showWeapons, showViewCones, showBomb]);

  // Animation loop
  useEffect(() => {
    let id: number;
    const loop = () => { render(); id = requestAnimationFrame(loop); };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [render]);

  // Responsive canvas
  const [canvasSize, setCanvasSize] = useState(600);
  useEffect(() => {
    const update = () => {
      const sideW = sidebarOpen ? 300 : 0;
      const s = Math.min(window.innerWidth - sideW - 64, window.innerHeight - 120, 860);
      setCanvasSize(Math.max(380, s));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [sidebarOpen]);

  const ctPlayers = frame?.m_players.filter(p => p.m_team === 3) ?? [];
  const tPlayers = frame?.m_players.filter(p => p.m_team === 2) ?? [];

  return (
    <div className="min-h-screen bg-surface-primary text-text-primary font-sans antialiased relative overflow-hidden">
      {/* Ambient orbs */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute w-[500px] h-[500px] -top-48 -right-24 rounded-full opacity-[0.02] bg-white blur-[80px]" />
        <div className="absolute w-[400px] h-[400px] -bottom-32 -left-20 rounded-full opacity-[0.015] bg-white blur-[80px]" />
      </div>

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="relative z-20 flex items-center justify-between px-6 py-3 border-b border-border-subtle"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(40px) saturate(1.4)" }}
      >
        <div className="flex items-center gap-3">
          <span className="bg-white text-black font-bold text-xs px-2.5 py-1 rounded-md tracking-tight">
            MOZORITY
          </span>
          <span className="text-text-tertiary text-sm tracking-tight">Cloud Radar</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Connection status */}
          <div className="flex items-center gap-2">
            <span
              className="w-[7px] h-[7px] rounded-full"
              style={{ background: connected ? "#34d399" : error ? "#f87171" : "#52525b" }}
            />
            <span className="text-text-muted text-xs">
              {connected ? "Live" : error || "Offline"}
            </span>
          </div>

          {/* Session badge */}
          <div className="glass-sm px-3 py-1 rounded-lg">
            <span className="text-text-muted text-[11px] font-mono tracking-wide">{sessionId}</span>
          </div>

          {/* Sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="glass-button px-3 py-1.5 rounded-xl text-[11px] text-text-secondary hover:text-white transition-colors"
          >
            {sidebarOpen ? "Hide Panel" : "Show Panel"}
          </button>
        </div>
      </motion.header>

      {/* Main content */}
      <div className="flex h-[calc(100vh-49px)]">
        {/* Radar area */}
        <motion.div
          custom={0}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="flex-1 flex items-center justify-center p-6"
        >
          <div className="glass relative" style={{ borderRadius: 20, padding: 3 }}>
            <canvas
              ref={canvasRef}
              width={canvasSize}
              height={canvasSize}
              style={{
                borderRadius: 17,
                display: "block",
                background: "#06060a",
              }}
            />
          </div>
        </motion.div>

        {/* Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside
              initial={{ opacity: 0, x: 20, filter: "blur(8px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: 20, filter: "blur(8px)" }}
              transition={{ duration: 0.4, ease }}
              className="w-[280px] border-l border-border-subtle flex flex-col overflow-hidden"
              style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(40px) saturate(1.3)" }}
            >
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* Settings section */}
                <motion.div custom={1} initial="hidden" animate="visible" variants={fadeUp}>
                  <SectionHeader label="SETTINGS" />
                  <div className="space-y-1.5 mt-3">
                    <GlassSlider label="Dot Size" value={dotSize} min={4} max={24} onChange={setDotSize} />
                    <GlassToggle label="Names" checked={showNames} onChange={setShowNames} />
                    <GlassToggle label="Weapons" checked={showWeapons} onChange={setShowWeapons} />
                    <GlassToggle label="View Cones" checked={showViewCones} onChange={setShowViewCones} />
                    <GlassToggle label="Bomb" checked={showBomb} onChange={setShowBomb} />
                  </div>
                </motion.div>

                {/* Players section */}
                <motion.div custom={2} initial="hidden" animate="visible" variants={fadeUp}>
                  <SectionHeader label="PLAYERS" />
                  <div className="mt-3 space-y-0.5">
                    {/* CT */}
                    {ctPlayers
                      .sort((a, b) => (a.m_is_dead ? 1 : 0) - (b.m_is_dead ? 1 : 0))
                      .map(p => <PlayerRow key={p.m_idx} player={p} />)}

                    {ctPlayers.length > 0 && tPlayers.length > 0 && (
                      <div className="h-px bg-border-subtle my-2" />
                    )}

                    {/* T */}
                    {tPlayers
                      .sort((a, b) => (a.m_is_dead ? 1 : 0) - (b.m_is_dead ? 1 : 0))
                      .map(p => <PlayerRow key={p.m_idx} player={p} />)}

                    {!frame && (
                      <p className="text-text-muted text-xs text-center py-6">No data yet</p>
                    )}
                  </div>
                </motion.div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────
function SectionHeader({ label }: { label: string }) {
  return (
    <h3 className="text-[10px] font-semibold tracking-[0.08em] text-text-muted uppercase">
      {label}
    </h3>
  );
}

function PlayerRow({ player }: { player: RadarPlayer }) {
  const isCt = player.m_team === 3;
  const color = isCt ? CT_COLOR : T_COLOR;
  const isDead = player.m_is_dead || player.m_health <= 0;

  return (
    <div
      className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-colors duration-200"
      style={{
        background: player.m_is_local ? "rgba(255,255,255,0.04)" : "transparent",
        opacity: isDead ? 0.35 : 1,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: isDead ? "#52525b" : color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-text-primary truncate leading-tight">
            {player.m_name}
          </span>
          {player.m_is_local && (
            <span className="text-[9px] text-text-muted">(you)</span>
          )}
        </div>
        {!isDead && (
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className="text-[10px] font-medium tabular-nums"
              style={{
                color: player.m_health > 50 ? "#34d399" : player.m_health > 25 ? "#fbbf24" : "#f87171",
              }}
            >
              {player.m_health}
            </span>
            {player.m_armor > 0 && (
              <span className="text-[10px] text-text-muted tabular-nums">
                {player.m_armor}{player.m_has_helmet ? "+H" : ""}
              </span>
            )}
            {player.m_active_weapon && (
              <span className="text-[10px] text-text-tertiary truncate">
                {player.m_active_weapon}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function GlassToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between py-1.5 cursor-pointer group">
      <span className="text-[12px] text-text-secondary group-hover:text-text-primary transition-colors">
        {label}
      </span>
      <button
        onClick={() => onChange(!checked)}
        className="w-8 h-[18px] rounded-full relative transition-all duration-300"
        style={{
          background: checked ? "rgba(255,255,255,0.20)" : "rgba(255,255,255,0.06)",
          border: `1px solid ${checked ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)"}`,
        }}
      >
        <span
          className="absolute top-[2px] w-3 h-3 rounded-full bg-white transition-all duration-300"
          style={{
            left: checked ? 14 : 2,
            opacity: checked ? 1 : 0.5,
          }}
        />
      </button>
    </label>
  );
}

function GlassSlider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] text-text-secondary">{label}</span>
        <span className="text-[11px] text-text-muted tabular-nums font-mono">{value}</span>
      </div>
      <div className="relative h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pct}%`, background: "rgba(255,255,255,0.20)" }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-sm pointer-events-none"
          style={{ left: `calc(${pct}% - 6px)` }}
        />
      </div>
    </div>
  );
}
