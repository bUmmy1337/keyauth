// Migration v2 — Add MONTHLY/CUSTOM plans, customDays, note columns
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

const statements = [
  // Add new enum values to Plan
  `ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'MONTHLY'`,
  `ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'CUSTOM'`,

  // Add new columns to keys table
  `ALTER TABLE "keys" ADD COLUMN IF NOT EXISTS "customDays" INTEGER`,
  `ALTER TABLE "keys" ADD COLUMN IF NOT EXISTS "note" TEXT`,
];

async function main() {
  console.log('Migration v2: Adding MONTHLY/CUSTOM plans + new columns...');
  await prisma.$connect();
  console.log('Connected!\n');

  let ok = 0, skip = 0, fail = 0;

  for (const stmt of statements) {
    const label = stmt.substring(0, 60);
    try {
      await prisma.$executeRawUnsafe(stmt);
      console.log('  + ' + label);
      ok++;
    } catch (e) {
      if (e.message && e.message.includes('already exists')) {
        console.log('  ~ ' + label + ' (exists)');
        skip++;
      } else {
        console.log('  x ' + label + ': ' + (e.meta?.message || e.message || '').substring(0, 120));
        fail++;
      }
    }
  }

  console.log('\nDone: ' + ok + ' applied, ' + skip + ' existed, ' + fail + ' failed');
}

main()
  .catch(e => { console.error('Fatal:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
