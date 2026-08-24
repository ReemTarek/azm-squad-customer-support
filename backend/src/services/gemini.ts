import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env";

export interface ThreadMessageForPrompt {
  authorRole: string;
  body: string;
  isInternalNote: boolean;
}

export async function suggestReply(
  subject: string,
  priority: string,
  messages: ThreadMessageForPrompt[]
): Promise<string> {
  if (!env.geminiApiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const genAI = new GoogleGenerativeAI(env.geminiApiKey);
  const model = genAI.getGenerativeModel({ model: env.geminiModel });

  const thread = messages
    .map((m) => `[${m.authorRole}${m.isInternalNote ? ", internal note" : ""}]: ${m.body}`)
    .join("\n");

  const prompt = `You are a customer support agent assistant. Draft a short, professional,
empathetic reply to the customer's most recent message in this support ticket.
Only return the reply text itself, no preamble or explanation.

Ticket subject: ${subject}
Priority: ${priority}

Conversation so far:
${thread || "(no messages yet)"}

Draft reply to the customer:`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
