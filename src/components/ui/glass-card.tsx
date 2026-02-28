"use client";

// ─────────────────────────────────────────────────────────
// GlassCard — Primary container component with liquid glass
// ─────────────────────────────────────────────────────────

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  hover?: boolean;
  onClick?: () => void;
}

export function GlassCard({
  children,
  className = "",
  delay = 0,
  hover = true,
  onClick,
}: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      transition={{
        duration: 0.6,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={
        hover
          ? {
              scale: 1.01,
              transition: { duration: 0.3 },
            }
          : undefined
      }
      onClick={onClick}
      className={`glass p-6 ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      {children}
    </motion.div>
  );
}

// ─── Stat Card ────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  delay?: number;
}

export function StatCard({ label, value, subtitle, icon, delay = 0 }: StatCardProps) {
  return (
    <GlassCard delay={delay} className="relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-white/30">
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-white">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-sm text-white/40">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.04] text-white/30">
            {icon}
          </div>
        )}
      </div>
      {/* Ambient glow */}
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/[0.02] blur-2xl" />
    </GlassCard>
  );
}
