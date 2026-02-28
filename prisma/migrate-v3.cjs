// Migration v3 — Add Projects model, link keys to projects
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

const statements = [
  // Projects table
  `CREATE TABLE IF NOT EXISTS "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "projects_secret_key" ON "projects"("secret")`,
  `CREATE INDEX IF NOT EXISTS "projects_ownerId_idx" ON "projects"("ownerId")`,
  `CREATE INDEX IF NOT EXISTS "projects_secret_idx" ON "projects"("secret")`,

  // Foreign key: projects.ownerId -> users.id
  `ALTER TABLE "projects" ADD CONSTRAINT "projects_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,

  // Add projectId column to keys
  `ALTER TABLE "keys" ADD COLUMN IF NOT EXISTS "projectId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "keys_projectId_idx" ON "keys"("projectId")`,

  // Foreign key: keys.projectId -> projects.id
  `ALTER TABLE "keys" ADD CONSTRAINT "keys_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
];

async function main() {
  console.log('Migration v3: Adding Projects + project-based key isolation...');
  await prisma.$connect();
  console.log('Connected!\n');

  let ok = 0, skip = 0, fail = 0;

  for (const stmt of statements) {
    const label = stmt.replace(/\s+/g, ' ').substring(0, 70);
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
