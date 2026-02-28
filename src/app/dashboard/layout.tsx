"use client";

// ─────────────────────────────────────────────────────────
// Dashboard Layout — Sidebar + Content Area
// ─────────────────────────────────────────────────────────

import { Sidebar } from "@/components/layout/sidebar";
import { ToastProvider } from "@/components/ui/glass-toast";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-black">
        <Sidebar />
        <main className="ml-64 flex-1 p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
