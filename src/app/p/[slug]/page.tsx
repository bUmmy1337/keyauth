"use client";

// ─────────────────────────────────────────────────────────
// /p/[slug] — Public Portal Page for project users
// Handles: Login, Register, Dashboard with key activation,
// loader download, HWID status, and customizable blocks.
// ─────────────────────────────────────────────────────────

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────
interface DashboardBlock {
  type: string;
  enabled: boolean;
  label?: string;
  url?: string;
  content?: string;
  icon?: string;
  order?: number;
}

interface DashboardConfig {
  blocks: DashboardBlock[];
}

interface KeyInfo {
  id: string;
  mask: string;
  decryptedKey: string;
  plan: string;
  status: string;
  hwidLocked: boolean;
  maxSessions: number;
  activeSessions: number;
  note: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface AccessInfo {
  hasKey: boolean;
  keyActive: boolean;
  hwidBound: boolean;
  needsHwidBinding: boolean;
  fullAccess: boolean;
  canDownloadLoader: boolean;
  loaderUrl: string | null;
}

interface ChatMsg {
  id: string;
  text: string;
  createdAt: string;
  author: { id: string; username: string };
}

interface ProjectInfo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  dashboardConfig: DashboardConfig | null;
  logoData: string | null;
}

interface PortalMeResponse {
  user: {
    id: string;
    username: string;
    projectId: string;
    createdAt: string;
  };
  key: KeyInfo | null;
  project: ProjectInfo;
  access: AccessInfo;
}

