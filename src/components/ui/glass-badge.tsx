"use client";

// ─────────────────────────────────────────────────────────
// GlassBadge — Status / Plan badge with liquid style
// ─────────────────────────────────────────────────────────

interface GlassBadgeProps {
  variant: "active" | "expired" | "banned" | "revoked" | "daily" | "weekly" | "monthly" | "lifetime" | "custom";
  children: React.ReactNode;
}

const variantClasses: Record<string, string> = {
  active: "badge badge-active",
  expired: "badge badge-expired",
  banned: "badge badge-banned",
  revoked: "badge badge-revoked",
  daily: "badge bg-blue-500/10 text-blue-400 border border-blue-500/20",
  weekly: "badge bg-purple-500/10 text-purple-400 border border-purple-500/20",
  monthly: "badge bg-teal-500/10 text-teal-400 border border-teal-500/20",
  lifetime: "badge bg-amber-500/10 text-amber-400 border border-amber-500/20",
  custom: "badge bg-rose-500/10 text-rose-400 border border-rose-500/20",
};

export function GlassBadge({ variant, children }: GlassBadgeProps) {
  return <span className={variantClasses[variant] || "badge"}>{children}</span>;
}
