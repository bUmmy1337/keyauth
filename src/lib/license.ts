// ─────────────────────────────────────────────────────────
// License Key Utilities — Expiry calculation, plan helpers
// ─────────────────────────────────────────────────────────

import type { Plan } from "@prisma/client";

export function getExpiryDate(plan: Plan): Date | null {
  const now = new Date();

  switch (plan) {
    case "DAILY":
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case "WEEKLY":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case "LIFETIME":
      return null; // Never expires
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}

export function isPlanValid(plan: string): plan is Plan {
  return ["DAILY", "WEEKLY", "LIFETIME"].includes(plan);
}

export function isKeyExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false; // Lifetime key
  return new Date() > expiresAt;
}

export function formatKeyMask(key: string): string {
  const parts = key.split("-");
  if (parts.length !== 4) return "****-****-****-****";
  return `${parts[0]}-****-****-${parts[3]}`;
}

export function getPlanLabel(plan: Plan): string {
  const labels: Record<Plan, string> = {
    DAILY: "24 Hours",
    WEEKLY: "7 Days",
    LIFETIME: "Lifetime",
  };
  return labels[plan];
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    ACTIVE: "text-emerald-400",
    EXPIRED: "text-zinc-500",
    BANNED: "text-red-400",
    REVOKED: "text-orange-400",
  };
  return colors[status] || "text-zinc-400";
}