// ─── Main Component ──────────────────────────────────────
export default function PortalPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [view, setView] = useState<"loading" | "auth" | "dashboard" | "error">("loading");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [dashboardData, setDashboardData] = useState<PortalMeResponse | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [activateKey, setActivateKey] = useState("");
  const [activateError, setActivateError] = useState<string | null>(null);
  const [activateLoading, setActivateLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Check auth on load ─────────────────────────────────
  const loadProject = useCallback(async () => {
    try {
      // Try to fetch project info
      const infoRes = await fetch(`/api/portal/info?slug=${slug}`);
      const infoData = await infoRes.json();

      if (!infoData.success) {
        setView("error");
        return;
      }

      setProjectInfo({
        id: infoData.data.id,
        name: infoData.data.name,
        description: infoData.data.description,
        slug: infoData.data.slug,
        dashboardConfig: infoData.data.dashboardConfig,
        logoData: infoData.data.logoData || null,
      });

      // Try to check existing auth
      const meRes = await fetch("/api/portal/me", { credentials: "include" });
      const meData = await meRes.json();

      if (meData.success && meData.data.project.slug === slug) {
        setDashboardData(meData.data);
        setView("dashboard");
      } else {
        setView("auth");
      }
    } catch {
      setView("error");
    }
  }, [slug]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  // ─── Auth handlers ──────────────────────────────────────
  async function handleAuth(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);

    const form = new FormData(e.currentTarget);
    const username = form.get("username") as string;
    const password = form.get("password") as string;

    try {
      const endpoint = authMode === "login" ? "/api/portal/login" : "/api/portal/register";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username,
          password,
          projectId: projectInfo!.id,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setFormError(data.error || "Something went wrong.");
        setFormLoading(false);
        return;
      }

      // Reload dashboard data
      const meRes = await fetch("/api/portal/me", { credentials: "include" });
      const meData = await meRes.json();

      if (meData.success) {
        setDashboardData(meData.data);
        setView("dashboard");
      }
    } catch {
      setFormError("Network error. Try again.");
    }

    setFormLoading(false);
  }

  // ─── Key activation ─────────────────────────────────────
  async function handleActivate() {
    if (!activateKey.trim()) return;
    setActivateError(null);
    setActivateLoading(true);

    try {
      const res = await fetch("/api/portal/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ key: activateKey.trim() }),
      });

      const data = await res.json();

      if (!data.success) {
        setActivateError(data.error || "Activation failed.");
        setActivateLoading(false);
        return;
      }

      // Reload dashboard
      const meRes = await fetch("/api/portal/me", { credentials: "include" });
      const meData = await meRes.json();
      if (meData.success) {
        setDashboardData(meData.data);
      }
      setActivateKey("");
    } catch {
      setActivateError("Network error. Try again.");
    }

    setActivateLoading(false);
  }

  // ─── Logout ─────────────────────────────────────────────
  async function handleLogout() {
    await fetch("/api/portal/logout", { method: "POST", credentials: "include" });
    setDashboardData(null);
    setView("auth");
  }

  // ─── Copy key ───────────────────────────────────────────
  function copyKey() {
    if (dashboardData?.key?.decryptedKey) {
      navigator.clipboard.writeText(dashboardData.key.decryptedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // ─── Chat functions ──────────────────────────────────────
  const fetchChatMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/chat", { credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setChatMessages(data.data.messages);
      }
    } catch { /* ignore */ }
  }, []);

  async function sendChatMessage() {
    const text = chatInput.trim();
    if (!text || chatSending) return;
    setChatSending(true);

    try {
      const res = await fetch("/api/portal/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.success) {
        setChatMessages((prev) => [...prev, data.data.message]);
        setChatInput("");
      }
    } catch { /* ignore */ }

    setChatSending(false);
  }

  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatOpen) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatOpen]);

  // Poll chat every 5s when open
  useEffect(() => {
    if (chatOpen && view === "dashboard") {
      fetchChatMessages();
      chatPollRef.current = setInterval(fetchChatMessages, 5000);
      return () => {
        if (chatPollRef.current) clearInterval(chatPollRef.current);
      };
    } else {
      if (chatPollRef.current) clearInterval(chatPollRef.current);
    }
  }, [chatOpen, view, fetchChatMessages]);

  // ─── Loading state ──────────────────────────────────────
  if (view === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="bg-ambient" />
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
      </div>
    );
  }

  // ─── Error state ────────────────────────────────────────
  if (view === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="bg-ambient" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-400/10">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-red-400/60">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-white/80">Project Not Found</h1>
          <p className="mt-1 text-sm text-white/30">This portal page doesn&apos;t exist or is disabled.</p>
        </motion.div>
      </div>
    );
  }

  // ─── Auth view ──────────────────────────────────────────
  if (view === "auth") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4">
        <div className="bg-ambient" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          {/* Project header */}
          <div className="mb-8 text-center">
            {projectInfo?.logoData ? (
              <img
                src={projectInfo.logoData}
                alt={projectInfo.name}
                className="mx-auto mb-3 h-12 w-12 rounded-2xl object-contain border border-white/[0.08]"
              />
            ) : (
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.06] border border-white/[0.08]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                </svg>
              </div>
            )}
            <h1 className="text-xl font-semibold tracking-tight text-white">
              {projectInfo?.name}
            </h1>
            {projectInfo?.description && (
              <p className="mt-1 text-sm text-white/30">{projectInfo.description}</p>
            )}
          </div>

          {/* Auth form */}
          <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-xl">
            {/* Tab switcher */}
            <div className="mb-6 flex gap-1 rounded-2xl border border-white/[0.04] bg-white/[0.02] p-1">
              {(["login", "register"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => { setAuthMode(mode); setFormError(null); }}
                  className={`relative flex-1 rounded-xl px-4 py-2 text-xs font-medium transition-all duration-300 ${
                    authMode === mode
                      ? "bg-white/[0.08] text-white"
                      : "text-white/30 hover:text-white/50"
                  }`}
                >
                  {mode === "login" ? "Sign In" : "Create Account"}
                </button>
              ))}
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-widest text-white/20">
                  Username
                </label>
                <input
                  name="username"
                  type="text"
                  required
                  minLength={3}
                  maxLength={32}
                  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-sm text-white/80 placeholder-white/20 outline-none transition-all focus:border-white/[0.12] focus:bg-white/[0.05]"
                  placeholder="Enter username"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-widest text-white/20">
                  Password
                </label>
                <input
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-sm text-white/80 placeholder-white/20 outline-none transition-all focus:border-white/[0.12] focus:bg-white/[0.05]"
                  placeholder="Enter password"
                />
              </div>

              <AnimatePresence>
                {formError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-xs text-red-400/70"
                  >
                    {formError}
                  </motion.p>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={formLoading}
                className="w-full rounded-xl bg-white/[0.08] py-2.5 text-sm font-medium text-white/80 transition-all hover:bg-white/[0.12] disabled:opacity-50 border border-white/[0.06]"
              >
                {formLoading
                  ? "..."
                  : authMode === "login"
                  ? "Sign In"
                  : "Create Account"}
              </button>
            </form>

            {authMode === "register" && (
              <p className="mt-4 text-center text-[11px] text-white/20">
                You can add a license key after creating your account.
              </p>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── Dashboard view ─────────────────────────────────────
  const data = dashboardData!;
  const config = data.project.dashboardConfig;
  const blocks = config?.blocks
    ?.filter((b: DashboardBlock) => b.enabled)
    ?.sort((a: DashboardBlock, b: DashboardBlock) => (a.order ?? 0) - (b.order ?? 0)) || [];

  return (
    <div className="min-h-screen bg-black">
      <div className="bg-ambient" />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.04] bg-black/60 backdrop-blur-2xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            {data.project.logoData ? (
              <img
                src={data.project.logoData}
                alt={data.project.name}
                className="h-7 w-7 rounded-xl object-contain"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/[0.08]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                </svg>
              </div>
            )}
            <span className="text-sm font-semibold tracking-tight text-white/80">
              {data.project.name}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/30">{data.user.username}</span>
            <button
              onClick={handleLogout}
              className="rounded-lg px-3 py-1.5 text-xs text-white/30 transition-colors hover:bg-white/[0.04] hover:text-white/60"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 pt-24 pb-20">
        <div className="space-y-6">
          {/* ─── No key state ──────────────────────────── */}
          {!data.access.hasKey && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-amber-400/10 bg-amber-400/[0.03] p-6"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-400/10">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-400/70">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-amber-400/80">Activate License Key</h3>
                  <p className="mt-1 text-xs text-white/30">
                    Enter your license key to unlock full access. You can get a key from the project administrator.
                  </p>
                  <div className="mt-4 flex gap-2">
                    <input
                      value={activateKey}
                      onChange={(e) => setActivateKey(e.target.value)}
                      placeholder="XXXX-XXXX-XXXX-XXXX"
                      className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2 font-mono text-sm text-white/80 placeholder-white/20 outline-none transition-all focus:border-white/[0.12]"
                    />
                    <button
                      onClick={handleActivate}
                      disabled={activateLoading || !activateKey.trim()}
                      className="rounded-xl bg-amber-400/10 px-4 py-2 text-xs font-medium text-amber-400/80 transition-all hover:bg-amber-400/20 disabled:opacity-50 border border-amber-400/20"
                    >
                      {activateLoading ? "..." : "Activate"}
                    </button>
                  </div>
                  <AnimatePresence>
                    {activateError && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mt-2 text-xs text-red-400/70"
                      >
                        {activateError}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── HWID not bound warning ────────────────── */}
          {data.access.needsHwidBinding && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-blue-400/10 bg-blue-400/[0.03] p-6"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-400/10">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400/70">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-blue-400/80">HWID Binding Required</h3>
                  <p className="mt-1 text-xs text-white/30">
                    Your key has been activated on this site, but you need to download the loader and run it on your PC to bind your hardware ID. 
                    This is required to access all features.
                  </p>
                  <p className="mt-2 text-[11px] text-white/20">
                    Download the loader below and activate your key there to complete the setup.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── Dashboard blocks ──────────────────────── */}
          {blocks.map((block: DashboardBlock, i: number) => (
            <motion.div
              key={`${block.type}-${i}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              {block.type === "key_info" && data.key && (
                <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-xl">
                  <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-white/30">
                    License Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div>
                      <p className="text-[10px] text-white/20">Status</p>
                      <p className={`text-sm font-medium ${
                        data.key.status === "ACTIVE" ? "text-emerald-400" : 
                        data.key.status === "EXPIRED" ? "text-zinc-500" : "text-red-400"
                      }`}>
                        {data.key.status}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/20">Plan</p>
                      <p className="text-sm font-medium text-white/70">{data.key.plan}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/20">Expires</p>
                      <p className="text-sm font-medium text-white/70">
                        {data.key.expiresAt
                          ? new Date(data.key.expiresAt).toLocaleDateString()
                          : "Never"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/20">Sessions</p>
                      <p className="text-sm font-medium text-white/70">
                        {data.key.activeSessions}/{data.key.maxSessions}
                      </p>
                    </div>
                  </div>
                  {data.key.note && (
                    <div className="mt-4 rounded-xl bg-white/[0.03] px-4 py-2">
                      <p className="text-xs text-white/30">{data.key.note}</p>
                    </div>
                  )}
                </div>
              )}

              {block.type === "copy_key" && data.key && (
                <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-medium uppercase tracking-wider text-white/30">
                        {block.label || "Your License Key"}
                      </h3>
                      <code className="mt-2 block font-mono text-sm text-white/60">
                        {data.key.mask}
                      </code>
                    </div>
                    <button
                      onClick={copyKey}
                      className="rounded-xl bg-white/[0.06] px-4 py-2 text-xs font-medium text-white/50 transition-all hover:bg-white/[0.10] border border-white/[0.06]"
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              )}

              {block.type === "download_loader" && (
                <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-medium uppercase tracking-wider text-white/30">
                        {block.label || "Loader"}
                      </h3>
                      <p className="mt-1 text-xs text-white/20">
                        {data.access.canDownloadLoader
                          ? "Download the latest version of the loader."
                          : data.access.needsHwidBinding
                          ? "Bind your HWID in the loader to access download."
                          : "Activate a license key to download the loader."}
                      </p>
                    </div>
                    {data.access.canDownloadLoader && data.access.loaderUrl ? (
                      <a
                        href={data.access.loaderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-xl bg-emerald-400/10 px-4 py-2 text-xs font-medium text-emerald-400/80 transition-all hover:bg-emerald-400/20 border border-emerald-400/20"
                      >
                        Download
                      </a>
                    ) : (
                      <button
                        disabled
                        className="rounded-xl bg-white/[0.04] px-4 py-2 text-xs font-medium text-white/20 border border-white/[0.04] cursor-not-allowed"
                      >
                        Locked
                      </button>
                    )}
                  </div>
                </div>
              )}

              {block.type === "hwid_status" && data.key && (
                <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-xl">
                  <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-white/30">
                    Hardware ID Status
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className={`h-2.5 w-2.5 rounded-full ${
                      data.access.hwidBound ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
                    }`} />
                    <p className="text-sm text-white/60">
                      {data.access.hwidBound
                        ? "HWID is bound — full access granted."
                        : "HWID not bound — please activate in the loader."}
                    </p>
                  </div>
                </div>
              )}

              {block.type === "custom_button" && block.url && (
                <a
                  href={block.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-xl transition-colors hover:bg-white/[0.04]"
                >
                  <span className="text-sm font-medium text-white/70">
                    {block.label || "Link"}
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/30">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              )}

              {block.type === "custom_text" && block.content && (
                <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-xl">
                  <p className="text-sm leading-relaxed text-white/50">{block.content}</p>
                </div>
              )}

              {block.type === "chat" && (
                <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl overflow-hidden">
                  {/* Chat header */}
                  <button
                    onClick={() => setChatOpen(!chatOpen)}
                    className="flex w-full items-center justify-between p-6 transition-colors hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-400/10">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-violet-400/70">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      </div>
                      <h3 className="text-xs font-medium uppercase tracking-wider text-white/30">
                        {block.label || "Project Chat"}
                      </h3>
                    </div>
                    <svg
                      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      className={`text-white/20 transition-transform duration-200 ${chatOpen ? "rotate-180" : ""}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {/* Chat body */}
                  <AnimatePresence>
                    {chatOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        {/* Messages */}
                        <div className="h-72 overflow-y-auto border-t border-white/[0.04] px-4 py-3 space-y-2">
                          {chatMessages.length === 0 && (
                            <p className="py-8 text-center text-xs text-white/15">No messages yet. Start the conversation!</p>
                          )}
                          {chatMessages.map((msg) => {
                            const isMe = msg.author.id === data.user.id;
                            return (
                              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${
                                  isMe
                                    ? "bg-violet-400/10 border border-violet-400/10"
                                    : "bg-white/[0.04] border border-white/[0.04]"
                                }`}>
                                  {!isMe && (
                                    <p className="mb-0.5 text-[10px] font-medium text-violet-400/50">{msg.author.username}</p>
                                  )}
                                  <p className="text-xs text-white/60 break-words">{msg.text}</p>
                                  <p className="mt-0.5 text-[9px] text-white/15 text-right">
                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                          <div ref={chatEndRef} />
                        </div>

                        {/* Input */}
                        <div className="border-t border-white/[0.04] p-3 flex gap-2">
                          <input
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                            placeholder="Type a message..."
                            maxLength={2000}
                            className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-xs text-white/70 placeholder-white/15 outline-none transition-all focus:border-white/[0.12]"
                          />
                          <button
                            onClick={sendChatMessage}
                            disabled={chatSending || !chatInput.trim()}
                            className="rounded-xl bg-violet-400/10 px-4 py-2 text-xs font-medium text-violet-400/70 transition-all hover:bg-violet-400/20 disabled:opacity-30 border border-violet-400/20"
                          >
                            {chatSending ? "..." : "Send"}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          ))}

          {/* ─── Empty state for no-key users ──────────── */}
          {!data.access.hasKey && blocks.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-white/[0.04] bg-white/[0.01] p-8 text-center"
            >
              <p className="text-sm text-white/30">
                Activate a license key to access your dashboard.
              </p>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
