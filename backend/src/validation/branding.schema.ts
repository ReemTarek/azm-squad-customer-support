import { z } from "zod";

export const updateBrandingSchema = z.object({
  appName: z.string().trim().max(100).optional(),
  primaryColor: z
    .union([
      z.string().regex(/^#[0-9a-fA-F]{6}$/, "primaryColor must be a 6-digit hex color like #2f6fed"),
      z.literal(""),
    ])
    .optional(),
  removeLogo: z.enum(["true", "false"]).optional(),
});
