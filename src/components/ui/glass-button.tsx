"use client";

// ─────────────────────────────────────────────────────────
// GlassButton — Glass-morphism action button
// ─────────────────────────────────────────────────────────

import { motion } from "framer-motion";
import { ButtonHTMLAttributes, ReactNode } from "react";

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  loading?: boolean;
}

export function GlassButton({
  children,
  variant = "default",
  size = "md",
  icon,
  loading = false,
  className = "",
  disabled,
  ...props
}: GlassButtonProps) {
  const variants = {
    default: "glass-button",
    primary: "glass-button glass-button-primary",
    danger:
      "glass-button bg-red-500/10 border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-7 py-3.5 text-base",
  };

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      className={`${variants[variant]} ${sizes[size]} inline-flex items-center gap-2 font-medium ${
        disabled || loading ? "pointer-events-none opacity-40" : ""
      } ${className}`}
      disabled={disabled || loading}
      {...(props as Record<string, unknown>)}
    >
      {loading ? (
        <svg
          className="h-4 w-4 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            className="opacity-20"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-80"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      {children}
    </motion.button>
  );
}
