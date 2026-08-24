import { z } from "zod";

export const createOrgUnitSchema = z.object({
  name: z.string().min(1),
});

export const updateOrgUnitSchema = z.object({
  name: z.string().min(1),
});
