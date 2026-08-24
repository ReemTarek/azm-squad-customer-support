import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(1),
  dueAt: z.string().datetime().optional(),
  assignedToId: z.string().uuid().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  completed: z.boolean().optional(),
});
