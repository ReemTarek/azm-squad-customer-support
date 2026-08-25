import { z } from "zod";

export const createLiveChatMessageSchema = z.object({
  body: z.string().min(1, "Message body is required"),
});
