"use client";

// ─────────────────────────────────────────────────────────
// API Documentation Page — Public-facing docs with
// code examples for Python, Node.js, C#, Telegram Bot
// ─────────────────────────────────────────────────────────

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

// ─── Code block component ────────────────────────────────
function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="group relative mt-3 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
      <div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-2">
        <span className="text-[10px] font-medium uppercase tracking-widest text-white/20">
          {lang}
        </span>
        <button
          onClick={copy}
          className="rounded-lg px-2.5 py-1 text-[10px] font-medium text-white/30 transition-all hover:bg-white/[0.06] hover:text-white/60"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed">
        <code className="text-white/60">{code}</code>
      </pre>
    </div>
  );
}

// ─── Section / Card ───────────────────────────────────────
function DocSection({
  id,
  title,
  description,
  children,
  delay = 0,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="scroll-mt-24"
    >
      <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-xl md:p-8">
        <h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2>
        {description && (
          <p className="mt-2 text-sm leading-relaxed text-white/40">{description}</p>
        )}
        <div className="mt-6">{children}</div>
      </div>
    </motion.section>
  );
}

// ─── Endpoint card ───────────────────────────────────────
function Endpoint({
  method,
  path,
  description,
  body,
  response,
}: {
  method: string;
  path: string;
  description: string;
  body?: string;
  response?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-5">
      <div className="flex items-center gap-3">
        <span
          className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
            method === "POST"
              ? "bg-emerald-400/10 text-emerald-400/80"
              : method === "GET"
              ? "bg-blue-400/10 text-blue-400/80"
              : method === "PATCH"
              ? "bg-amber-400/10 text-amber-400/80"
              : "bg-red-400/10 text-red-400/80"
          }`}
        >
          {method}
        </span>
        <code className="text-sm font-medium text-white/70">{path}</code>
      </div>
      <p className="mt-2 text-sm text-white/40">{description}</p>
      {body && (
        <div className="mt-3">
          <span className="text-[10px] font-medium uppercase tracking-widest text-white/20">
            Request Body
          </span>
          <CodeBlock code={body} lang="json" />
        </div>
      )}
      {response && (
        <div className="mt-3">
          <span className="text-[10px] font-medium uppercase tracking-widest text-white/20">
            Response
          </span>
          <CodeBlock code={response} lang="json" />
        </div>
      )}
    </div>
  );
}

// ─── Tab switcher ─────────────────────────────────────────
function TabSwitcher({
  tabs,
  children,
}: {
  tabs: string[];
  children: (active: string) => React.ReactNode;
}) {
  const [active, setActive] = useState(tabs[0]);

  return (
    <div>
      <div className="flex gap-1 rounded-2xl border border-white/[0.04] bg-white/[0.02] p-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`relative rounded-xl px-4 py-2 text-xs font-medium transition-all duration-300 ${
              active === tab
                ? "bg-white/[0.08] text-white"
                : "text-white/30 hover:text-white/50"
            }`}
          >
            {active === tab && (
              <motion.div
                layoutId="doc-tab"
                className="absolute inset-0 rounded-xl bg-white/[0.06] border border-white/[0.08]"
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              />
            )}
            <span className="relative z-10">{tab}</span>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="mt-4"
        >
          {children(active)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── TOC menu items ───────────────────────────────────────
const tocItems = [
  { id: "overview", label: "Overview" },
  { id: "auth", label: "Authentication" },
  { id: "projects", label: "Projects" },
  { id: "portal", label: "User Portal" },
  { id: "endpoints", label: "API Endpoints" },
  { id: "validate", label: "License Validation" },
  { id: "telegram", label: "Telegram Bot" },
  { id: "examples", label: "Code Examples" },
  { id: "plans", label: "License Plans" },
  { id: "errors", label: "Error Codes" },
];

// ─── Code examples ────────────────────────────────────────
const EXAMPLES = {
  python_validate: `import requests
import hashlib
import subprocess

API_URL = "https://your-domain.vercel.app/api/validate"

def get_hwid():
    """Get a hardware fingerprint (motherboard UUID + disk serial)."""
    try:
        uuid = subprocess.check_output(
            "wmic csproduct get uuid", shell=True
        ).decode().split("\\n")[1].strip()
        disk = subprocess.check_output(
            "wmic diskdrive get serialnumber", shell=True
        ).decode().split("\\n")[1].strip()
        raw = f"{uuid}:{disk}"
        return hashlib.sha256(raw.encode()).hexdigest()
    except Exception:
        return hashlib.sha256(b"fallback-hwid").hexdigest()

PROJECT_SECRET = "kv_your_project_secret"  # from dashboard

def validate_license(key: str) -> dict:
    """Validate a license key against the KeyVault API."""
    response = requests.post(API_URL, json={
        "key": key,
        "hwid": get_hwid(),
        "secret": PROJECT_SECRET,  # scopes to your project
    }, timeout=10)

    data = response.json()

    if data.get("success"):
        print(f"✅ License valid! Plan: {data['data']['plan']}")
        print(f"   Expires: {data['data']['expiresAt'] or 'Never'}")
        print(f"   Note: {data['data'].get('note', 'N/A')}")
        print(f"   Server Nonce: {data['data']['nonce']}")
        return data["data"]
    else:
        print(f"❌ Validation failed: {data.get('error')}")
        return None

# Usage
result = validate_license("XXXX-XXXX-XXXX-XXXX")
if result:
    # Continue application execution with server variable
    server_var = result.get("serverVar")
    note = result.get("note")`,

  nodejs_validate: `const crypto = require("crypto");
const { execSync } = require("child_process");

const API_URL = "https://your-domain.vercel.app/api/validate";

function getHWID() {
  try {
    const uuid = execSync("wmic csproduct get uuid")
      .toString().split("\\n")[1].trim();
    const disk = execSync("wmic diskdrive get serialnumber")
      .toString().split("\\n")[1].trim();
    return crypto.createHash("sha256")
      .update(\`\${uuid}:\${disk}\`).digest("hex");
  } catch {
    return crypto.createHash("sha256")
      .update("fallback-hwid").digest("hex");
  }
}

const PROJECT_SECRET = "kv_your_project_secret"; // from dashboard

async function validateLicense(key) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, hwid: getHWID(), secret: PROJECT_SECRET }),
  });

  const data = await res.json();

  if (data.success) {
    console.log("✅ License valid!", data.data.plan);
    console.log("   Expires:", data.data.expiresAt || "Never");
    return data.data;
  } else {
    console.log("❌ Failed:", data.error);
    return null;
  }
}

// Usage
validateLicense("XXXX-XXXX-XXXX-XXXX")
  .then((result) => {
    if (result) {
      // Application is authorized
      console.log("Server nonce:", result.nonce);
    } else {
      process.exit(1);
    }
  });`,

  csharp_validate: `using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Management;
using System.Security.Cryptography;

public class KeyVaultClient
{
    private const string API_URL = "https://your-domain.vercel.app/api/validate";
    private readonly HttpClient _http = new();

    public static string GetHWID()
    {
        string uuid = "", disk = "";
        using (var searcher = new ManagementObjectSearcher(
            "SELECT UUID FROM Win32_ComputerSystemProduct"))
        {
            foreach (var obj in searcher.Get())
                uuid = obj["UUID"]?.ToString() ?? "";
        }
        using (var searcher = new ManagementObjectSearcher(
            "SELECT SerialNumber FROM Win32_DiskDrive"))
        {
            foreach (var obj in searcher.Get())
            { disk = obj["SerialNumber"]?.ToString() ?? ""; break; }
        }
        var raw = Encoding.UTF8.GetBytes($"{uuid}:{disk}");
        var hash = SHA256.HashData(raw);
        return Convert.ToHexString(hash).ToLower();
    }

    public async Task<JsonElement?> ValidateAsync(string key)
    {
        var body = JsonSerializer.Serialize(new { key, hwid = GetHWID(), secret = "kv_your_project_secret" });
        var content = new StringContent(body, Encoding.UTF8, "application/json");

        var res = await _http.PostAsync(API_URL, content);
        var json = await res.Content.ReadAsStringAsync();
        var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        if (root.GetProperty("success").GetBoolean())
        {
            Console.WriteLine($"✅ Valid! Plan: {root.GetProperty("data")
                .GetProperty("plan")}");
            return root.GetProperty("data");
        }
        else
        {
            Console.WriteLine($"❌ {root.GetProperty("error")}");
            return null;
        }
    }
}

// Usage:
// var client = new KeyVaultClient();
// var result = await client.ValidateAsync("XXXX-XXXX-XXXX-XXXX");`,

  telegram_bot_python: `import logging
import requests
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

API_URL = "https://your-domain.vercel.app/api/telegram"
BOT_TOKEN = "YOUR_BOT_TOKEN"

logging.basicConfig(level=logging.INFO)

# ─── Helper: call the Telegram API ────────────────────────
PROJECT_SECRET = "kv_your_project_secret"  # from dashboard

def call_api(action: str, key: str, hwid: str = None, tg_id: str = None, tg_user: str = None):
    payload = {"action": action, "key": key, "secret": PROJECT_SECRET}
    if hwid:
        payload["hwid"] = hwid
    if tg_id:
        payload["telegram_id"] = tg_id
    if tg_user:
        payload["telegram_username"] = tg_user
    return requests.post(API_URL, json=payload, timeout=10).json()

# ─── /start ───────────────────────────────────────────────
async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🔐 *KeyVault License Bot*\\n\\n"
        "Commands:\\n"
        "/validate <key> <hwid> — Validate license + bind PC\\n"
        "/check <key> — Check license info\\n"
        "/reset <key> — Remove HWID binding",
        parse_mode="Markdown",
    )

# ─── /validate <key> <hwid> ───────────────────────────────
# The user sends their PC HWID along with the license key.
# The bot forwards both to the API for validation.
async def validate(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if len(ctx.args) < 2:
        await update.message.reply_text("Usage: /validate <license-key> <hwid>")
        return

    key, hwid = ctx.args[0], ctx.args[1]
    tg_id = str(update.effective_user.id)
    tg_user = update.effective_user.username or ""

    res = call_api("validate", key, hwid=hwid, tg_id=tg_id, tg_user=tg_user)

    if res.get("success"):
        d = res["data"]
        await update.message.reply_text(
            f"✅ *License Valid!*\\n\\n"
            f"Plan: {d['plan']}\\n"
            f"Expires: {d.get('expires_at') or 'Never'}\\n"
            f"Nonce: {d.get('nonce', 'N/A')}",
            parse_mode="Markdown",
        )
    else:
        await update.message.reply_text(f"❌ {res.get('error')}")

# ─── /check <key> ─────────────────────────────────────────
async def check(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args:
        await update.message.reply_text("Usage: /check <license-key>")
        return

    key = ctx.args[0]
    tg_id = str(update.effective_user.id)

    res = call_api("info", key, tg_id=tg_id)

    if res.get("success"):
        d = res["data"]
        status = "✅ Active" if d["valid"] else "❌ Inactive"
        await update.message.reply_text(
            f"🔑 *License Info*\\n\\n"
            f"Status: {status}\\n"
            f"Plan: {d['plan']}\\n"
            f"Sessions: {d['sessions']}\\n"
            f"HWID Locked: {'Yes' if d['hwid_locked'] else 'No'}\\n"
            f"Expires: {d.get('expires_at') or 'Never'}",
            parse_mode="Markdown",
        )
    else:
        await update.message.reply_text(f"❌ {res.get('error')}")

# ─── /reset <key> ─────────────────────────────────────────
async def reset(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args:
        await update.message.reply_text("Usage: /reset <license-key>")
        return

    key = ctx.args[0]
    tg_id = str(update.effective_user.id)

    res = call_api("reset_hwid", key, tg_id=tg_id)

    if res.get("success"):
        await update.message.reply_text("✅ HWID binding removed. Key can be used on a new PC.")
    else:
        await update.message.reply_text(f"❌ {res.get('error')}")

# ─── Main ─────────────────────────────────────────────────
def main():
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("validate", validate))
    app.add_handler(CommandHandler("check", check))
    app.add_handler(CommandHandler("reset", reset))
    print("🤖 Bot running...")
    app.run_polling()

if __name__ == "__main__":
    main()`,

  telegram_bot_nodejs: `const { Telegraf } = require("telegraf");

const API_URL = "https://your-domain.vercel.app/api/telegram";
const BOT_TOKEN = "YOUR_BOT_TOKEN";

const bot = new Telegraf(BOT_TOKEN);

const PROJECT_SECRET = "kv_your_project_secret"; // from dashboard

async function callAPI(action, key, { hwid, telegramId, username } = {}) {
  const body = { action, key, secret: PROJECT_SECRET };
  if (hwid) body.hwid = hwid;
  if (telegramId) body.telegram_id = String(telegramId);
  if (username) body.telegram_username = username;
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

// /start
bot.start((ctx) =>
  ctx.replyWithMarkdown(
    "🔐 *KeyVault License Bot*\\n\\n" +
    "/validate <key> <hwid> — Validate license + bind PC\\n" +
    "/check <key> — Check license info\\n" +
    "/reset <key> — Remove HWID binding"
  )
);

// /validate <key> <hwid>
bot.command("validate", async (ctx) => {
  const parts = ctx.message.text.split(" ");
  const key = parts[1], hwid = parts[2];
  if (!key || !hwid) return ctx.reply("Usage: /validate <key> <hwid>");

  const res = await callAPI("validate", key, {
    hwid, telegramId: ctx.from.id, username: ctx.from.username
  });
  if (res.success) {
    const d = res.data;
    ctx.replyWithMarkdown(
      \`✅ *License Valid!*\\n\\nPlan: \${d.plan}\\nExpires: \${d.expires_at || "Never"}\\nNonce: \${d.nonce || "N/A"}\`
    );
  } else {
    ctx.reply(\`❌ \${res.error}\`);
  }
});

// /check <key>
bot.command("check", async (ctx) => {
  const key = ctx.message.text.split(" ")[1];
  if (!key) return ctx.reply("Usage: /check <license-key>");

  const res = await callAPI("info", key, { telegramId: ctx.from.id });
  if (res.success) {
    const d = res.data;
    const status = d.valid ? "✅ Active" : "❌ Inactive";
    ctx.replyWithMarkdown(
      \`🔑 *License Info*\\n\\nStatus: \${status}\\nPlan: \${d.plan}\\n\` +
      \`Sessions: \${d.sessions}\\nHWID Locked: \${d.hwid_locked ? "Yes" : "No"}\\n\` +
      \`Expires: \${d.expires_at || "Never"}\`
    );
  } else {
    ctx.reply(\`❌ \${res.error}\`);
  }
});

// /reset <key>
bot.command("reset", async (ctx) => {
  const key = ctx.message.text.split(" ")[1];
  if (!key) return ctx.reply("Usage: /reset <license-key>");

  const res = await callAPI("reset_hwid", key, { telegramId: ctx.from.id });
  ctx.reply(res.success ? "✅ HWID binding removed." : \`❌ \${res.error}\`);
});

bot.launch().then(() => console.log("🤖 Bot running..."));
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));`,
};

// ─── Main Page ────────────────────────────────────────────
export default function DocsPage() {
  return (
    <div className="relative min-h-screen bg-black">
      <div className="bg-ambient" />

      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.04] bg-black/60 backdrop-blur-2xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5 text-white/80 hover:text-white transition-colors">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/[0.08]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-tight">KeyVault Docs</span>
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl bg-white/[0.06] px-4 py-1.5 text-xs font-medium text-white/60 transition-all hover:bg-white/[0.10] hover:text-white border border-white/[0.06]"
          >
            Dashboard →
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-6 pt-24 pb-20 lg:grid-cols-[200px_1fr]">
        {/* Sidebar TOC */}
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1">
            {tocItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="block rounded-xl px-3 py-2 text-xs font-medium text-white/30 transition-colors hover:bg-white/[0.03] hover:text-white/60"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="space-y-8">
          {/* ─── Overview ────────────────────────────────── */}
          <DocSection
            id="overview"
            title="Overview"
            description="KeyVault is a high-security license management system with hardware ID locking, encrypted validation, and full audit logging. It provides a RESTful API for managing and validating license keys."
            delay={0.05}
          >
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                { title: "Project Isolation", desc: "Separate keys by project with unique API secrets" },
                { title: "HWID Locking", desc: "Bind keys to PC hardware IDs" },
                { title: "AES-256-GCM", desc: "End-to-end encryption for all payloads" },
                { title: "Anti-Replay", desc: "Server-side nonce rotation per validation" },
                { title: "Rate Limiting", desc: "Per-IP and per-key request throttling" },
                { title: "Audit Logs", desc: "Every action is logged with IP and HWID" },
                { title: "Telegram Bot", desc: "Native API for Telegram bot integration" },
                { title: "User Portal", desc: "Per-project user dashboards with customizable blocks" },
                { title: "Portal Editor", desc: "Drag-and-drop dashboard builder for each project" },
                { title: "No-Key Flow", desc: "Users can register without a key, add one later" },
                { title: "HWID Gating", desc: "Restrict features until HWID is bound in loader" },
                { title: "Admin Panel", desc: "Full admin view of all users, projects, and keys" },
              ].map((f) => (
                <div key={f.title} className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-4">
                  <p className="text-xs font-semibold text-white/70">{f.title}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/30">{f.desc}</p>
                </div>
              ))}
            </div>
          </DocSection>

          {/* ─── Authentication ──────────────────────────── */}
          <DocSection
            id="auth"
            title="Authentication"
            description="Admin endpoints require a Bearer token obtained via the login endpoint. Public endpoints (validate, telegram, portal) don't require admin authentication. Self-registration is disabled — only the first user (setup) and admin-created users are allowed."
            delay={0.1}
          >
            <Endpoint
              method="POST"
              path="/api/auth/login"
              description="Authenticate and receive a JWT token stored as an HTTP-only cookie."
              body={`{
  "email": "admin@keyvault.io",
  "password": "your-password"
}`}
              response={`{
  "success": true,
  "data": {
    "user": { "id": "...", "email": "admin@keyvault.io", "role": "ADMIN" },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}`}
            />
            <div className="mt-4 rounded-2xl border border-amber-400/10 bg-amber-400/[0.03] p-4">
              <p className="text-xs font-medium text-amber-400/60">
                💡 For programmatic access, use the <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-white/50">Authorization: Bearer &lt;token&gt;</code> header.
              </p>
            </div>
          </DocSection>

          {/* ─── Projects ────────────────────────────────── */}
          <DocSection
            id="projects"
            title="Projects"
            description="Projects let you organize license keys into separate namespaces. Each project gets a unique API secret (kv_...) that clients use during validation to scope keys to a specific project."
            delay={0.12}
          >
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-5">
                <h4 className="text-xs font-semibold text-white/60">How It Works</h4>
                <ol className="mt-2 space-y-2 text-[11px] leading-relaxed text-white/30">
                  <li><span className="text-white/50 font-medium">1.</span> Create a project in the dashboard — a unique <code className="rounded bg-white/[0.06] px-1 py-0.5 text-white/40">kv_</code> secret is generated automatically</li>
                  <li><span className="text-white/50 font-medium">2.</span> Assign keys to the project when generating them</li>
                  <li><span className="text-white/50 font-medium">3.</span> In your client app, include the project&apos;s <code className="rounded bg-white/[0.06] px-1 py-0.5 text-white/40">secret</code> field in validate/heartbeat/telegram requests</li>
                  <li><span className="text-white/50 font-medium">4.</span> The API will only match keys belonging to that project</li>
                </ol>
              </div>
              <div className="rounded-2xl border border-amber-400/10 bg-amber-400/[0.03] p-4">
                <p className="text-xs font-medium text-amber-400/60">
                  💡 The <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-white/50">secret</code> field is optional. If omitted, validation searches across all keys regardless of project.
                </p>
              </div>
            </div>
          </DocSection>

          {/* ─── User Portal ────────────────────────────── */}
          <DocSection
            id="portal"
            title="User Portal"
            description="Each project gets a public-facing user portal at /p/[slug]. End-users can register, activate license keys, download the loader, and view their account status — all configurable via the Portal Dashboard Editor."
            delay={0.13}
          >
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-5">
                <h4 className="text-xs font-semibold text-white/60">User Flow</h4>
                <ol className="mt-2 space-y-2 text-[11px] leading-relaxed text-white/30">
                  <li><span className="text-white/50 font-medium">1.</span> User visits <code className="rounded bg-white/[0.06] px-1 py-0.5 text-white/40">/p/your-project-slug</code></li>
                  <li><span className="text-white/50 font-medium">2.</span> Creates an account (no key required) or signs in</li>
                  <li><span className="text-white/50 font-medium">3.</span> Enters license key to activate it on their account</li>
                  <li><span className="text-white/50 font-medium">4.</span> Downloads the loader and binds HWID</li>
                  <li><span className="text-white/50 font-medium">5.</span> Full access granted after HWID binding</li>
                </ol>
              </div>
              <div className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-5">
                <h4 className="text-xs font-semibold text-white/60">Access Levels</h4>
                <div className="mt-2 space-y-2 text-[11px] leading-relaxed text-white/30">
                  <div className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-red-400/60" /><span><strong className="text-white/40">No key:</strong> Limited view, can only activate a key</span></div>
                  <div className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-amber-400/60" /><span><strong className="text-white/40">Key activated, no HWID:</strong> Key info visible, loader download prompt</span></div>
                  <div className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-emerald-400/60" /><span><strong className="text-white/40">Full access (HWID bound):</strong> All features unlocked</span></div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-5">
                <h4 className="text-xs font-semibold text-white/60">Portal Dashboard Editor</h4>
                <p className="mt-2 text-[11px] leading-relaxed text-white/30">
                  In project settings, use the Portal Dashboard Editor to customize which blocks appear on the user portal. Available blocks:
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {[
                    { block: "key_info", desc: "License status, plan, expiry, sessions" },
                    { block: "copy_key", desc: "Button to copy the license key mask" },
                    { block: "download_loader", desc: "Loader download with HWID gating" },
                    { block: "hwid_status", desc: "HWID binding status indicator" },
                    { block: "custom_button", desc: "External link (Discord, website, etc.)" },
                    { block: "custom_text", desc: "Custom paragraph of text" },
                  ].map((b) => (
                    <div key={b.block} className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-3">
                      <code className="text-xs font-medium text-emerald-400/60">{b.block}</code>
                      <p className="mt-1 text-[11px] text-white/30">{b.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
              <Endpoint
                method="POST"
                path="/api/portal/register"
                description="Register a portal user (no key required)"
                body={`{
  "username": "player123",
  "password": "securepass",
  "projectId": "clxxx..."
}`}
                response={`{
  "success": true,
  "data": {
    "token": "eyJ...",
    "user": { "id": "...", "username": "player123", "projectId": "...", "keyId": null }
  }
}`}
              />
              <Endpoint
                method="POST"
                path="/api/portal/login"
                description="Login as a portal user"
                body={`{
  "username": "player123",
  "password": "securepass",
  "projectId": "clxxx..."
}`}
              />
              <Endpoint
                method="GET"
                path="/api/portal/me"
                description="Get portal user info, key data, access level, and project dashboard config. Requires portal_token cookie or Bearer token."
                response={`{
  "success": true,
  "data": {
    "user": { "id": "...", "username": "player123" },
    "key": { "mask": "A1B2-****-****-G7H8", "plan": "MONTHLY", "status": "ACTIVE", "hwidLocked": true },
    "access": {
      "hasKey": true,
      "keyActive": true,
      "hwidBound": true,
      "fullAccess": true,
      "canDownloadLoader": true,
      "loaderUrl": "https://..."
    }
  }
}`}
              />
              <Endpoint
                method="POST"
                path="/api/portal/activate"
                description="Activate a license key on portal user account. Requires portal auth."
                body={`{
  "key": "A1B2-C3D4-E5F6-G7H8"
}`}
                response={`{
  "success": true,
  "data": {
    "message": "Key activated successfully!",
    "key": { "mask": "A1B2-****-****-G7H8", "plan": "WEEKLY", "status": "ACTIVE" },
    "needsHwidBinding": true
  }
}`}
              />
              <Endpoint
                method="GET"
                path="/api/portal/info?slug=my-project"
                description="Get public project info for portal page (no auth required)"
              />
              <Endpoint method="POST" path="/api/portal/logout" description="Clear portal auth cookie" />
            </div>
          </DocSection>

          {/* ─── API Endpoints ───────────────────────────── */}
          <DocSection
            id="endpoints"
            title="API Endpoints"
            description="Complete list of available API endpoints."
            delay={0.15}
          >
            <div className="space-y-4">
              <Endpoint method="POST" path="/api/auth/login" description="Login and get JWT token" />
              <Endpoint method="POST" path="/api/auth/register" description="Register a new admin (first-use setup or admin-only)" />
              <Endpoint method="POST" path="/api/auth/logout" description="Clear auth cookie" />
              <Endpoint method="GET" path="/api/auth/me" description="Get current user info" />
              <Endpoint method="GET" path="/api/keys?projectId=xxx" description="List all license keys (paginated, optional project filter)" />
              <Endpoint
                method="POST"
                path="/api/keys"
                description="Generate new license keys"
                body={`{
  "plan": "WEEKLY",       // DAILY | WEEKLY | MONTHLY | LIFETIME | CUSTOM
  "count": 5,             // 1-50 keys at once
  "maxSessions": 1,       // Max concurrent sessions
  "customDays": 90,       // Required if plan is CUSTOM (1-3650)
  "note": "VIP client",   // Optional admin note
  "projectId": "clxxx..." // Optional project ID
}`}
              />
              <Endpoint method="GET" path="/api/keys/:id" description="Get key details with recent logs" />
              <Endpoint
                method="PATCH"
                path="/api/keys/:id"
                description="Update key status, reset HWID, change sessions"
                body={`{
  "status": "BANNED",     // ACTIVE | EXPIRED | BANNED | REVOKED
  "resetHwid": true,      // Reset hardware ID lock
  "maxSessions": 3        // Update max sessions
}`}
              />
              <Endpoint method="DELETE" path="/api/keys/:id" description="Revoke a license key" />
              <Endpoint method="GET" path="/api/logs" description="View audit logs (paginated)" />
              <Endpoint method="GET" path="/api/stats" description="Dashboard statistics" />
              <Endpoint method="GET" path="/api/projects" description="List user's projects" />
              <Endpoint
                method="POST"
                path="/api/projects"
                description="Create a new project (auto-generates API secret)"
                body={`{
  "name": "My Game",
  "description": "Game license management"
}`}
              />
              <Endpoint method="GET" path="/api/projects/:id" description="Get project details with key count" />
              <Endpoint
                method="PATCH"
                path="/api/projects/:id"
                description="Update project or regenerate secret"
                body={`{
  "name": "New Name",
  "description": "Updated description",
  "regenerateSecret": true  // optional: generates new kv_ secret
}`}
              />
              <Endpoint method="DELETE" path="/api/projects/:id" description="Delete project and all its keys" />
              <Endpoint method="GET" path="/api/heartbeat" description="Health check endpoint" />
              <Endpoint method="GET" path="/api/admin" description="Admin only: list all users, projects, and keys" />
              <Endpoint method="GET" path="/api/portal/info?slug=xxx" description="Public project info for portal page" />
              <Endpoint method="POST" path="/api/portal/register" description="Register a portal user (no key required)" />
              <Endpoint method="POST" path="/api/portal/login" description="Login as a portal user" />
              <Endpoint method="GET" path="/api/portal/me" description="Get portal user info, key status, and access level" />
              <Endpoint method="POST" path="/api/portal/activate" description="Activate a license key on portal user account" />
              <Endpoint method="POST" path="/api/portal/logout" description="Clear portal auth cookie" />
            </div>
          </DocSection>

          {/* ─── License Validation ──────────────────────── */}
          <DocSection
            id="validate"
            title="License Validation"
            description="The core endpoint for validating license keys from your application. No auth required — just send the key and hardware ID."
            delay={0.2}
          >
            <Endpoint
              method="POST"
              path="/api/validate"
              description="Validate a license key and receive server-side variables. HWID is locked on first use."
              body={`{
  "key": "A1B2-C3D4-E5F6-G7H8",
  "hwid": "sha256-hash-of-hardware-id",
  "secret": "kv_abc123..."     // Project secret (optional, scopes to project)
}`}
              response={`{
  "success": true,
  "data": {
    "valid": true,
    "plan": "WEEKLY",
    "expiresAt": "2026-03-07T12:00:00.000Z",
    "note": "VIP client",
    "serverVar": "encrypted-server-variable",
    "nonce": "one-time-nonce-rotated-per-call",
    "sessionId": "uuid-v4"
  }
}`}
            />
            <div className="mt-4 rounded-2xl border border-white/[0.04] bg-white/[0.015] p-5">
              <h4 className="text-xs font-semibold text-white/60">HWID Generation Guide</h4>
              <p className="mt-2 text-[11px] leading-relaxed text-white/30">
                Generate a hardware fingerprint by combining stable system identifiers.
                Recommended: <code className="rounded bg-white/[0.06] px-1 py-0.5 text-white/40">SHA256(MotherboardUUID + &quot;:&quot; + DiskSerial)</code>.
                For Telegram bots, use the user&apos;s Telegram ID via the <code className="rounded bg-white/[0.06] px-1 py-0.5 text-white/40">/api/telegram</code> endpoint instead.
              </p>
            </div>
          </DocSection>

          {/* ─── Telegram Bot ────────────────────────────── */}
          <DocSection
            id="telegram"
            title="Telegram Bot Integration"
            description="A dedicated API endpoint for Telegram bots. The PC HWID is passed from the client — the bot simply forwards the key + HWID to the API and returns the result."
            delay={0.25}
          >
            <Endpoint
              method="POST"
              path="/api/telegram"
              description="Telegram bot actions: validate, info, reset_hwid"
              body={`{
  "action": "validate",          // validate | info | reset_hwid
  "key": "A1B2-C3D4-E5F6-G7H8",
  "hwid": "ABC123-PC-HARDWARE-ID",  // Real PC HWID from client
  "secret": "kv_abc123...",         // Project secret (scopes to project)
  "telegram_id": "123456789",       // Optional, for audit logs
  "telegram_username": "johndoe"    // Optional, for audit logs
}`}
              response={`{
  "success": true,
  "data": {
    "valid": true,
    "plan": "MONTHLY",
    "customDays": null,
    "expires_at": "2026-03-30T12:00:00.000Z",
    "nonce": "rotated-nonce",
    "note": null
  }
}`}
            />

            <div className="mt-6 space-y-3">
              <h4 className="text-xs font-semibold text-white/60">Available Actions</h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { action: "validate", desc: "Check key + PC HWID. Binds HWID on first use, returns nonce." },
                  { action: "info", desc: "Get full key info (read-only). HWID optional for match check." },
                  { action: "reset_hwid", desc: "Remove HWID binding so the key can be activated on a new machine." },
                ].map((a) => (
                  <div key={a.action} className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-3">
                    <code className="text-xs font-medium text-emerald-400/60">{a.action}</code>
                    <p className="mt-1 text-[11px] text-white/30">{a.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </DocSection>

          {/* ─── Code Examples ────────────────────────────── */}
          <DocSection
            id="examples"
            title="Code Examples"
            description="Copy-paste ready examples for integrating KeyVault into your application."
            delay={0.3}
          >
            <TabSwitcher tabs={["Python", "Node.js", "C#", "Telegram (Python)", "Telegram (Node.js)"]}>
              {(tab) => {
                const map: Record<string, { code: string; lang: string }> = {
                  Python: { code: EXAMPLES.python_validate, lang: "python" },
                  "Node.js": { code: EXAMPLES.nodejs_validate, lang: "javascript" },
                  "C#": { code: EXAMPLES.csharp_validate, lang: "csharp" },
                  "Telegram (Python)": { code: EXAMPLES.telegram_bot_python, lang: "python" },
                  "Telegram (Node.js)": { code: EXAMPLES.telegram_bot_nodejs, lang: "javascript" },
                };
                const ex = map[tab];
                return <CodeBlock code={ex.code} lang={ex.lang} />;
              }}
            </TabSwitcher>
          </DocSection>

          {/* ─── License Plans ────────────────────────────── */}
          <DocSection
            id="plans"
            title="License Plans"
            description="KeyVault supports flexible licensing with 5 built-in plan types."
            delay={0.35}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left text-xs text-white/30">
                    <th className="pb-3 pr-6 font-medium">Plan</th>
                    <th className="pb-3 pr-6 font-medium">Duration</th>
                    <th className="pb-3 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody className="text-white/50">
                  {[
                    { plan: "DAILY", dur: "24 hours", desc: "Short-term trial or daily access" },
                    { plan: "WEEKLY", dur: "7 days", desc: "Weekly subscription period" },
                    { plan: "MONTHLY", dur: "30 days", desc: "Standard monthly license" },
                    { plan: "LIFETIME", dur: "∞ Never expires", desc: "Permanent access, one-time purchase" },
                    { plan: "CUSTOM", dur: "1–3650 days", desc: "Set any duration via customDays field" },
                  ].map((p) => (
                    <tr key={p.plan} className="border-b border-white/[0.03]">
                      <td className="py-3 pr-6">
                        <code className="rounded-lg bg-white/[0.04] px-2 py-0.5 text-xs text-white/60">
                          {p.plan}
                        </code>
                      </td>
                      <td className="py-3 pr-6 text-xs">{p.dur}</td>
                      <td className="py-3 text-xs text-white/30">{p.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DocSection>

          {/* ─── Error Codes ──────────────────────────────── */}
          <DocSection
            id="errors"
            title="Error Codes"
            description="All API responses follow a consistent format. Errors include an HTTP status code and a message."
            delay={0.4}
          >
            <CodeBlock
              lang="json"
              code={`// Error response format
{
  "success": false,
  "error": "Human-readable error message"
}`}
            />
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left text-xs text-white/30">
                    <th className="pb-3 pr-6 font-medium">Code</th>
                    <th className="pb-3 pr-6 font-medium">Meaning</th>
                    <th className="pb-3 font-medium">Common Causes</th>
                  </tr>
                </thead>
                <tbody className="text-white/50">
                  {[
                    { code: "400", meaning: "Bad Request", cause: "Missing fields, invalid plan, bad payload" },
                    { code: "401", meaning: "Unauthorized", cause: "Invalid or missing auth token, invalid key" },
                    { code: "403", meaning: "Forbidden", cause: "Key expired, HWID mismatch, max sessions, banned" },
                    { code: "404", meaning: "Not Found", cause: "Key doesn't exist" },
                    { code: "415", meaning: "Unsupported Media", cause: "Wrong Content-Type header" },
                    { code: "429", meaning: "Rate Limited", cause: "Too many requests from IP or key" },
                    { code: "500", meaning: "Server Error", cause: "Internal error, contact admin" },
                  ].map((e) => (
                    <tr key={e.code} className="border-b border-white/[0.03]">
                      <td className="py-3 pr-6">
                        <code className="rounded-lg bg-white/[0.04] px-2 py-0.5 text-xs font-medium text-red-400/60">
                          {e.code}
                        </code>
                      </td>
                      <td className="py-3 pr-6 text-xs text-white/60">{e.meaning}</td>
                      <td className="py-3 text-xs text-white/30">{e.cause}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DocSection>
        </div>
      </div>
    </div>
  );
}
