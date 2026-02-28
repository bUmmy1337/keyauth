"use client";

// ─────────────────────────────────────────────────────────
// Dashboard Overview — Stats + Recent Activity
// ─────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { StatCard, GlassCard } from "@/components/ui";
import { useApi } from "@/hooks/use-api";

interface Stats {
  keys: {
    total: number;
    active: number;
    expired: number;
    banned: number;
  };
  validations: {
    total: number;
    last24h: number;
    failed: number;
  };
  users: number;
  planDistribution: { plan: string; count: number }[];
  recentActivity: {
    id: string;
    action: string;
    ip: string | null;
    success: boolean;
    createdAt: string;
  }[];
}

export default function DashboardPage() {
  const api = useApi<Stats>();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.get("/api/stats").then((res) => {
      if (res.success && res.data) setStats(res.data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (api.loading && !stats) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Overview
        </h1>
        <p className="mt-1 text-sm text-white/30">
          License system statistics and recent activity
        </p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Keys"
          value={stats?.keys.total ?? 0}
          subtitle={`${stats?.keys.active ?? 0} active`}
          delay={0.05}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
          }
        />
        <StatCard
          label="Validations (24h)"
          value={stats?.validations.last24h ?? 0}
          subtitle={`${stats?.validations.total ?? 0} total`}
          delay={0.1}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
            </svg>
          }
        />
        <StatCard
          label="Failed Attempts"
          value={stats?.validations.failed ?? 0}
          subtitle="unauthorized"
          delay={0.15}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          }
        />
        <StatCard
          label="Expired / Banned"
          value={(stats?.keys.expired ?? 0) + (stats?.keys.banned ?? 0)}
          subtitle={`${stats?.keys.expired ?? 0} expired, ${stats?.keys.banned ?? 0} banned`}
          delay={0.2}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          }
        />
      </div>

      {/* Plan Distribution + Recent Activity */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Plan Distribution */}
        <GlassCard delay={0.25} hover={false} className="lg:col-span-1">
          <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-white/30">
            Plan Distribution
          </h3>
          <div className="space-y-3">
            {stats?.planDistribution.map((p) => {
              const total = stats.keys.total || 1;
              const pct = Math.round((p.count / total) * 100);
              return (
                <div key={p.plan} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/60">{p.plan}</span>
                    <span className="text-xs text-white/30">
                      {p.count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: 0.3 }}
                      className="h-full rounded-full bg-white/20"
                    />
                  </div>
                </div>
              );
            })}
            {(!stats?.planDistribution || stats.planDistribution.length === 0) && (
              <p className="text-sm text-white/20">No keys generated yet</p>
            )}
          </div>
        </GlassCard>

        {/* Recent Activity */}
        <GlassCard delay={0.3} hover={false} className="lg:col-span-2">
          <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-white/30">
            Recent Activity
          </h3>
          <div className="space-y-2">
            {stats?.recentActivity.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.02]"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${
                      log.success ? "bg-emerald-400/60" : "bg-red-400/60"
                    }`}
                  />
                  <span className="text-sm text-white/50">{log.action}</span>
                </div>
                <div className="flex items-center gap-4">
                  {log.ip && (
                    <span className="font-mono text-xs text-white/20">
                      {log.ip}
                    </span>
                  )}
                  <span className="text-xs text-white/20">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
            {(!stats?.recentActivity || stats.recentActivity.length === 0) && (
              <p className="text-sm text-white/20">No activity yet</p>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
