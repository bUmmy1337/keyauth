"use client";

// ─────────────────────────────────────────────────────────
// Audit Logs Page — Filterable log viewer
// ─────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { GlassCard, GlassButton } from "@/components/ui";
import { useApi } from "@/hooks/use-api";

interface LogEntry {
  id: string;
  action: string;
  ip: string | null;
  userAgent: string | null;
  hwid: string | null;
  success: boolean;
  createdAt: string;
  user: { email: string } | null;
  key: { mask: string } | null;
}

interface LogsResponse {
  logs: LogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function LogsPage() {
  const api = useApi<LogsResponse>();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [actionFilter, setActionFilter] = useState("");

  const fetchLogs = useCallback(
    async (page = 1) => {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (actionFilter) params.set("action", actionFilter);

      const res = await api.get(`/api/logs?${params}`);
      if (res.success && res.data) {
        setLogs(res.data.logs);
        setPagination({
          page: res.data.pagination.page,
          totalPages: res.data.pagination.totalPages,
          total: res.data.pagination.total,
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actionFilter]
  );

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Audit Logs
        </h1>
        <p className="mt-1 text-sm text-white/30">
          {pagination.total} total log entries
        </p>
      </motion.div>

      {/* Filters */}
      <div className="flex gap-2">
        {["", "validate", "login", "key"].map((f) => (
          <button
            key={f}
            onClick={() => setActionFilter(f)}
            className={`rounded-xl px-4 py-2 text-xs font-medium transition-all duration-300 ${
              actionFilter === f
                ? "bg-white/[0.08] text-white border border-white/[0.10]"
                : "text-white/30 hover:text-white/50 hover:bg-white/[0.03] border border-transparent"
            }`}
          >
            {f || "All"}
          </button>
        ))}
      </div>

      {/* Logs Table */}
      <GlassCard hover={false} delay={0.1} className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="glass-table w-full">
            <thead>
              <tr>
                <th>Status</th>
                <th>Action</th>
                <th>IP</th>
                <th>Key</th>
                <th>User</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>
                    <div
                      className={`h-2 w-2 rounded-full ${
                        log.success ? "bg-emerald-400/60" : "bg-red-400/60"
                      }`}
                    />
                  </td>
                  <td>
                    <span className="text-xs text-white/50">{log.action}</span>
                  </td>
                  <td>
                    <span className="font-mono text-xs text-white/30">
                      {log.ip || "—"}
                    </span>
                  </td>
                  <td>
                    <span className="font-mono text-xs text-white/30">
                      {log.key?.mask || "—"}
                    </span>
                  </td>
                  <td>
                    <span className="text-xs text-white/30">
                      {log.user?.email || "—"}
                    </span>
                  </td>
                  <td>
                    <span className="text-xs text-white/20">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-white/20">
                    No logs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-white/[0.04] px-6 py-4">
            <span className="text-xs text-white/20">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <GlassButton
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => fetchLogs(pagination.page - 1)}
              >
                Previous
              </GlassButton>
              <GlassButton
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchLogs(pagination.page + 1)}
              >
                Next
              </GlassButton>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
