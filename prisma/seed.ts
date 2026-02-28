// ─────────────────────────────────────────────────────────
// Database Seeder — Creates initial admin user for testing
// Run: npm run db:seed
// ─────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create admin user
  const password = await bcrypt.hash("WzG9kkiQebJu7JF", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@keyvault.io" },
    update: { password },
    create: {
      email: "admin@keyvault.io",
      password,
      role: "ADMIN",
    },
  });

  console.log(`✓ Admin user: ${admin.email} (password updated)`);
  console.log("✓ Seeding complete.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
