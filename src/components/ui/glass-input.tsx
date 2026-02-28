"use client";

// ─────────────────────────────────────────────────────────
// GlassInput — Glass-morphism form input
// ─────────────────────────────────────────────────────────

import { InputHTMLAttributes, forwardRef } from "react";

interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ label, error, className = "", ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-xs font-medium uppercase tracking-wider text-white/40">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`glass-input w-full px-4 py-3 text-sm text-white ${className}`}
          {...props}
        />
        {error && (
          <p className="text-xs text-red-400/80">{error}</p>
        )}
      </div>
    );
  }
);

GlassInput.displayName = "GlassInput";
