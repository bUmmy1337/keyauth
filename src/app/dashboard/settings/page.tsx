"use client";

// ─────────────────────────────────────────────────────────
// Settings Page — API info, environment status
// ─────────────────────────────────────────────────────────

import { motion } from "framer-motion";
import { GlassCard, GlassButton } from "@/components/ui";
import { useToast } from "@/components/ui/glass-toast";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const { toast } = useToast();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    router.push("/login");
    toast("Logged out", "info");
  }

  const apiEndpoints = [
    { method: "POST", path: "/api/auth/login", desc: "Admin authentication" },
    { method: "POST", path: "/api/auth/register", desc: "Initial admin setup" },
    { method: "GET", path: "/api/auth/me", desc: "Get current user" },
    { method: "POST", path: "/api/validate", desc: "License validation (client-facing)" },
    { method: "POST", path: "/api/heartbeat", desc: "Session heartbeat / deactivate" },
    { method: "GET", path: "/api/keys", desc: "List license keys" },
    { method: "POST", path: "/api/keys", desc: "Generate license keys" },
    { method: "PATCH", path: "/api/keys/:id", desc: "Update key (ban, reset HWID)" },
    { method: "DELETE", path: "/api/keys/:id", desc: "Revoke a key" },
    { method: "GET", path: "/api/logs", desc: "Audit log listing" },
    { method: "GET", path: "/api/stats", desc: "Dashboard statistics" },
  ];

  const envVars = [
    { name: "DATABASE_URL", desc: "PostgreSQL connection string" },
    { name: "DIRECT_DATABASE_URL", desc: "Direct DB connection (Prisma)" },
    { name: "JWT_SECRET", desc: "JWT signing secret (min 32 chars)" },
    { name: "ENCRYPTION_KEY", desc: "AES-256-GCM key (min 32 chars)" },
    { name: "HWID_SALT", desc: "HWID hashing salt" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Settings
          </h1>
          <p className="mt-1 text-sm text-white/30">
            API documentation and system configuration
          </p>
        </div>
        <GlassButton variant="danger" onClick={handleLogout}>
          Sign Out
        </GlassButton>
      </motion.div>

      {/* API Endpoints */}
      <GlassCard hover={false} delay={0.1}>
        <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-white/30">
          API Endpoints
        </h3>
        <div className="space-y-2">
          {apiEndpoints.map((ep) => (
            <div
              key={`${ep.method}-${ep.path}`}
              className="flex items-center justify-between rounded-xl px-4 py-3 transition-colors hover:bg-white/[0.02]"
            >
              <div className="flex items-center gap-4">
                <span
                  className={`w-16 rounded-lg px-2 py-1 text-center text-[10px] font-bold ${
                    ep.method === "GET"
                      ? "bg-emerald-400/10 text-emerald-400/80"
                      : ep.method === "POST"
                      ? "bg-blue-400/10 text-blue-400/80"
                      : ep.method === "PATCH"
                      ? "bg-amber-400/10 text-amber-400/80"
                      : "bg-red-400/10 text-red-400/80"
                  }`}
                >
                  {ep.method}
                </span>
                <span className="font-mono text-sm text-white/60">{ep.path}</span>
              </div>
              <span className="text-xs text-white/25">{ep.desc}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Environment Variables */}
      <GlassCard hover={false} delay={0.15}>
        <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-white/30">
          Required Environment Variables
        </h3>
        <div className="space-y-2">
          {envVars.map((v) => (
            <div
              key={v.name}
              className="flex items-center justify-between rounded-xl px-4 py-3 transition-colors hover:bg-white/[0.02]"
            >
              <span className="font-mono text-sm text-white/60">{v.name}</span>
              <span className="text-xs text-white/25">{v.desc}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Security Features */}
      <GlassCard hover={false} delay={0.2}>
        <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-white/30">
          Security Features
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            "AES-256-GCM encrypted payloads",
            "HWID fingerprint locking",
            "Server-side variable injection",
            "One-time nonce rotation",
            "Token bucket rate limiting",
            "HTTP-only secure cookies",
            "HSTS + CSP security headers",
            "Bcrypt password hashing (12 rounds)",
            "JWT with HS256 signing",
            "Full audit trail logging",
          ].map((feature) => (
            <div
              key={feature}
              className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-white/40"
            >
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400/40" />
              {feature}
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
