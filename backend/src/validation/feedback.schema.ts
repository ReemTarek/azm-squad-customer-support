import { z } from "zod";

export const createFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});
