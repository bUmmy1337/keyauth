// Manual migration — CommonJS version
// Workaround for Prisma Schema Engine not supporting Neon's channel_binding
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

const statements = [
  // Enums
  `CREATE TYPE "Role" AS ENUM ('ADMIN', 'VIEWER')`,
  `CREATE TYPE "Plan" AS ENUM ('DAILY', 'WEEKLY', 'LIFETIME')`,
  `CREATE TYPE "KeyStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'BANNED', 'REVOKED')`,
  
  // Users table
  `CREATE TABLE IF NOT EXISTS "users" ("id" TEXT NOT NULL, "email" TEXT NOT NULL, "password" TEXT NOT NULL, "role" "Role" NOT NULL DEFAULT 'ADMIN', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "users_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email")`,

  // Keys table
  `CREATE TABLE IF NOT EXISTS "keys" ("id" TEXT NOT NULL, "key" TEXT NOT NULL, "mask" TEXT NOT NULL, "plan" "Plan" NOT NULL DEFAULT 'DAILY', "status" "KeyStatus" NOT NULL DEFAULT 'ACTIVE', "hwid" TEXT, "hwidLocked" BOOLEAN NOT NULL DEFAULT false, "maxSessions" INTEGER NOT NULL DEFAULT 1, "activeSessions" INTEGER NOT NULL DEFAULT 0, "serverVar" TEXT, "serverNonce" TEXT, "expiresAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, "createdById" TEXT NOT NULL, CONSTRAINT "keys_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "keys_key_key" ON "keys"("key")`,
  `CREATE INDEX IF NOT EXISTS "keys_key_idx" ON "keys"("key")`,
  `CREATE INDEX IF NOT EXISTS "keys_hwid_idx" ON "keys"("hwid")`,
  `CREATE INDEX IF NOT EXISTS "keys_status_expiresAt_idx" ON "keys"("status", "expiresAt")`,

  // Logs table  
  `CREATE TABLE IF NOT EXISTS "logs" ("id" TEXT NOT NULL, "action" TEXT NOT NULL, "ip" TEXT, "userAgent" TEXT, "hwid" TEXT, "payload" TEXT, "success" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "userId" TEXT, "keyId" TEXT, CONSTRAINT "logs_pkey" PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "logs_action_createdAt_idx" ON "logs"("action", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "logs_keyId_idx" ON "logs"("keyId")`,

  // Rate limits table
  `CREATE TABLE IF NOT EXISTS "rate_limits" ("id" TEXT NOT NULL, "identifier" TEXT NOT NULL, "tokens" INTEGER NOT NULL DEFAULT 10, "lastRefill" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "rate_limits_identifier_key" ON "rate_limits"("identifier")`,
  `CREATE INDEX IF NOT EXISTS "rate_limits_identifier_idx" ON "rate_limits"("identifier")`,

  // Foreign keys
  `ALTER TABLE "keys" ADD CONSTRAINT "keys_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "logs" ADD CONSTRAINT "logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
  `ALTER TABLE "logs" ADD CONSTRAINT "logs_keyId_fkey" FOREIGN KEY ("keyId") REFERENCES "keys"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
];

async function main() {
  console.log('Connecting to Neon...');
  await prisma.$connect();
  console.log('Connected!\n');

  let ok = 0, skip = 0, fail = 0;

  for (const stmt of statements) {
    const m = stmt.match(/"(\w+)"/);
    const label = m ? m[1] : stmt.substring(0, 30);
    try {
      await prisma.$executeRawUnsafe(stmt);
      console.log('  + ' + label);
      ok++;
    } catch (e) {
      if (e.message && e.message.includes('already exists')) {
        console.log('  ~ ' + label + ' (exists)');
        skip++;
      } else {
        console.log('  x ' + label + ': ' + (e.meta?.message || e.message || '').substring(0, 100));
        fail++;
      }
    }
  }

  console.log('\nDone: ' + ok + ' created, ' + skip + ' existed, ' + fail + ' failed');
}

main()
  .catch(e => { console.error('Fatal:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
