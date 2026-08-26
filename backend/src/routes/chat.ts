import { Router } from "express";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";
import { requireAuth, requireRole } from "../middleware/auth";
import { createChatMessageSchema } from "../validation/chat.schema";
import { answerFromKnowledgeBase, CHATBOT_FALLBACK_MESSAGE } from "../services/gemini";

const router = Router();

async function assertConversationAccess(conversationId: string, userId: string) {
  const conversation = await prisma.chatConversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw Errors.notFound("Conversation not found");
  if (conversation.customerId !== userId) throw Errors.forbidden("Cannot access another customer's conversation");
  return conversation;
}

router.get("/conversations", requireAuth, requireRole("Customer"), async (req, res) => {
  const conversations = await prisma.chatConversation.findMany({
    where: { customerId: req.user!.id },
    orderBy: { createdAt: "desc" },
  });
  res.json({ conversations });
});

router.post("/conversations", requireAuth, requireRole("Customer"), async (req, res) => {
  const conversation = await prisma.chatConversation.create({ data: { customerId: req.user!.id } });
  res.status(201).json({ conversation });
});

router.get("/conversations/:id", requireAuth, requireRole("Customer"), async (req, res) => {
  const conversation = await assertConversationAccess(String(req.params.id), req.user!.id);
  const messages = await prisma.chatMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
  });
  res.json({ conversation, messages });
});

router.post("/conversations/:id/messages", requireAuth, requireRole("Customer"), async (req, res) => {
  const conversation = await assertConversationAccess(String(req.params.id), req.user!.id);
  const body = createChatMessageSchema.parse(req.body);

  const priorMessages = await prisma.chatMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
  });

  const userMessage = await prisma.chatMessage.create({
    data: { conversationId: conversation.id, role: "user", body: body.body },
  });

  const publishedArticles = await prisma.knowledgeBaseArticle.findMany({
    where: { published: true },
    select: { title: true, category: true, body: true },
  });

  let answerText = CHATBOT_FALLBACK_MESSAGE;
  let confident = false;
  try {
    const result = await answerFromKnowledgeBase(
      body.body,
      priorMessages.map((m) => ({ role: m.role, body: m.body })),
      publishedArticles
    );
    answerText = result.answer;
    confident = result.confident;
  } catch (err) {
    console.error("Chatbot answer failed:", err);
    // Falls back to CHATBOT_FALLBACK_MESSAGE (already set) rather than
    // erroring the request — a chat reply failing shouldn't 503 the
    // whole conversation the way the agent-facing Gemini features do.
    // A genuine Gemini failure and an explicit "I don't have a
    // confident answer" model response are both recorded as
    // chatbot_fallback — the spec's event-type list doesn't distinguish
    // them, and both produce the same fallback message to the customer.
  }

  try {
    await prisma.aiUsageEvent.create({
      data: {
        eventType: confident ? "chatbot_confident" : "chatbot_fallback",
        userId: req.user!.id,
      },
    });
  } catch (logErr) {
    console.error("AI usage event logging failed (non-fatal):", logErr);
  }

  const assistantMessage = await prisma.chatMessage.create({
    data: { conversationId: conversation.id, role: "assistant", body: answerText },
  });

  res.status(201).json({ userMessage, assistantMessage, confident });
});

export default router;
