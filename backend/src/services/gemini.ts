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
  // Matches the short-timeout precedent set by smtpEmailChannel.ts's SMTP
  // transport: a slow/hung Gemini endpoint must not stall the request that
  // triggered it (ticket creation, reply suggestion, etc.) indefinitely.
  return genAI.getGenerativeModel({ model: env.geminiModel }, { timeout: 10_000 });
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

export async function suggestTicketCategory(
  subject: string,
  existingCategories: string[]
): Promise<string> {
  if (existingCategories.length === 0) return "General";
  const model = getModel();

  const categoryList = existingCategories.join(", ");

  const prompt = `A new support ticket needs a category assigned. Pick exactly ONE
category from the list below that best matches the ticket's subject, or
respond with "General" if none fit well. Respond with ONLY the category
name, nothing else — no punctuation, no explanation.

Available categories: ${categoryList}

Ticket subject: ${subject}

Category:`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  const validCategories = new Set([...existingCategories, "General"]);
  return validCategories.has(text) ? text : "General";
}

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  body: string;
}

export interface KbArticleForPrompt {
  title: string;
  category: string;
  body: string;
}

const NO_ANSWER_SENTINEL = "NO_CONFIDENT_ANSWER";
export const CHATBOT_FALLBACK_MESSAGE =
  "I don't have a confident answer to that from our knowledge base. Would you like me to create a support ticket so an agent can help?";

/**
 * Answers a customer's chat question using ONLY the provided published
 * KB article content — never outside knowledge, never invented
 * account/ticket-specific details (the model is given none). Falls
 * back to a fixed, non-hallucinated message when the model itself
 * signals it doesn't have a confident answer (TASK-047 guardrail).
 */
export async function answerFromKnowledgeBase(
  question: string,
  history: ChatHistoryMessage[],
  articles: KbArticleForPrompt[]
): Promise<{ answer: string; confident: boolean }> {
  const model = getModel();
  const historyText = history.map((m) => `${m.role}: ${m.body}`).join("\n");
  const articleList = articles.length
    ? articles.map((a) => `### ${a.title} (${a.category})\n${a.body}`).join("\n\n")
    : "(no published knowledge base articles available)";

  const prompt = `You are a customer support assistant answering questions in a chat
widget. Answer ONLY using the knowledge base articles below — never use
outside knowledge, and never invent account-specific, order-specific,
or ticket-specific details, since none were given to you.

If the knowledge base does not contain a confident answer to the
question, respond with EXACTLY this and nothing else: ${NO_ANSWER_SENTINEL}

Knowledge base articles:
${articleList}

Conversation so far:
${historyText || "(start of conversation)"}

Customer's question: ${question}

Your answer (or ${NO_ANSWER_SENTINEL}):`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  if (text.includes(NO_ANSWER_SENTINEL)) {
    return { answer: CHATBOT_FALLBACK_MESSAGE, confident: false };
  }
  return { answer: text, confident: true };
}
