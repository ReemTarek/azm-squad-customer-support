import { z } from "zod";

export const createCustomerNoteSchema = z.object({
  body: z.string().min(1, "Note body is required"),
});
