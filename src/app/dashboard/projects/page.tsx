"use client";

// ─────────────────────────────────────────────────────────
// Projects Management Page
// ─────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  GlassCard,
  GlassButton,
  GlassModal,
  GlassInput,
} from "@/components/ui";
import { useToast } from "@/components/ui/glass-toast";
import { useApi } from "@/hooks/use-api";

interface ProjectData {
  id: string;
  name: string;
  secret: string;
  description: string | null;
  createdAt: string;
  owner: { email: string };
  _count: { keys: number };
}

interface ProjectsResponse {
  projects: ProjectData[];
}

export default function ProjectsPage() {
  const { toast } = useToast();
  const api = useApi<ProjectsResponse>();
  const createApi = useApi();

  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    const res = await api.get("/api/projects");
    if (res.success && res.data) {
      setProjects(res.data.projects);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  async function handleCreate() {
    if (!name.trim()) {
      toast("Project name is required", "error");
      return;
    }

    const res = await createApi.post("/api/projects", {
      name: name.trim(),
      description: description.trim() || undefined,
    });

    if (res.success) {
      toast("Project created", "success");
      setShowCreate(false);
      setName("");
      setDescription("");
      fetchProjects();
    } else {
      toast(res.error || "Failed to create project", "error");
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/projects/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const data = await res.json();
    if (data.success) {
      toast("Project deleted", "success");
      setConfirmDelete(null);
      fetchProjects();
    } else {
      toast(data.error || "Failed to delete project", "error");
    }
  }

  async function handleRegenSecret(id: string) {
    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ regenerateSecret: true }),
    });
    const data = await res.json();
    if (data.success) {
      toast("Secret regenerated", "success");
      fetchProjects();
    } else {
      toast(data.error || "Failed to regenerate secret", "error");
    }
  }

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
    toast("Copied to clipboard", "info");
  }

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
            Projects
          </h1>
          <p className="mt-1 text-sm text-white/30">
            {projects.length} project{projects.length !== 1 ? "s" : ""} — each with its own API secret
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
          New Project
        </GlassButton>
      </motion.div>

      {/* Projects Grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project, i) => (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
          >
            <GlassCard hover delay={0}>
              <div className="space-y-4">
                {/* Name + key count */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white/80">{project.name}</h3>
                    {project.description && (
                      <p className="mt-1 text-xs text-white/30">{project.description}</p>
                    )}
                  </div>
                  <span className="rounded-lg bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-white/40">
                    {project._count.keys} keys
                  </span>
                </div>

                {/* Secret */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-white/20">
                    Project Secret
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 overflow-hidden rounded-lg bg-white/[0.03] px-3 py-2 font-mono text-[11px] text-white/40">
                      {revealedSecrets.has(project.id)
                        ? project.secret
                        : "•".repeat(32)}
                    </code>
                    <button
                      onClick={() => toggleSecret(project.id)}
                      className="rounded-lg p-1.5 text-white/20 transition-colors hover:bg-white/[0.04] hover:text-white/50"
                      title={revealedSecrets.has(project.id) ? "Hide" : "Reveal"}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        {revealedSecrets.has(project.id) ? (
                          <>
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </>
                        ) : (
                          <>
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </>
                        )}
                      </svg>
                    </button>
                    <button
                      onClick={() => copyToClipboard(project.secret)}
                      className="rounded-lg p-1.5 text-white/20 transition-colors hover:bg-white/[0.04] hover:text-white/50"
                      title="Copy"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Meta */}
                <div className="flex items-center justify-between text-[10px] text-white/20">
                  <span>{project.owner.email}</span>
                  <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 border-t border-white/[0.04] pt-3">
                  <button
                    onClick={() => handleRegenSecret(project.id)}
                    className="rounded-lg px-3 py-1.5 text-[10px] font-medium text-amber-400/50 transition-colors hover:bg-amber-400/[0.06] hover:text-amber-400/80"
                  >
                    Regenerate Secret
                  </button>
                  <button
                    onClick={() => setConfirmDelete(project.id)}
                    className="rounded-lg px-3 py-1.5 text-[10px] font-medium text-red-400/50 transition-colors hover:bg-red-400/[0.06] hover:text-red-400/80"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}

        {projects.length === 0 && !api.loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="col-span-full py-20 text-center"
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-white/[0.04]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/20">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-sm text-white/30">No projects yet</p>
            <p className="mt-1 text-xs text-white/15">Create a project to start generating keys</p>
          </motion.div>
        )}
      </div>

      {/* Create Modal */}
      <GlassModal open={showCreate} onClose={() => setShowCreate(false)} title="New Project">
        <div className="space-y-5">
          <GlassInput
            label="Project Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Application"
            required
          />
          <GlassInput
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this project"
          />
          <div className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-4">
            <p className="text-xs text-white/30">
              A unique API secret will be generated automatically. Use it in your client app
              to scope license validation to this project.
            </p>
          </div>
          <GlassButton
            variant="primary"
            className="w-full justify-center"
            onClick={handleCreate}
            loading={createApi.loading}
          >
            Create Project
          </GlassButton>
        </div>
      </GlassModal>

      {/* Delete Confirmation */}
      <GlassModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Project"
      >
        <div className="space-y-5">
          <p className="text-sm text-white/40">
            This will permanently delete the project and <strong className="text-red-400/60">all its license keys</strong>.
            This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <GlassButton
              variant="default"
              className="flex-1 justify-center"
              onClick={() => setConfirmDelete(null)}
            >
              Cancel
            </GlassButton>
            <GlassButton
              variant="danger"
              className="flex-1 justify-center"
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
            >
              Delete Project
            </GlassButton>
          </div>
        </div>
      </GlassModal>
    </div>
  );
}
