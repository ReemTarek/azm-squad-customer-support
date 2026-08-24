import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env";

export interface ThreadMessageForPrompt {
  authorRole: string;
  body: string;
  isInternalNote: boolean;
}

function getModel() {
  if (!env.geminiApiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }
  const genAI = new GoogleGenerativeAI(env.geminiApiKey);
  return genAI.getGenerativeModel({ model: env.geminiModel });
}

function formatThread(messages: ThreadMessageForPrompt[]): string {
  return messages
    .map((m) => `[${m.authorRole}${m.isInternalNote ? ", internal note" : ""}]: ${m.body}`)
    .join("\n");
}

export async function suggestReply(
  subject: string,
  priority: string,
  messages: ThreadMessageForPrompt[]
): Promise<string> {
  const model = getModel();
  const thread = formatThread(messages);

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

export async function summarizeTicket(
  subject: string,
  priority: string,
  messages: ThreadMessageForPrompt[]
): Promise<string> {
  const model = getModel();
  const thread = formatThread(messages);

  const prompt = `Summarize this support ticket in 2-3 short sentences for an agent
who is about to pick it up. Cover: what the customer needs, what's been
done so far, and any blocking question. No preamble, just the summary.

Ticket subject: ${subject}
Priority: ${priority}

Conversation so far:
${thread || "(no messages yet)"}

Summary:`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

export interface ArticleForPrompt {
  id: string;
  title: string;
  category: string;
}

export async function suggestRelevantArticleIds(
  subject: string,
  messages: ThreadMessageForPrompt[],
  articles: ArticleForPrompt[]
): Promise<string[]> {
  if (articles.length === 0) return [];
  const model = getModel();
  const thread = formatThread(messages);

  const articleList = articles.map((a) => `${a.id}: ${a.title} (${a.category})`).join("\n");

  const prompt = `A support ticket needs relevant help-article suggestions.
From the list of articles below, pick up to 3 that are genuinely relevant
to this ticket. Respond with ONLY a JSON array of article ids, e.g.
["id1","id2"]. If none are relevant, respond with [].

Ticket subject: ${subject}

Conversation so far:
${thread || "(no messages yet)"}

Available articles (id: title (category)):
${articleList}

JSON array of relevant article ids:`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const ids = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(ids)) return [];
    const validIds = new Set(articles.map((a) => a.id));
    return ids.filter((id): id is string => typeof id === "string" && validIds.has(id));
  } catch {
    return [];
  }
}
