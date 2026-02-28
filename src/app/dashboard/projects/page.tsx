"use client";

// ─────────────────────────────────────────────────────────
// Projects Management Page — with Portal Dashboard Editor
// ─────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  slug: string;
  secret: string;
  description: string | null;
  createdAt: string;
  owner: { email: string };
  _count: { keys: number };
  portalEnabled?: boolean;
  loaderUrl?: string | null;
  requireHwidForDownload?: boolean;
  dashboardConfig?: string | null;
}

interface ProjectsResponse {
  projects: ProjectData[];
}

interface DashboardBlock {
  type: string;
  enabled: boolean;
  label?: string;
  url?: string;
  content?: string;
  icon?: string;
  order: number;
}

interface DashboardConfig {
  blocks: DashboardBlock[];
}

const BLOCK_TYPES = [
  { type: "key_info", label: "Key Info", desc: "Shows license status, plan, expiry" },
  { type: "copy_key", label: "Copy Key", desc: "Button to copy license key" },
  { type: "download_loader", label: "Download Loader", desc: "Loader download button" },
  { type: "hwid_status", label: "HWID Status", desc: "Shows hardware ID binding state" },
  { type: "chat", label: "Chat", desc: "In-project chat between all portal users" },
  { type: "custom_button", label: "Custom Button", desc: "External link button" },
  { type: "custom_text", label: "Custom Text", desc: "Paragraph of text" },
];

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
  const [editProject, setEditProject] = useState<ProjectData | null>(null);

  // Portal editor state
  const [editorSlug, setEditorSlug] = useState("");
  const [editorLoaderUrl, setEditorLoaderUrl] = useState("");
  const [editorPortalEnabled, setEditorPortalEnabled] = useState(true);
  const [editorRequireHwid, setEditorRequireHwid] = useState(true);
  const [editorBlocks, setEditorBlocks] = useState<DashboardBlock[]>([]);
  const [editorSaving, setEditorSaving] = useState(false);

  // Logo upload state
  const [editorLogoPreview, setEditorLogoPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

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

  // ─── Open portal editor ─────────────────────────────────
  async function openEditor(project: ProjectData) {
    // Fetch full project details including portal config
    const res = await fetch(`/api/projects/${project.id}`, { credentials: "include" });
    const data = await res.json();
    if (!data.success) {
      toast("Failed to load project", "error");
      return;
    }

    const p = data.data;
    setEditProject(p);
    setEditorSlug(p.slug || "");
    setEditorLoaderUrl(p.loaderUrl || "");
    setEditorPortalEnabled(p.portalEnabled !== false);
    setEditorRequireHwid(p.requireHwidForDownload !== false);
    setEditorLogoPreview(p.logoData || null);

    try {
      const config: DashboardConfig = p.dashboardConfig
        ? (typeof p.dashboardConfig === "string" ? JSON.parse(p.dashboardConfig) : p.dashboardConfig)
        : { blocks: [] };
      setEditorBlocks(config.blocks || []);
    } catch {
      setEditorBlocks([]);
    }
  }

  function addBlock(type: string) {
    const maxOrder = editorBlocks.reduce((max, b) => Math.max(max, b.order || 0), -1);
    const newBlock: DashboardBlock = {
      type,
      enabled: true,
      order: maxOrder + 1,
      ...(type === "custom_button" ? { label: "Link", url: "https://" } : {}),
      ...(type === "custom_text" ? { content: "" } : {}),
      ...(type === "copy_key" ? { label: "Copy Key" } : {}),
      ...(type === "download_loader" ? { label: "Download Loader" } : {}),
    };
    setEditorBlocks([...editorBlocks, newBlock]);
  }

  function removeBlock(index: number) {
    setEditorBlocks(editorBlocks.filter((_, i) => i !== index));
  }

  function updateBlock(index: number, updates: Partial<DashboardBlock>) {
    setEditorBlocks(editorBlocks.map((b, i) => (i === index ? { ...b, ...updates } : b)));
  }

  function moveBlock(index: number, direction: "up" | "down") {
    const newBlocks = [...editorBlocks];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= newBlocks.length) return;
    [newBlocks[index], newBlocks[target]] = [newBlocks[target], newBlocks[index]];
    setEditorBlocks(newBlocks.map((b, i) => ({ ...b, order: i })));
  }

  async function saveEditor() {
    if (!editProject) return;
    setEditorSaving(true);

    const res = await fetch(`/api/projects/${editProject.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        slug: editorSlug,
        portalEnabled: editorPortalEnabled,
        loaderUrl: editorLoaderUrl || null,
        requireHwidForDownload: editorRequireHwid,
        dashboardConfig: { blocks: editorBlocks },
      }),
    });

    const data = await res.json();
    setEditorSaving(false);

    if (data.success) {
      toast("Portal settings saved", "success");
      setEditProject(null);
      fetchProjects();
    } else {
      toast(data.error || "Failed to save", "error");
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editProject) return;

    if (file.type !== "image/png") {
      toast("Only PNG images are supported", "error");
      return;
    }

    if (file.size > 512 * 1024) {
      toast("Logo too large (max 512KB)", "error");
      return;
    }

    setLogoUploading(true);

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUri = reader.result as string;

      try {
        const res = await fetch(`/api/projects/${editProject.id}/logo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ logoData: dataUri }),
        });

        const data = await res.json();
        if (data.success) {
          setEditorLogoPreview(dataUri);
          toast("Logo uploaded", "success");
        } else {
          toast(data.error || "Failed to upload logo", "error");
        }
      } catch {
        toast("Failed to upload logo", "error");
      }

      setLogoUploading(false);
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be re-selected
    e.target.value = "";
  }

  async function handleLogoRemove() {
    if (!editProject) return;
    setLogoUploading(true);

    try {
      const res = await fetch(`/api/projects/${editProject.id}/logo`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json();
      if (data.success) {
        setEditorLogoPreview(null);
        toast("Logo removed", "success");
      } else {
        toast(data.error || "Failed to remove logo", "error");
      }
    } catch {
      toast("Failed to remove logo", "error");
    }

    setLogoUploading(false);
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

                {/* Portal URL */}
                {project.slug && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-medium uppercase tracking-widest text-white/20">
                      Portal URL
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 overflow-hidden rounded-lg bg-emerald-400/[0.04] px-3 py-2 font-mono text-[11px] text-emerald-400/50 border border-emerald-400/10">
                        /p/{project.slug}
                      </code>
                      <button
                        onClick={() => copyToClipboard(`${window.location.origin}/p/${project.slug}`)}
                        className="rounded-lg p-1.5 text-white/20 transition-colors hover:bg-white/[0.04] hover:text-white/50"
                        title="Copy URL"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 border-t border-white/[0.04] pt-3">
                  <button
                    onClick={() => openEditor(project)}
                    className="rounded-lg px-3 py-1.5 text-[10px] font-medium text-emerald-400/50 transition-colors hover:bg-emerald-400/[0.06] hover:text-emerald-400/80"
                  >
                    Portal Settings
                  </button>
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

      {/* Portal Settings / Dashboard Editor Modal */}
      <GlassModal
        open={!!editProject}
        onClose={() => setEditProject(null)}
        title="Portal Settings"
      >
        {editProject && (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
            {/* General settings */}
            <div className="space-y-4">
              <h4 className="text-xs font-medium uppercase tracking-wider text-white/30">General</h4>

              {/* Logo upload */}
              <div className="rounded-xl bg-white/[0.02] px-4 py-4 border border-white/[0.04] space-y-3">
                <p className="text-sm text-white/60">Project Logo</p>
                <p className="text-[10px] text-white/20">PNG only, max 512KB. Shown on the portal page.</p>
                <div className="flex items-center gap-4">
                  {editorLogoPreview ? (
                    <img
                      src={editorLogoPreview}
                      alt="Logo"
                      className="h-14 w-14 rounded-2xl object-contain border border-white/[0.08] bg-white/[0.03]"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.03] border border-dashed border-white/[0.08]">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/15">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <label className="cursor-pointer rounded-lg bg-white/[0.06] px-3 py-1.5 text-[10px] font-medium text-white/50 transition-colors hover:bg-white/[0.10] border border-white/[0.06]">
                      {logoUploading ? "..." : "Upload PNG"}
                      <input
                        type="file"
                        accept="image/png"
                        onChange={handleLogoUpload}
                        className="hidden"
                        disabled={logoUploading}
                      />
                    </label>
                    {editorLogoPreview && (
                      <button
                        onClick={handleLogoRemove}
                        disabled={logoUploading}
                        className="rounded-lg px-3 py-1.5 text-[10px] font-medium text-red-400/50 transition-colors hover:bg-red-400/[0.06] hover:text-red-400/80 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-white/[0.02] px-4 py-3 border border-white/[0.04]">
                <div>
                  <p className="text-sm text-white/60">Portal Enabled</p>
                  <p className="text-[10px] text-white/20">Allow users to access the portal page</p>
                </div>
                <button
                  onClick={() => setEditorPortalEnabled(!editorPortalEnabled)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    editorPortalEnabled ? "bg-emerald-400/30" : "bg-white/10"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      editorPortalEnabled ? "translate-x-5.5 left-0.5" : "left-0.5"
                    }`}
                    style={{ transform: editorPortalEnabled ? "translateX(20px)" : "translateX(0)" }}
                  />
                </button>
              </div>

              <GlassInput
                label="Portal Slug"
                value={editorSlug}
                onChange={(e) => setEditorSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="my-project"
              />
              <p className="text-[10px] text-white/15 -mt-2">
                Portal URL: {typeof window !== "undefined" ? window.location.origin : ""}/p/{editorSlug || "..."}
              </p>

              <GlassInput
                label="Loader Download URL"
                value={editorLoaderUrl}
                onChange={(e) => setEditorLoaderUrl(e.target.value)}
                placeholder="https://example.com/loader.exe"
              />

              <div className="flex items-center justify-between rounded-xl bg-white/[0.02] px-4 py-3 border border-white/[0.04]">
                <div>
                  <p className="text-sm text-white/60">Require HWID for Download</p>
                  <p className="text-[10px] text-white/20">Users must bind HWID in loader before downloading</p>
                </div>
                <button
                  onClick={() => setEditorRequireHwid(!editorRequireHwid)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    editorRequireHwid ? "bg-emerald-400/30" : "bg-white/10"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform`}
                    style={{ transform: editorRequireHwid ? "translateX(20px)" : "translateX(0)", left: "2px" }}
                  />
                </button>
              </div>
            </div>

            {/* Dashboard Blocks Editor */}
            <div className="space-y-4">
              <h4 className="text-xs font-medium uppercase tracking-wider text-white/30">Dashboard Blocks</h4>
              <p className="text-[10px] text-white/15">
                Configure which blocks appear on the user portal dashboard.
              </p>

              <AnimatePresence>
                {editorBlocks.map((block, i) => (
                  <motion.div
                    key={`block-${i}`}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-white/40">
                          {BLOCK_TYPES.find((bt) => bt.type === block.type)?.label || block.type}
                        </span>
                        <button
                          onClick={() => updateBlock(i, { enabled: !block.enabled })}
                          className={`rounded-lg px-2 py-0.5 text-[10px] ${
                            block.enabled
                              ? "bg-emerald-400/10 text-emerald-400/60"
                              : "bg-white/[0.04] text-white/20"
                          }`}
                        >
                          {block.enabled ? "ON" : "OFF"}
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveBlock(i, "up")}
                          disabled={i === 0}
                          className="rounded-md p-1 text-white/20 hover:bg-white/[0.04] hover:text-white/50 disabled:opacity-20"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
                        </button>
                        <button
                          onClick={() => moveBlock(i, "down")}
                          disabled={i === editorBlocks.length - 1}
                          className="rounded-md p-1 text-white/20 hover:bg-white/[0.04] hover:text-white/50 disabled:opacity-20"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                        </button>
                        <button
                          onClick={() => removeBlock(i)}
                          className="rounded-md p-1 text-red-400/30 hover:bg-red-400/[0.06] hover:text-red-400/60"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                      </div>
                    </div>

                    {/* Block-specific settings */}
                    {(block.type === "custom_button" || block.type === "copy_key" || block.type === "download_loader") && (
                      <input
                        value={block.label || ""}
                        onChange={(e) => updateBlock(i, { label: e.target.value })}
                        placeholder="Button label"
                        className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 placeholder-white/15 outline-none focus:border-white/[0.12]"
                      />
                    )}
                    {block.type === "custom_button" && (
                      <input
                        value={block.url || ""}
                        onChange={(e) => updateBlock(i, { url: e.target.value })}
                        placeholder="https://..."
                        className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 placeholder-white/15 outline-none focus:border-white/[0.12]"
                      />
                    )}
                    {block.type === "custom_text" && (
                      <textarea
                        value={block.content || ""}
                        onChange={(e) => updateBlock(i, { content: e.target.value })}
                        placeholder="Enter text content..."
                        rows={3}
                        className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 placeholder-white/15 outline-none focus:border-white/[0.12] resize-none"
                      />
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Add block */}
              <div className="flex flex-wrap gap-2">
                {BLOCK_TYPES.map((bt) => (
                  <button
                    key={bt.type}
                    onClick={() => addBlock(bt.type)}
                    className="rounded-lg border border-dashed border-white/[0.08] px-3 py-1.5 text-[10px] text-white/30 transition-colors hover:bg-white/[0.04] hover:text-white/50 hover:border-white/[0.15]"
                    title={bt.desc}
                  >
                    + {bt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Save */}
            <GlassButton
              variant="primary"
              className="w-full justify-center"
              onClick={saveEditor}
              loading={editorSaving}
            >
              Save Portal Settings
            </GlassButton>
          </div>
        )}
      </GlassModal>
    </div>
  );
}
