"use client";

// ─────────────────────────────────────────────────────────
// License Keys Management Page
// ─────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  GlassCard,
  GlassButton,
  GlassModal,
  GlassSelect,
  GlassInput,
  GlassBadge,
} from "@/components/ui";
import { useToast } from "@/components/ui/glass-toast";
import { useApi } from "@/hooks/use-api";

interface KeyData {
  id: string;
  mask: string;
  plan: "DAILY" | "WEEKLY" | "MONTHLY" | "LIFETIME" | "CUSTOM";
  status: "ACTIVE" | "EXPIRED" | "BANNED" | "REVOKED";
  hwidLocked: boolean;
  maxSessions: number;
  activeSessions: number;
  expiresAt: string | null;
  createdAt: string;
  createdBy: { email: string };
  _count: { logs: number };
}

interface KeysResponse {
  keys: KeyData[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface CreatedKey {
  id: string;
  key: string;
  mask: string;
  plan: string;
  expiresAt: string | null;
}

export default function KeysPage() {
  const { toast } = useToast();
  const api = useApi<KeysResponse>();
  const createApi = useApi();

  const [keys, setKeys] = useState<KeyData[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [showCreate, setShowCreate] = useState(false);
  const [showCreated, setShowCreated] = useState(false);
  const [createdKeys, setCreatedKeys] = useState<CreatedKey[]>([]);

  // Create form state
  const [plan, setPlan] = useState("DAILY");
  const [count, setCount] = useState("1");
  const [maxSessions, setMaxSessions] = useState("1");
  const [customDays, setCustomDays] = useState("30");
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState("");

  const fetchKeys = useCallback(
    async (page = 1) => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (filter) params.set("status", filter);

      const res = await api.get(`/api/keys?${params}`);
      if (res.success && res.data) {
        setKeys(res.data.keys);
        setPagination({
          page: res.data.pagination.page,
          totalPages: res.data.pagination.totalPages,
          total: res.data.pagination.total,
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filter]
  );

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  async function handleCreate() {
    const res = await createApi.post("/api/keys", {
      plan,
      count: parseInt(count),
      maxSessions: parseInt(maxSessions),
      ...(plan === "CUSTOM" ? { customDays: parseInt(customDays) } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    });

    if (res.success && res.data) {
      const data = res.data as { keys: CreatedKey[] };
      setCreatedKeys(data.keys);
      setShowCreate(false);
      setShowCreated(true);
      fetchKeys();
      toast(`Created ${data.keys.length} key(s)`, "success");
    } else {
      toast(res.error || "Failed to create keys", "error");
    }
  }

  async function handleAction(id: string, action: "ban" | "revoke" | "reset" | "activate") {
    const actions: Record<string, { method: string; url: string; body?: unknown }> = {
      ban: { method: "PATCH", url: `/api/keys/${id}`, body: { status: "BANNED" } },
      revoke: { method: "DELETE", url: `/api/keys/${id}` },
      reset: { method: "PATCH", url: `/api/keys/${id}`, body: { resetHwid: true } },
      activate: { method: "PATCH", url: `/api/keys/${id}`, body: { status: "ACTIVE" } },
    };

    const { method, url, body } = actions[action];
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json();
    if (data.success) {
      toast(`Key ${action}ed successfully`, "success");
      fetchKeys();
    } else {
      toast(data.error || "Action failed", "error");
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast("Copied to clipboard", "info");
  }

  const statusBadge = (status: string) => {
    const variant = status.toLowerCase() as "active" | "expired" | "banned" | "revoked";
    return <GlassBadge variant={variant}>{status}</GlassBadge>;
  };

  const planBadge = (p: string) => {
    const variant = p.toLowerCase() as "daily" | "weekly" | "monthly" | "lifetime" | "custom";
    return <GlassBadge variant={variant}>{p}</GlassBadge>;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            License Keys
          </h1>
          <p className="mt-1 text-sm text-white/30">
            {pagination.total} total keys managed
          </p>
        </div>
        <GlassButton
          variant="primary"
          onClick={() => setShowCreate(true)}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          }
        >
          Generate Keys
        </GlassButton>
      </motion.div>

      {/* Filters */}
      <div className="flex gap-2">
        {["", "ACTIVE", "EXPIRED", "BANNED", "REVOKED"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-xl px-4 py-2 text-xs font-medium transition-all duration-300 ${
              filter === f
                ? "bg-white/[0.08] text-white border border-white/[0.10]"
                : "text-white/30 hover:text-white/50 hover:bg-white/[0.03] border border-transparent"
            }`}
          >
            {f || "All"}
          </button>
        ))}
      </div>

      {/* Keys Table */}
      <GlassCard hover={false} delay={0.1} className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="glass-table w-full">
            <thead>
              <tr>
                <th>Key</th>
                <th>Plan</th>
                <th>Status</th>
                <th>HWID</th>
                <th>Sessions</th>
                <th>Expires</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id}>
                  <td>
                    <span className="font-mono text-xs text-white/50">{key.mask}</span>
                  </td>
                  <td>{planBadge(key.plan)}</td>
                  <td>{statusBadge(key.status)}</td>
                  <td>
                    <span
                      className={`text-xs ${
                        key.hwidLocked ? "text-amber-400/60" : "text-white/20"
                      }`}
                    >
                      {key.hwidLocked ? "Locked" : "Unlocked"}
                    </span>
                  </td>
                  <td>
                    <span className="text-xs text-white/40">
                      {key.activeSessions}/{key.maxSessions}
                    </span>
                  </td>
                  <td>
                    <span className="text-xs text-white/30">
                      {key.expiresAt
                        ? new Date(key.expiresAt).toLocaleDateString()
                        : "Never"}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      {key.hwidLocked && (
                        <button
                          onClick={() => handleAction(key.id, "reset")}
                          className="rounded-lg px-2 py-1 text-[10px] font-medium text-white/30 transition-colors hover:bg-white/[0.04] hover:text-white/50"
                          title="Reset HWID"
                        >
                          Reset
                        </button>
                      )}
                      {key.status === "ACTIVE" && (
                        <button
                          onClick={() => handleAction(key.id, "ban")}
                          className="rounded-lg px-2 py-1 text-[10px] font-medium text-red-400/50 transition-colors hover:bg-red-400/[0.06] hover:text-red-400/80"
                          title="Ban Key"
                        >
                          Ban
                        </button>
                      )}
                      {key.status !== "ACTIVE" && key.status !== "REVOKED" && (
                        <button
                          onClick={() => handleAction(key.id, "activate")}
                          className="rounded-lg px-2 py-1 text-[10px] font-medium text-emerald-400/50 transition-colors hover:bg-emerald-400/[0.06] hover:text-emerald-400/80"
                          title="Activate"
                        >
                          Activate
                        </button>
                      )}
                      {key.status !== "REVOKED" && (
                        <button
                          onClick={() => handleAction(key.id, "revoke")}
                          className="rounded-lg px-2 py-1 text-[10px] font-medium text-orange-400/50 transition-colors hover:bg-orange-400/[0.06] hover:text-orange-400/80"
                          title="Revoke"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {keys.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-white/20">
                    No keys found. Generate your first license key.
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
                onClick={() => fetchKeys(pagination.page - 1)}
              >
                Previous
              </GlassButton>
              <GlassButton
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchKeys(pagination.page + 1)}
              >
                Next
              </GlassButton>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Create Modal */}
      <GlassModal open={showCreate} onClose={() => setShowCreate(false)} title="Generate License Keys">
        <div className="space-y-5">
          <GlassSelect
            label="Plan"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            options={[
              { value: "DAILY", label: "Daily (24 Hours)" },
              { value: "WEEKLY", label: "Weekly (7 Days)" },
              { value: "MONTHLY", label: "Monthly (30 Days)" },
              { value: "LIFETIME", label: "Lifetime" },
              { value: "CUSTOM", label: "Custom Duration" },
            ]}
          />
          {plan === "CUSTOM" && (
            <GlassInput
              label="Custom Duration (Days)"
              type="number"
              min={1}
              max={3650}
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              placeholder="e.g. 90"
            />
          )}
          <GlassInput
            label="Number of Keys"
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
          <GlassInput
            label="Max Concurrent Sessions"
            type="number"
            min={1}
            max={10}
            value={maxSessions}
            onChange={(e) => setMaxSessions(e.target.value)}
          />
          <GlassInput
            label="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="VIP client, team license, etc."
          />
          <GlassButton
            variant="primary"
            className="w-full justify-center"
            onClick={handleCreate}
            loading={createApi.loading}
          >
            Generate
          </GlassButton>
        </div>
      </GlassModal>

      {/* Created Keys Modal */}
      <GlassModal
        open={showCreated}
        onClose={() => setShowCreated(false)}
        title="Generated License Keys"
      >
        <p className="mb-4 text-xs text-white/30">
          Copy these keys now — they will not be shown again.
        </p>
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {createdKeys.map((k) => (
            <div
              key={k.id}
              className="glass-sm flex items-center justify-between px-4 py-3"
            >
              <span className="font-mono text-sm text-white/70">{k.key}</span>
              <button
                onClick={() => copyToClipboard(k.key)}
                className="text-xs text-white/30 transition-colors hover:text-white/50"
              >
                Copy
              </button>
            </div>
          ))}
        </div>
        <GlassButton
          variant="default"
          className="mt-4 w-full justify-center"
          onClick={() => {
            const allKeys = createdKeys.map((k) => k.key).join("\n");
            copyToClipboard(allKeys);
          }}
        >
          Copy All Keys
        </GlassButton>
      </GlassModal>
    </div>
  );
}
