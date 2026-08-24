import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
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

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
