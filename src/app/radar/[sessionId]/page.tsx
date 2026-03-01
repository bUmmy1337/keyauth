"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";

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

// Radar images hosted on GitHub (cs2_webradar_v2 compatible format)
const RADAR_IMG_BASE = "https://raw.githubusercontent.com/clauadv/cs2_webradar/main/webapp/public/data";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
interface RadarPlayer {
  m_idx: number;
  m_name: string;
  m_team: number;
  m_health: number;
  m_is_dead: boolean;
  m_is_local: boolean;
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
// Main Radar Page Component
// ─────────────────────────────────────────────────────────
export default function RadarPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [frame, setFrame] = useState<RadarFrame | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapImg, setMapImg] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const lastMapRef = useRef<string>("");
  const frameRef = useRef<RadarFrame | null>(null);

  // Settings
  const [dotSize, setDotSize] = useState(10);
  const [showNames, setShowNames] = useState(true);
  const [showWeapons, setShowWeapons] = useState(true);
  const [showViewCones, setShowViewCones] = useState(true);
  const [showBomb, setShowBomb] = useState(true);

  // Connect SSE
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

    return () => {
      es.close();
    };
  }, [sessionId]);

  // Load map image when map changes
  useEffect(() => {
    if (!frame?.m_map || frame.m_map === lastMapRef.current) return;
    const mapName = frame.m_map;
    lastMapRef.current = mapName;

    if (!MAP_DATA[mapName]) {
      setMapImg(null);
      return;
    }

    const url = `${RADAR_IMG_BASE}/${mapName}/radar.png`;
    setMapImg(url);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
    };
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

    // Clear
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, size, size);

    // Draw map
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, 0, 0, size, size);
    } else {
      // Grid placeholder
      ctx.strokeStyle = "#1a1a2e";
      ctx.lineWidth = 0.5;
      for (let i = 0; i < size; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0); ctx.lineTo(i, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i); ctx.lineTo(size, i);
        ctx.stroke();
      }
    }

    if (!f || !f.m_map || !MAP_DATA[f.m_map]) {
      // Draw "waiting" text
      ctx.fillStyle = "#ffffff80";
      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Waiting for game data...", size / 2, size / 2);
      return;
    }

    const mapData = MAP_DATA[f.m_map];

    // Draw bomb
    if (showBomb && f.m_bomb?.active && f.m_bomb.x !== undefined && f.m_bomb.y !== undefined) {
      const bp = worldToRadar(f.m_bomb.x, f.m_bomb.y, mapData, size);
      ctx.save();
      ctx.fillStyle = "#ff4444";
      ctx.strokeStyle = "#ff0000";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bp.x, bp.y, dotSize * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${dotSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("C4", bp.x, bp.y);
      ctx.restore();
    }

    // Draw players
    for (const player of f.m_players) {
      if (player.m_is_dead) continue;

      const pos = worldToRadar(player.m_position.x, player.m_position.y, mapData, size);

      // Skip if outside canvas
      if (pos.x < -20 || pos.x > size + 20 || pos.y < -20 || pos.y > size + 20) continue;

      const isCt = player.m_team === 3;
      const isLocal = player.m_is_local;

      // Colors
      const teamColor = isCt ? "#5b9bd5" : "#e2b74f";
      const teamColorDark = isCt ? "#3a6fa0" : "#b8912f";
      const localGlow = isLocal ? "#ffffff60" : "transparent";

      ctx.save();

      // View cone
      if (showViewCones) {
        const yaw = (-player.m_eye_angle + 90) * (Math.PI / 180);
        const coneLen = dotSize * 4;
        const coneAngle = 0.35; // ~20 degrees half-angle

        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(
          pos.x + Math.cos(yaw - coneAngle) * coneLen,
          pos.y - Math.sin(yaw - coneAngle) * coneLen
        );
        ctx.lineTo(
          pos.x + Math.cos(yaw + coneAngle) * coneLen,
          pos.y - Math.sin(yaw + coneAngle) * coneLen
        );
        ctx.closePath();

        const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, coneLen);
        gradient.addColorStop(0, isCt ? "#5b9bd540" : "#e2b74f40");
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // Local player glow
      if (isLocal) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, dotSize * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = localGlow;
        ctx.fill();
      }

      // Player dot — teardrop shape
      ctx.translate(pos.x, pos.y);
      const yawRad = (-player.m_eye_angle + 90) * (Math.PI / 180);
      ctx.rotate(-yawRad + Math.PI);

      ctx.beginPath();
      const r = dotSize / 2;
      // Teardrop: circle + triangle pointing in direction
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.moveTo(-r * 0.6, 0);
      ctx.lineTo(0, -r * 1.8);
      ctx.lineTo(r * 0.6, 0);
      ctx.closePath();

      ctx.fillStyle = teamColor;
      ctx.fill();
      ctx.strokeStyle = teamColorDark;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Health indicator (outline brightness based on HP)
      if (player.m_health < 100) {
        const hpPct = player.m_health / 100;
        ctx.beginPath();
        ctx.arc(0, 0, r + 2, 0, Math.PI * 2 * hpPct);
        ctx.strokeStyle = hpPct > 0.5 ? "#60ff60" : hpPct > 0.25 ? "#ffaa00" : "#ff3333";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.restore();

      // Name
      if (showNames) {
        ctx.save();
        ctx.fillStyle = "#ffffffd0";
        ctx.strokeStyle = "#000000a0";
        ctx.lineWidth = 2;
        ctx.font = `${Math.max(9, dotSize * 0.9)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        const nameY = pos.y - dotSize - 2;
        ctx.strokeText(player.m_name, pos.x, nameY);
        ctx.fillText(player.m_name, pos.x, nameY);
        ctx.restore();
      }

      // Weapon
      if (showWeapons && player.m_active_weapon) {
        ctx.save();
        ctx.fillStyle = "#ffffff80";
        ctx.font = `${Math.max(8, dotSize * 0.7)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(player.m_active_weapon, pos.x, pos.y + dotSize + 2);
        ctx.restore();
      }
    }

    // Draw info overlay
    ctx.save();
    ctx.fillStyle = "#00000080";
    ctx.fillRect(0, 0, size, 30);
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`Map: ${f.m_map}`, 8, 15);
    ctx.textAlign = "center";
    const tCount = f.m_players.filter(p => p.m_team === 2 && !p.m_is_dead).length;
    const ctCount = f.m_players.filter(p => p.m_team === 3 && !p.m_is_dead).length;
    ctx.fillStyle = "#e2b74f";
    ctx.fillText(`T: ${tCount}`, size / 2 - 30, 15);
    ctx.fillStyle = "#5b9bd5";
    ctx.fillText(`CT: ${ctCount}`, size / 2 + 30, 15);
    ctx.fillStyle = "#ffffff60";
    ctx.textAlign = "right";
    ctx.fillText(`Players: ${f.m_players.filter(p => !p.m_is_dead).length}`, size - 8, 15);
    ctx.restore();
  }, [dotSize, showNames, showWeapons, showViewCones, showBomb]);

  // Animation loop
  useEffect(() => {
    let animId: number;
    const loop = () => {
      render();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [render]);

  // Responsive canvas size
  const [canvasSize, setCanvasSize] = useState(600);
  useEffect(() => {
    const updateSize = () => {
      const s = Math.min(window.innerWidth - 320, window.innerHeight - 80, 800);
      setCanvasSize(Math.max(400, s));
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#08080c",
      color: "#fff",
      fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <header style={{
        padding: "12px 20px",
        borderBottom: "1px solid #ffffff10",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#0a0a12",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{
            background: "#fff",
            color: "#000",
            fontWeight: 700,
            padding: "4px 10px",
            borderRadius: 6,
            fontSize: 14,
          }}>MOZORITY</span>
          <span style={{ color: "#888", fontSize: 13 }}>Cloud Radar</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: connected ? "#4caf50" : "#f44336",
            display: "inline-block",
          }} />
          <span style={{ color: "#aaa", fontSize: 12 }}>
            {connected ? "Connected" : error || "Disconnected"}
          </span>
          <span style={{
            color: "#666", fontSize: 11,
            background: "#ffffff08",
            padding: "2px 8px",
            borderRadius: 4,
          }}>
            ID: {sessionId}
          </span>
        </div>
      </header>

      {/* Main content */}
      <div style={{
        flex: 1,
        display: "flex",
        gap: 16,
        padding: 16,
      }}>
        {/* Radar canvas */}
        <div style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
        }}>
          <canvas
            ref={canvasRef}
            width={canvasSize}
            height={canvasSize}
            style={{
              borderRadius: 8,
              border: "1px solid #ffffff10",
              background: "#0a0a0f",
            }}
          />
        </div>

        {/* Sidebar */}
        <div style={{
          width: 280,
          background: "#0d0d14",
          borderRadius: 8,
          border: "1px solid #ffffff08",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          overflowY: "auto",
          maxHeight: canvasSize,
        }}>
          {/* Settings */}
          <div>
            <h3 style={{ fontSize: 13, color: "#888", marginBottom: 12, fontWeight: 600 }}>
              SETTINGS
            </h3>
            <SettingSlider label="Dot Size" value={dotSize} min={4} max={24}
              onChange={setDotSize} />
            <SettingToggle label="Show Names" checked={showNames}
              onChange={setShowNames} />
            <SettingToggle label="Show Weapons" checked={showWeapons}
              onChange={setShowWeapons} />
            <SettingToggle label="View Cones" checked={showViewCones}
              onChange={setShowViewCones} />
            <SettingToggle label="Show Bomb" checked={showBomb}
              onChange={setShowBomb} />
          </div>

          {/* Player list */}
          <div>
            <h3 style={{ fontSize: 13, color: "#888", marginBottom: 12, fontWeight: 600 }}>
              PLAYERS
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {/* CT players */}
              {frame?.m_players
                .filter(p => p.m_team === 3)
                .sort((a, b) => (a.m_is_dead ? 1 : 0) - (b.m_is_dead ? 1 : 0))
                .map(p => (
                  <PlayerCard key={p.m_idx} player={p} />
                ))}
              {/* Separator */}
              {frame?.m_players.some(p => p.m_team === 3) && frame?.m_players.some(p => p.m_team === 2) && (
                <div style={{ height: 1, background: "#ffffff10", margin: "4px 0" }} />
              )}
              {/* T players */}
              {frame?.m_players
                .filter(p => p.m_team === 2)
                .sort((a, b) => (a.m_is_dead ? 1 : 0) - (b.m_is_dead ? 1 : 0))
                .map(p => (
                  <PlayerCard key={p.m_idx} player={p} />
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// UI Components
// ─────────────────────────────────────────────────────────
function PlayerCard({ player }: { player: RadarPlayer }) {
  const isCt = player.m_team === 3;
  const color = isCt ? "#5b9bd5" : "#e2b74f";
  const isDead = player.m_is_dead || player.m_health <= 0;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 8px",
      borderRadius: 6,
      background: player.m_is_local ? "#ffffff08" : "transparent",
      opacity: isDead ? 0.4 : 1,
    }}>
      <div style={{
        width: 8, height: 8,
        borderRadius: "50%",
        background: isDead ? "#666" : color,
        flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12,
          color: isDead ? "#666" : "#ddd",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          {player.m_name}
          {player.m_is_local && (
            <span style={{ color: "#888", fontSize: 10, marginLeft: 4 }}>(you)</span>
          )}
        </div>
        {!isDead && (
          <div style={{ fontSize: 10, color: "#666", display: "flex", gap: 6 }}>
            <span style={{
              color: player.m_health > 50 ? "#6c6" : player.m_health > 25 ? "#fa0" : "#f44",
            }}>
              {player.m_health} HP
            </span>
            {player.m_armor > 0 && (
              <span>{player.m_armor} AR{player.m_has_helmet ? "+H" : ""}</span>
            )}
            {player.m_active_weapon && (
              <span style={{ color: "#888" }}>{player.m_active_weapon}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SettingToggle({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "6px 0",
      cursor: "pointer",
      fontSize: 12,
      color: "#ccc",
    }}>
      {label}
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 34, height: 18,
          borderRadius: 9,
          background: checked ? "#5b9bd5" : "#333",
          position: "relative",
          transition: "background 0.2s",
          cursor: "pointer",
        }}
      >
        <div style={{
          width: 14, height: 14,
          borderRadius: "50%",
          background: "#fff",
          position: "absolute",
          top: 2,
          left: checked ? 18 : 2,
          transition: "left 0.2s",
        }} />
      </div>
    </label>
  );
}

function SettingSlider({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <div style={{ padding: "4px 0" }}>
      <div style={{
        display: "flex", justifyContent: "space-between",
        fontSize: 12, color: "#ccc", marginBottom: 4,
      }}>
        <span>{label}</span>
        <span style={{ color: "#888" }}>{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          width: "100%",
          accentColor: "#5b9bd5",
        }}
      />
    </div>
  );
}
