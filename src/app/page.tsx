"use client";

// ─────────────────────────────────────────────────────────
// Landing Page — Liquid Glass Monochrome
// ─────────────────────────────────────────────────────────

import { motion } from "framer-motion";
import Link from "next/link";

const fadeUp = {
  hidden: { opacity: 0, y: 30, filter: "blur(10px)" },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.7, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] },
  }),
};

const features = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
    ),
    title: "AES-256-GCM Encryption",
    desc: "Military-grade encryption for all license keys and sensitive data at rest.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <path d="M8 21h8" />
        <path d="M12 17v4" />
      </svg>
    ),
    title: "HWID Locking",
    desc: "Bind license keys to specific hardware. Prevent sharing and unauthorized usage.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: "Multi-Tenant Isolation",
    desc: "Each user gets their own isolated panel. Keys, logs, and stats are fully separated.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    title: "Real-Time Heartbeat",
    desc: "Track active sessions in real time. Auto-expire inactive connections instantly.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
    title: "Telegram Bot API",
    desc: "Validate keys, check info, and reset HWID directly from your Telegram bot.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    title: "Flexible Plans",
    desc: "Daily, weekly, monthly, lifetime, or custom duration plans with full control.",
  },
];

const stats = [
  { value: "AES-256", label: "Encryption" },
  { value: "<50ms", label: "Validation" },
  { value: "99.9%", label: "Uptime" },
  { value: "∞", label: "Scalable" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Ambient orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-[600px] w-[600px] rounded-full bg-white/[0.015] blur-[120px]" />
        <div className="absolute top-1/2 right-1/4 h-[400px] w-[400px] rounded-full bg-white/[0.01] blur-[100px]" />
        <div className="absolute -bottom-20 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-white/[0.008] blur-[80px]" />
      </div>

      {/* ─── Navbar ─────────────────────────────────────── */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 md:px-12"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.08]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-lg font-semibold tracking-tight text-white">KeyVault</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/docs" className="text-sm text-white/40 transition-colors hover:text-white/70">
            Docs
          </Link>
          <Link
            href="/login"
            className="glass-sm px-5 py-2 text-sm font-medium text-white/70 transition-all hover:text-white hover:bg-white/[0.06]"
          >
            Sign In
          </Link>
        </div>
      </motion.nav>

      {/* ─── Hero ───────────────────────────────────────── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial="hidden"
          animate="visible"
          className="max-w-3xl"
        >
          <motion.div variants={fadeUp} custom={0} className="mb-6">
            <span className="glass-sm inline-block px-4 py-1.5 text-xs font-medium tracking-wider text-white/40 uppercase">
              Self-Hosted License Management
            </span>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            custom={1}
            className="text-5xl font-bold tracking-tight text-white md:text-7xl"
          >
            Your keys.{" "}
            <span className="bg-gradient-to-r from-white/90 via-white/50 to-white/20 bg-clip-text text-transparent">
              Your rules.
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            custom={2}
            className="mx-auto mt-6 max-w-xl text-lg text-white/30 leading-relaxed"
          >
            A modern, self-hosted KeyAuth alternative with AES-256 encryption,
            HWID locking, multi-tenant isolation, and a beautiful glass dashboard.
          </motion.p>

          <motion.div
            variants={fadeUp}
            custom={3}
            className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
          >
            <Link
              href="/login"
              className="glass group relative inline-flex items-center gap-2 px-8 py-3.5 text-sm font-medium text-white transition-all hover:bg-white/[0.08]"
            >
              Get Started
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-0.5">
                <path d="M5 12h14" />
                <path d="M12 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/docs"
              className="glass-sm inline-flex items-center gap-2 px-8 py-3.5 text-sm font-medium text-white/50 transition-all hover:text-white/80"
            >
              Documentation
            </Link>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-10"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="flex h-10 w-6 items-start justify-center rounded-full border border-white/[0.1] p-1.5"
          >
            <div className="h-2 w-1 rounded-full bg-white/30" />
          </motion.div>
        </motion.div>
      </section>

      {/* ─── Stats Bar ──────────────────────────────────── */}
      <section className="relative py-12">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-8 px-6 md:gap-16"
        >
          {stats.map((s, i) => (
            <motion.div key={s.label} variants={fadeUp} custom={i} className="text-center">
              <div className="text-2xl font-bold tracking-tight text-white md:text-3xl">{s.value}</div>
              <div className="mt-1 text-xs text-white/30 uppercase tracking-wider">{s.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ─── Features Grid ──────────────────────────────── */}
      <section className="relative py-24 px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="mx-auto max-w-5xl"
        >
          <motion.div variants={fadeUp} custom={0} className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
              Everything you need
            </h2>
            <p className="mt-4 text-white/30">
              Enterprise-grade license management, beautifully simple.
            </p>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                custom={i + 1}
                className="glass group p-6 transition-all hover:bg-white/[0.04]"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] text-white/50 transition-colors group-hover:text-white/80">
                  {f.icon}
                </div>
                <h3 className="text-sm font-semibold text-white/80">{f.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-white/30">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ─── How It Works ───────────────────────────────── */}
      <section className="relative py-24 px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="mx-auto max-w-3xl"
        >
          <motion.div variants={fadeUp} custom={0} className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
              Three steps to launch
            </h2>
          </motion.div>

          <div className="space-y-8">
            {[
              { step: "01", title: "Deploy to Vercel", desc: "One-click deploy with environment variables. Connect your PostgreSQL database." },
              { step: "02", title: "Create your account", desc: "Register your admin account. Add team members with scoped access." },
              { step: "03", title: "Generate & validate", desc: "Create license keys from the dashboard. Integrate validation into your app." },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                variants={fadeUp}
                custom={i + 1}
                className="glass flex items-start gap-6 p-6"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-sm font-bold text-white/40">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white/80">{item.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-white/30">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ─── CTA ────────────────────────────────────────── */}
      <section className="relative py-24 px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="mx-auto max-w-2xl text-center"
        >
          <motion.h2
            variants={fadeUp}
            custom={0}
            className="text-3xl font-bold tracking-tight text-white md:text-4xl"
          >
            Ready to take control?
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="mt-4 text-white/30">
            Deploy your own license server in minutes. No vendor lock-in. Full ownership.
          </motion.p>
          <motion.div variants={fadeUp} custom={2} className="mt-8">
            <Link
              href="/login"
              className="glass inline-flex items-center gap-2 px-10 py-4 text-sm font-medium text-white transition-all hover:bg-white/[0.08]"
            >
              Start now — it&apos;s free
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="M12 5l7 7-7 7" />
              </svg>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ─── Footer ─────────────────────────────────────── */}
      <footer className="relative border-t border-white/[0.04] py-8 px-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-white/20">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            KeyVault
          </div>
          <div className="flex items-center gap-6 text-xs text-white/20">
            <Link href="/docs" className="transition-colors hover:text-white/40">Docs</Link>
            <Link href="/login" className="transition-colors hover:text-white/40">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
