import { z } from "zod";

export const recordAiUsageEventSchema = z.object({
  eventType: z.enum(["suggest_reply_used", "suggested_article_clicked"]),
  ticketId: z.string().uuid().optional(),
});
