// Migration v4 — Add Portal system (PortalUser table + Project portal columns)
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

const statements = [
  // ── New columns on projects table ──────────────────────
  `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "slug" TEXT`,
  `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "portalEnabled" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "loaderUrl" TEXT`,
  `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "requireHwidForDownload" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "dashboardConfig" TEXT`,

  // Back-fill slugs from project name for existing rows (lowercase, alphanumeric + hyphens)
  `UPDATE "projects" SET "slug" = LOWER(REGEXP_REPLACE("name", '[^a-zA-Z0-9]+', '-', 'g')) WHERE "slug" IS NULL`,
  // Append id suffix to guarantee uniqueness after back-fill
  `UPDATE "projects" SET "slug" = "slug" || '-' || LEFT("id", 6) WHERE "slug" IS NOT NULL`,

  // Now make slug NOT NULL + UNIQUE
  `ALTER TABLE "projects" ALTER COLUMN "slug" SET NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "projects_slug_key" ON "projects"("slug")`,
  `CREATE INDEX IF NOT EXISTS "projects_slug_idx" ON "projects"("slug")`,

  // ── Portal users table ─────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "portal_users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,
    "keyId" TEXT,
    CONSTRAINT "portal_users_pkey" PRIMARY KEY ("id")
  )`,

  // Unique: one key can only be linked to one portal user
  `CREATE UNIQUE INDEX IF NOT EXISTS "portal_users_keyId_key" ON "portal_users"("keyId")`,
  // Unique: username must be unique within a project
  `CREATE UNIQUE INDEX IF NOT EXISTS "portal_users_username_projectId_key" ON "portal_users"("username", "projectId")`,
  `CREATE INDEX IF NOT EXISTS "portal_users_projectId_idx" ON "portal_users"("projectId")`,

  // Foreign keys for portal_users
  `ALTER TABLE "portal_users" ADD CONSTRAINT "portal_users_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "portal_users" ADD CONSTRAINT "portal_users_keyId_fkey" FOREIGN KEY ("keyId") REFERENCES "keys"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
];

async function main() {
  console.log('Migration v4: Adding Portal system (PortalUser + Project portal fields)...');
  await prisma.$connect();
  console.log('Connected!\n');

  let ok = 0, skip = 0, fail = 0;

  for (const stmt of statements) {
    const label = stmt.replace(/\s+/g, ' ').substring(0, 80);
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
