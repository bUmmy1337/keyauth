"use client";

// ─────────────────────────────────────────────────────────
// Admin Panel — All users, projects, and keys overview
// ADMIN-only page
// ─────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { GlassCard, StatCard } from "@/components/ui";
import { GlassBadge } from "@/components/ui/glass-badge";
import { useApi } from "@/hooks/use-api";

interface ProjectInfo {
  id: string;
  name: string;
  secret: string;
  description: string | null;
  createdAt: string;
  dllHash: string | null;
  dllUploadedAt: string | null;
  _count: { keys: number };
}

interface UserInfo {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  _count: { keys: number; projects: number };
  projects: ProjectInfo[];
}

interface AdminResponse {
  users: UserInfo[];
  stats: {
    totalUsers: number;
    totalProjects: number;
    totalKeys: number;
    activeKeys: number;
  };
}

export default function AdminPage() {
  const api = useApi<AdminResponse>();
  const [data, setData] = useState<AdminResponse | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());
  const [dllUploading, setDllUploading] = useState<string | null>(null);
  const [dllMsg, setDllMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  const fetchData = useCallback(async () => {
    const res = await api.get("/api/admin");
    if (res.success && res.data) setData(res.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function toggleSecret(id: string) {
    setRevealedSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  async function handleDllUpload(projectId: string) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".dll";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      if (file.size > 50 * 1024 * 1024) {
        setDllMsg({ id: projectId, text: "DLL exceeds 50 MB limit.", ok: false });
        return;
      }

      setDllUploading(projectId);
      setDllMsg(null);

      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        const res = await fetch("/api/admin/dll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ projectId, dll: base64 }),
        });

        const json = await res.json();
        if (json.success) {
          setDllMsg({ id: projectId, text: `Uploaded (${(file.size / 1024).toFixed(0)} KB, SHA-256: ${json.data.hash.substring(0, 16)}...)`, ok: true });
          fetchData();
        } else {
          setDllMsg({ id: projectId, text: json.error || "Upload failed.", ok: false });
        }
      } catch (err) {
        setDllMsg({ id: projectId, text: "Network error during upload.", ok: false });
      } finally {
        setDllUploading(null);
      }
    };
    input.click();
  }

  async function handleDllDelete(projectId: string) {
    if (!confirm("Remove DLL payload from this project?")) return;

    setDllUploading(projectId);
    try {
      const res = await fetch("/api/admin/dll", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId }),
      });

      const json = await res.json();
      if (json.success) {
        setDllMsg({ id: projectId, text: "DLL removed.", ok: true });
        fetchData();
      } else {
        setDllMsg({ id: projectId, text: json.error || "Failed to remove.", ok: false });
      }
    } catch {
      setDllMsg({ id: projectId, text: "Network error.", ok: false });
    } finally {
      setDllUploading(null);
    }
  }

  if (api.loading && !data) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
      </div>
    );
  }

  if (api.error) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="glass p-8 text-center">
          <p className="text-sm text-red-400/60">{api.error}</p>
          <p className="mt-2 text-xs text-white/20">Admin access required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Admin Panel
        </h1>
        <p className="mt-1 text-sm text-white/30">
          Global overview of all users, projects, and keys
        </p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Users"
          value={data?.stats.totalUsers ?? 0}
          delay={0.05}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
        />
        <StatCard
          label="Projects"
          value={data?.stats.totalProjects ?? 0}
          delay={0.1}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          }
        />
        <StatCard
          label="Total Keys"
          value={data?.stats.totalKeys ?? 0}
          subtitle={`${data?.stats.activeKeys ?? 0} active`}
          delay={0.15}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
          }
        />
        <StatCard
          label="Active Keys"
          value={data?.stats.activeKeys ?? 0}
          delay={0.2}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          }
        />
      </div>

      {/* ═══════ DLL Payload Management (top-level) ═══════ */}
      {(() => {
        const allProjects = data?.users.flatMap((u) =>
          u.projects.map((p) => ({ ...p, ownerEmail: u.email }))
        ) ?? [];
        if (allProjects.length === 0) return null;
        return (
          <GlassCard hover={false} delay={0.22} className="overflow-hidden p-0">
            <div className="border-b border-white/[0.04] px-6 py-4 flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-violet-400/60">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wider text-white/40">
                  DLL Payload Management
                </h3>
                <p className="text-[10px] text-white/20 mt-0.5">
                  Upload encrypted DLL payloads for secure loader delivery
                </p>
              </div>
            </div>
            <div className="divide-y divide-white/[0.03]">
              {allProjects.map((project) => (
                <div key={project.id}
                  className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-white/[0.015]"
                >
                  {/* Project info */}
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/[0.08] text-violet-400/50">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white/60 truncate">{project.name}</p>
                      <p className="text-[10px] text-white/20 truncate">
                        Owner: {project.ownerEmail} · {project._count.keys} keys
                      </p>
                    </div>
                  </div>

                  {/* DLL status + actions */}
                  <div className="flex items-center gap-3 shrink-0">
                    {project.dllHash ? (
                      <div className="text-right mr-2 hidden sm:block">
                        <p className="font-mono text-[9px] text-emerald-400/40">
                          {project.dllHash.substring(0, 16)}...
                        </p>
                        <p className="text-[9px] text-white/20">
                          {project.dllUploadedAt
                            ? new Date(project.dllUploadedAt).toLocaleDateString()
                            : "uploaded"}
                        </p>
                      </div>
                    ) : (
                      <span className="text-[10px] text-white/15 mr-2 hidden sm:block">
                        No DLL
                      </span>
                    )}

                    {/* Status indicator */}
                    <div className={`h-2 w-2 rounded-full shrink-0 ${project.dllHash ? "bg-emerald-400/50" : "bg-white/10"}`} />

                    <button
                      onClick={() => handleDllUpload(project.id)}
                      disabled={dllUploading === project.id}
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all disabled:opacity-30 ${
                        project.dllHash
                          ? "bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/60"
                          : "bg-violet-500/[0.10] text-violet-300/60 hover:bg-violet-500/[0.18] hover:text-violet-300/80"
                      }`}
                    >
                      {dllUploading === project.id
                        ? "Uploading..."
                        : project.dllHash
                        ? "Replace"
                        : "Upload DLL"}
                    </button>
                    {project.dllHash && (
                      <button
                        onClick={() => handleDllDelete(project.id)}
                        disabled={dllUploading === project.id}
                        className="rounded-lg bg-red-500/[0.06] px-2.5 py-1.5 text-[11px] font-medium text-red-400/50 transition-all hover:bg-red-500/[0.12] hover:text-red-400/70 disabled:opacity-30"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {/* Feedback messages */}
              {dllMsg && (
                <div className="px-6 py-2 border-t border-white/[0.03]">
                  <p className={`text-[10px] ${dllMsg.ok ? "text-emerald-400/50" : "text-red-400/50"}`}>
                    {dllMsg.text}
                  </p>
                </div>
              )}
            </div>
          </GlassCard>
        );
      })()}

      {/* Users Table */}
      <GlassCard hover={false} delay={0.25} className="overflow-hidden p-0">
        <div className="border-b border-white/[0.04] px-6 py-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-white/30">
            All Users
          </h3>
        </div>
        <div className="divide-y divide-white/[0.03]">
          {data?.users.map((user) => (
            <div key={user.id} className="group">
              {/* User Row */}
              <button
                onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-white/[0.02]"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-xs font-semibold text-white/50">
                    {user.email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white/70">{user.email}</p>
                    <p className="text-[10px] text-white/25">
                      Joined {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <GlassBadge variant={user.role === "ADMIN" ? "lifetime" : "daily"}>
                    {user.role}
                  </GlassBadge>
                  <div className="flex gap-4 text-xs text-white/30">
                    <span>{user._count.projects} projects</span>
                    <span>{user._count.keys} keys</span>
                  </div>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className={`text-white/20 transition-transform duration-300 ${
                      expandedUser === user.id ? "rotate-180" : ""
                    }`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </button>

              {/* Expanded: Projects */}
              {expandedUser === user.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden border-t border-white/[0.03] bg-white/[0.01] px-6 py-4"
                >
                  {user.projects.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-[10px] font-medium uppercase tracking-widest text-white/20">
                        Projects
                      </p>
                      {user.projects.map((project) => (
                        <div
                          key={project.id}
                          className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-4"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-white/60">{project.name}</p>
                              {project.description && (
                                <p className="mt-0.5 text-[11px] text-white/25">{project.description}</p>
                              )}
                            </div>
                            <span className="rounded-lg bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-white/30">
                              {project._count.keys} keys
                            </span>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <code className="flex-1 overflow-hidden rounded-lg bg-white/[0.03] px-3 py-1.5 font-mono text-[10px] text-white/30">
                              {revealedSecrets.has(project.id)
                                ? project.secret
                                : `${project.secret.substring(0, 6)}${"•".repeat(20)}`}
                            </code>
                            <button
                              onClick={() => toggleSecret(project.id)}
                              className="rounded-lg p-1 text-white/20 transition-colors hover:text-white/40"
                              title="Toggle visibility"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            </button>
                            <button
                              onClick={() => copyToClipboard(project.secret)}
                              className="rounded-lg p-1 text-white/20 transition-colors hover:text-white/40"
                              title="Copy secret"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <rect x="9" y="9" width="13" height="13" rx="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                            </button>
                          </div>
                          <p className="mt-2 text-[10px] text-white/15">
                            Created {new Date(project.createdAt).toLocaleDateString()}
                          </p>

                          {/* DLL Payload Management */}
                          <div className="mt-3 rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/30">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                  <line x1="16" y1="13" x2="8" y2="13" />
                                  <line x1="16" y1="17" x2="8" y2="17" />
                                </svg>
                                <span className="text-[10px] font-medium uppercase tracking-widest text-white/25">
                                  DLL Payload
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleDllUpload(project.id)}
                                  disabled={dllUploading === project.id}
                                  className="rounded-lg bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium text-white/40 transition-all hover:bg-white/[0.08] hover:text-white/60 disabled:opacity-30"
                                >
                                  {dllUploading === project.id ? "Uploading..." : project.dllHash ? "Replace" : "Upload"}
                                </button>
                                {project.dllHash && (
                                  <button
                                    onClick={() => handleDllDelete(project.id)}
                                    disabled={dllUploading === project.id}
                                    className="rounded-lg bg-red-500/[0.06] px-2 py-1 text-[10px] font-medium text-red-400/50 transition-all hover:bg-red-500/[0.12] hover:text-red-400/70 disabled:opacity-30"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            </div>
                            {project.dllHash ? (
                              <div className="mt-2 space-y-1">
                                <p className="font-mono text-[9px] text-emerald-400/40">
                                  SHA-256: {project.dllHash.substring(0, 32)}...
                                </p>
                                <p className="text-[9px] text-white/20">
                                  Uploaded {project.dllUploadedAt ? new Date(project.dllUploadedAt).toLocaleString() : "unknown"}
                                </p>
                              </div>
                            ) : (
                              <p className="mt-1.5 text-[9px] text-white/15">
                                No DLL uploaded. Upload a .dll to enable secure loader delivery.
                              </p>
                            )}
                            {dllMsg?.id === project.id && (
                              <p className={`mt-1.5 text-[9px] ${dllMsg.ok ? "text-emerald-400/50" : "text-red-400/50"}`}>
                                {dllMsg.text}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-white/20">No projects yet</p>
                  )}
                </motion.div>
              )}
            </div>
          ))}

          {(!data?.users || data.users.length === 0) && (
            <div className="px-6 py-12 text-center text-sm text-white/20">
              No users found
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
