"use client";

// ─────────────────────────────────────────────────────────
// GlassSelect — Glass-morphism dropdown select
// ─────────────────────────────────────────────────────────

import { SelectHTMLAttributes, forwardRef } from "react";

interface GlassSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export const GlassSelect = forwardRef<HTMLSelectElement, GlassSelectProps>(
  ({ label, options, className = "", ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-xs font-medium uppercase tracking-wider text-white/40">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={`glass-input w-full appearance-none px-4 py-3 text-sm text-white bg-transparent ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-zinc-900 text-white">
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
);

GlassSelect.displayName = "GlassSelect";
