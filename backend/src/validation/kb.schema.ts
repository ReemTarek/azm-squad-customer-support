import { z } from "zod";

export const createArticleSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  category: z.string().min(1),
  published: z.boolean().optional(),
});

export const updateArticleSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  published: z.boolean().optional(),
});
