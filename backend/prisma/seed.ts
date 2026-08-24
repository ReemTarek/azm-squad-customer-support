import { PrismaClient, Priority } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_SLA_POLICIES: Record<Priority, { responseMinutes: number; resolutionMinutes: number }> = {
  Urgent: { responseMinutes: 30, resolutionMinutes: 4 * 60 },
  High: { responseMinutes: 2 * 60, resolutionMinutes: 8 * 60 },
  Medium: { responseMinutes: 8 * 60, resolutionMinutes: 24 * 60 },
  Low: { responseMinutes: 24 * 60, resolutionMinutes: 72 * 60 },
};

async function seedAdmin() {
  const adminEmail = "admin@azmcrm.local";
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log(`Seed admin already exists: ${adminEmail}`);
    return;
  }

  const passwordHash = await bcrypt.hash("Admin123!", 10);
  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      role: "Admin",
      name: "Default Admin",
    },
  });

  console.log(`Seeded admin user: ${admin.email} (password: Admin123!)`);
}

async function seedSlaPolicies() {
  for (const priority of Object.keys(DEFAULT_SLA_POLICIES) as Priority[]) {
    const minutes = DEFAULT_SLA_POLICIES[priority];
    await prisma.slaPolicy.upsert({
      where: { priority },
      update: {},
      create: { priority, ...minutes },
    });
  }
  console.log("Seeded default SLA policies (Low/Medium/High/Urgent).");
}

async function main() {
  await seedAdmin();
  await seedSlaPolicies();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
