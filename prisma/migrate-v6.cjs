// Migration v6 — Add DLL payload storage to projects
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const statements = [
  // ── DLL payload columns on projects ────────────────────
  `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "dllData" TEXT`,
  `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "dllHash" TEXT`,
  `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "dllUploadedAt" TIMESTAMP(3)`,
];

async function main() {
  console.log('Migration v6: Adding DLL payload storage to projects...');

  let ok = 0, skip = 0, fail = 0;

  for (const stmt of statements) {
    const label = stmt.replace(/\s+/g, ' ').substring(0, 80);
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
        console.error('  ! FAILED: ' + label);
        console.error('    ' + msg);
        fail++;
      }
    } finally {
      await prisma.$disconnect();
    }
    await sleep(300);
  }

  console.log(`\nDone: ${ok} applied, ${skip} skipped, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error('Migration v6 fatal error:', e);
  process.exit(1);
});
