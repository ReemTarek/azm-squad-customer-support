import { z } from "zod";

export const updateSlaPolicySchema = z.object({
  responseMinutes: z.number().int().positive(),
  resolutionMinutes: z.number().int().positive(),
});
