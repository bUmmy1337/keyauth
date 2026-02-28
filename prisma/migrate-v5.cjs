// Migration v5 — Add Chat system + Project logo
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const statements = [
  // ── Logo column on projects ────────────────────────────
  `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "logoData" TEXT`,

  // ── Chat messages table (split into separate steps) ────
  `CREATE TABLE IF NOT EXISTS "chat_messages" ("id" TEXT NOT NULL, "text" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "authorId" TEXT NOT NULL, "projectId" TEXT NOT NULL, CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id"))`,

  `CREATE INDEX IF NOT EXISTS "chat_messages_projectId_createdAt_idx" ON "chat_messages"("projectId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "chat_messages_authorId_idx" ON "chat_messages"("authorId")`,

  // Foreign keys for chat_messages
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_messages_authorId_fkey') THEN ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "portal_users"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_messages_projectId_fkey') THEN ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$`,
];

async function main() {
  console.log('Migration v5: Adding Chat system + Project logo...');

  let ok = 0, skip = 0, fail = 0;

  for (const stmt of statements) {
    const label = stmt.replace(/\s+/g, ' ').substring(0, 80);
    // Fresh client per statement to avoid connection-drop issues with poolers
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      await prisma.$executeRawUnsafe(stmt);
      console.log('  + ' + label);
      ok++;
    } catch (e) {
      const msg = e.meta?.message || e.message || '';
      if (msg.includes('already exists')) {
        console.log('  ~ ' + label + ' (exists)');
        skip++;
      } else {
        console.log('  x ' + label + ': ' + msg.substring(0, 120));
        fail++;
      }
    } finally {
      await prisma.$disconnect();
    }
    await sleep(500); // brief pause between statements
  }

  console.log('\nDone: ' + ok + ' applied, ' + skip + ' existed, ' + fail + ' failed');
}

main()
  .catch(e => { console.error('Fatal:', e.message); process.exit(1); });
