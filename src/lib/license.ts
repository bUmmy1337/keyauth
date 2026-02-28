// ─────────────────────────────────────────────────────────
// License Key Utilities — Expiry calculation, plan helpers
// ─────────────────────────────────────────────────────────

import type { Plan } from "@prisma/client";

export function getExpiryDate(plan: Plan, customDays?: number): Date | null {
  const now = new Date();
  const DAY = 24 * 60 * 60 * 1000;

  switch (plan) {
    case "DAILY":
      return new Date(now.getTime() + 1 * DAY);
    case "WEEKLY":
      return new Date(now.getTime() + 7 * DAY);
    case "MONTHLY":
      return new Date(now.getTime() + 30 * DAY);
    case "CUSTOM":
      if (!customDays || customDays < 1) return new Date(now.getTime() + 1 * DAY);
      return new Date(now.getTime() + customDays * DAY);
    case "LIFETIME":
      return null;
    default:
      return new Date(now.getTime() + 1 * DAY);
  }
}

export function isPlanValid(plan: string): plan is Plan {
  return ["DAILY", "WEEKLY", "MONTHLY", "LIFETIME", "CUSTOM"].includes(plan);
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

export function getPlanLabel(plan: Plan, customDays?: number | null): string {
  const labels: Record<Plan, string> = {
    DAILY: "24 Hours",
    WEEKLY: "7 Days",
    MONTHLY: "30 Days",
    LIFETIME: "Lifetime",
    CUSTOM: customDays ? `${customDays} Days` : "Custom",
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
