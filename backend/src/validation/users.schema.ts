import { z } from "zod";

export const createStaffUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1),
  role: z.enum(["Admin", "Manager", "Agent"]),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["Admin", "Manager", "Agent", "Customer"]).optional(),
});

export const listUsersQuerySchema = z.object({
  role: z.enum(["Admin", "Manager", "Agent", "Customer"]).optional(),
});
