import { Router } from "express";
import type { Server as SocketIOServer } from "socket.io";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";
import { requireAuth, requireRole } from "../middleware/auth";
import { createLiveChatMessageSchema } from "../validation/liveChat.schema";

const router = Router();

function toSessionDto(session: {
  id: string;
  customerId: string;
  assignedAgentId: string | null;
  status: string;
  createdAt: Date;
  endedAt: Date | null;
}) {
  return {
    id: session.id,
    customerId: session.customerId,
    assignedAgentId: session.assignedAgentId,
    status: session.status,
    createdAt: session.createdAt,
    endedAt: session.endedAt,
  };
}

function toMessageDto(message: {
  id: string;
  sessionId: string;
  authorId: string;
  authorRole: string;
  body: string;
  createdAt: Date;
}) {
  return {
    id: message.id,
    sessionId: message.sessionId,
    authorId: message.authorId,
    authorRole: message.authorRole,
    body: message.body,
    createdAt: message.createdAt,
  };
}

async function assertLiveChatAccess(sessionId: string, user: { id: string; role: string }) {
  const session = await prisma.liveChatSession.findUnique({ where: { id: sessionId } });
  if (!session) throw Errors.notFound("Live chat session not found");
  if (user.role === "Customer" && session.customerId !== user.id) {
    throw Errors.forbidden("Cannot access another customer's chat session");
  }
  if (user.role === "Agent" && session.assignedAgentId !== user.id) {
    throw Errors.forbidden("Cannot access a chat session assigned to a different agent");
  }
  return session;
}

router.post("/sessions", requireAuth, requireRole("Customer"), async (req, res) => {
  const session = await prisma.liveChatSession.create({
    data: { customerId: req.user!.id },
  });

  const io = req.app.locals.io as SocketIOServer | undefined;
  io?.to("agents").emit("queue:new-session", toSessionDto(session));

  res.status(201).json({ session: toSessionDto(session) });
});

router.get("/sessions", requireAuth, requireRole("Admin", "Manager", "Agent"), async (req, res) => {
  const user = req.user!;
  // "The requester's own Active sessions" (per spec) means different
  // things per role, consistent with this app's existing ticket-
  // visibility pattern elsewhere: an Agent only claims/handles chats
  // themselves, so "own" means assignedAgentId === their id. Admin/
  // Manager don't personally claim chats — as overseers they see every
  // active session, the same broader visibility they already have over
  // all tickets regardless of assignment. `assignedAgentId: undefined`
  // in a Prisma where clause means "don't filter on this field", which
  // is what achieves the Admin/Manager "see everything active" case.
  const sessions = await prisma.liveChatSession.findMany({
    where: {
      OR: [
        { status: "Waiting" },
        { status: "Active", assignedAgentId: user.role === "Agent" ? user.id : undefined },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
  res.json({ sessions: sessions.map(toSessionDto) });
});

router.post("/sessions/:id/claim", requireAuth, requireRole("Agent"), async (req, res) => {
  const id = String(req.params.id);
  const session = await prisma.liveChatSession.findUnique({ where: { id } });
  if (!session) throw Errors.notFound("Live chat session not found");
  if (session.status !== "Waiting") {
    throw Errors.conflict("Session is not waiting to be claimed");
  }

  const updated = await prisma.liveChatSession.update({
    where: { id },
    data: { status: "Active", assignedAgentId: req.user!.id },
  });

  res.json({ session: toSessionDto(updated) });
});

router.get("/sessions/:id/messages", requireAuth, requireRole("Admin", "Manager", "Agent", "Customer"), async (req, res) => {
  const session = await assertLiveChatAccess(String(req.params.id), req.user!);
  const messages = await prisma.liveChatMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "asc" },
  });
  res.json({ messages: messages.map(toMessageDto) });
});

router.post("/sessions/:id/messages", requireAuth, requireRole("Admin", "Manager", "Agent", "Customer"), async (req, res) => {
  const user = req.user!;
  const session = await assertLiveChatAccess(String(req.params.id), user);
  if (session.status === "Ended") {
    throw Errors.conflict("This chat session has ended");
  }
  const body = createLiveChatMessageSchema.parse(req.body);

  const message = await prisma.liveChatMessage.create({
    data: {
      sessionId: session.id,
      authorId: user.id,
      authorRole: user.role,
      body: body.body,
    },
  });

  const io = req.app.locals.io as SocketIOServer | undefined;
  io?.to(session.id).emit("message:new", toMessageDto(message));

  res.status(201).json({ message: toMessageDto(message) });
});

router.post("/sessions/:id/end", requireAuth, requireRole("Admin", "Manager", "Agent", "Customer"), async (req, res) => {
  const session = await assertLiveChatAccess(String(req.params.id), req.user!);

  const updated = await prisma.liveChatSession.update({
    where: { id: session.id },
    data: { status: "Ended", endedAt: new Date() },
  });

  const io = req.app.locals.io as SocketIOServer | undefined;
  io?.to(session.id).emit("session:ended", { sessionId: session.id });
  // Acceptance criterion: "both sockets leave the room" — force every
  // socket currently in this session's room out of it server-side,
  // rather than relying on each client to voluntarily leave after
  // receiving the event above.
  io?.in(session.id).socketsLeave(session.id);

  res.json({ session: toSessionDto(updated) });
});

export default router;
