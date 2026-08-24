import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/prisma";
import { signAccessToken } from "../../src/lib/jwt";
import type { Role } from "@prisma/client";

export async function createUser(overrides: {
  email: string;
  role: Role;
  name?: string;
  departmentId?: string;
  branchId?: string;
}) {
  const passwordHash = await bcrypt.hash("Password123!", 10);
  return prisma.user.create({
    data: {
      email: overrides.email,
      passwordHash,
      role: overrides.role,
      name: overrides.name ?? overrides.email,
      departmentId: overrides.departmentId,
      branchId: overrides.branchId,
    },
  });
}

export function tokenFor(user: { id: string; role: Role }) {
  return signAccessToken({ sub: user.id, role: user.role });
}
