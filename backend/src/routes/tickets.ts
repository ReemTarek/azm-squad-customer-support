import { Router } from "express";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";
import { requireAuth, requireRole } from "../middleware/auth";
import { computeSlaDueDates, computeSlaState } from "../services/sla";
import { suggestReply } from "../services/gemini";
import {
  assignTicketSchema,
  createMessageSchema,
  createTicketSchema,
  listTicketsQuerySchema,
  updateTicketSchema,
} from "../validation/tickets.schema";
import { createTaskSchema, updateTaskSchema } from "../validation/tasks.schema";
import { createFeedbackSchema } from "../validation/feedback.schema";
import { writeAuditLog } from "../lib/audit";
import type { Ticket } from "@prisma/client";

const router = Router();

function toTicketDto(ticket: Ticket) {
  return {
    id: ticket.id,
    customerId: ticket.customerId,
    assignedAgentId: ticket.assignedAgentId,
    subject: ticket.subject,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    responseDueAt: ticket.responseDueAt,
    resolutionDueAt: ticket.resolutionDueAt,
    resolvedAt: ticket.resolvedAt,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    slaState: computeSlaState(ticket.createdAt, ticket.resolutionDueAt, ticket.resolvedAt),
  };
}

async function assertTicketAccess(ticketId: string, user: { id: string; role: string }) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw Errors.notFound("Ticket not found");
  if (user.role === "Customer" && ticket.customerId !== user.id) {
    throw Errors.forbidden("Cannot access another customer's ticket");
  }
  return ticket;
}

router.post("/", requireAuth, requireRole("Admin", "Agent", "Customer"), async (req, res) => {
  const body = createTicketSchema.parse(req.body);

  let customerId: string;
  if (req.user!.role === "Customer") {
    customerId = req.user!.id;
  } else {
    if (!body.customerId) throw Errors.validation("customerId is required when creating a ticket on behalf of a customer");
    const customer = await prisma.user.findUnique({ where: { id: body.customerId } });
    if (!customer || customer.role !== "Customer") throw Errors.notFound("Customer not found");
    customerId = body.customerId;
  }

  const { responseDueAt, resolutionDueAt } = computeSlaDueDates(body.priority);
  const ticket = await prisma.ticket.create({
    data: {
      subject: body.subject,
      category: body.category ?? "General",
      priority: body.priority,
      customerId,
      responseDueAt,
      resolutionDueAt,
    },
  });
  await prisma.ticketStatusHistory.create({
    data: { ticketId: ticket.id, fromStatus: null, toStatus: "Open", changedById: req.user!.id },
  });

  res.status(201).json({ ticket: toTicketDto(ticket) });
});

router.get("/", requireAuth, requireRole("Admin", "Manager", "Agent", "Customer"), async (req, res) => {
  const query = listTicketsQuerySchema.parse(req.query);
  const user = req.user!;

  const where: Record<string, unknown> = {};
  if (query.status) where.status = query.status;
  if (query.priority) where.priority = query.priority;
  if (query.category) where.category = query.category;

  if (user.role === "Customer") {
    where.customerId = user.id;
  } else if (user.role === "Agent") {
    // Agents only ever see their own assigned tickets, regardless of query params.
    where.assignedAgentId = user.id;
    if (query.customerId) where.customerId = query.customerId;
  } else {
    if (query.assignedAgentId) where.assignedAgentId = query.assignedAgentId === "me" ? user.id : query.assignedAgentId;
    if (query.customerId) where.customerId = query.customerId;
  }

  const tickets = await prisma.ticket.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json({ tickets: tickets.map(toTicketDto) });
});

router.get("/:id", requireAuth, requireRole("Admin", "Manager", "Agent", "Customer"), async (req, res) => {
  const ticket = await assertTicketAccess(String(req.params.id), req.user!);
  res.json({ ticket: toTicketDto(ticket) });
});

router.patch("/:id", requireAuth, requireRole("Admin", "Manager", "Agent"), async (req, res) => {
  const id = String(req.params.id);
  const body = updateTicketSchema.parse(req.body);
  const existing = await prisma.ticket.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Ticket not found");

  if (req.user!.role === "Agent" && existing.assignedAgentId !== req.user!.id) {
    throw Errors.forbidden("Only the assigned agent can update this ticket");
  }

  const data: Record<string, unknown> = {};
  if (body.subject) data.subject = body.subject;
  if (body.category) data.category = body.category;

  if (body.priority && body.priority !== existing.priority) {
    data.priority = body.priority;
    const { responseDueAt, resolutionDueAt } = computeSlaDueDates(body.priority, existing.createdAt);
    data.responseDueAt = responseDueAt;
    data.resolutionDueAt = resolutionDueAt;
  }

  if (body.status && body.status !== existing.status) {
    data.status = body.status;
    data.resolvedAt = body.status === "Resolved" || body.status === "Closed" ? new Date() : null;
  }

  const ticket = await prisma.ticket.update({ where: { id }, data });

  if (body.status && body.status !== existing.status) {
    await prisma.ticketStatusHistory.create({
      data: {
        ticketId: id,
        fromStatus: existing.status,
        toStatus: body.status,
        changedById: req.user!.id,
      },
    });
  }

  res.json({ ticket: toTicketDto(ticket) });
});

router.post("/:id/assign", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
  const id = String(req.params.id);
  const body = assignTicketSchema.parse(req.body);

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw Errors.notFound("Ticket not found");

  const agent = await prisma.user.findUnique({ where: { id: body.agentId } });
  if (!agent || agent.role !== "Agent") throw Errors.validation("agentId must reference an existing Agent");

  const updated = await prisma.ticket.update({ where: { id }, data: { assignedAgentId: body.agentId } });
  await writeAuditLog(req.user!.id, "ticket.assign", "Ticket", id, { agentId: body.agentId, method: "manual" });
  res.json({ ticket: toTicketDto(updated) });
});

router.post("/:id/auto-assign", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
  const id = String(req.params.id);
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw Errors.notFound("Ticket not found");

  const agents = await prisma.user.findMany({ where: { role: "Agent" }, orderBy: { createdAt: "asc" } });
  if (agents.length === 0) throw Errors.validation("No agents exist to assign to");

  const openLoad = await prisma.ticket.groupBy({
    by: ["assignedAgentId"],
    _count: { _all: true },
    where: { assignedAgentId: { not: null }, status: { in: ["Open", "InProgress"] } },
  });
  const loadByAgent = new Map(openLoad.map((row) => [row.assignedAgentId, row._count._all]));

  const leastLoadedAgent = agents.reduce((best, candidate) => {
    const bestLoad = loadByAgent.get(best.id) ?? 0;
    const candidateLoad = loadByAgent.get(candidate.id) ?? 0;
    return candidateLoad < bestLoad ? candidate : best;
  });

  const updated = await prisma.ticket.update({
    where: { id },
    data: { assignedAgentId: leastLoadedAgent.id },
  });
  await writeAuditLog(req.user!.id, "ticket.assign", "Ticket", id, { agentId: leastLoadedAgent.id, method: "auto" });
  res.json({ ticket: toTicketDto(updated), assignedAgent: { id: leastLoadedAgent.id, name: leastLoadedAgent.name } });
});

router.get("/:id/messages", requireAuth, requireRole("Admin", "Manager", "Agent", "Customer"), async (req, res) => {
  const user = req.user!;
  await assertTicketAccess(String(req.params.id), user);

  const messages = await prisma.ticketMessage.findMany({
    where: {
      ticketId: String(req.params.id),
      ...(user.role === "Customer" ? { isInternalNote: false } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
  res.json({ messages });
});

router.post("/:id/messages", requireAuth, requireRole("Admin", "Manager", "Agent", "Customer"), async (req, res) => {
  const user = req.user!;
  const id = String(req.params.id);
  await assertTicketAccess(id, user);

  const body = createMessageSchema.parse(req.body);
  const isInternalNote = user.role === "Customer" ? false : Boolean(body.isInternalNote);

  const message = await prisma.ticketMessage.create({
    data: { ticketId: id, authorId: user.id, body: body.body, isInternalNote },
  });
  res.status(201).json({ message });
});

router.post("/:id/suggest-reply", requireAuth, requireRole("Admin", "Manager", "Agent"), async (req, res) => {
  const id = String(req.params.id);
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw Errors.notFound("Ticket not found");

  const messages = await prisma.ticketMessage.findMany({
    where: { ticketId: id },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { role: true } } },
  });

  try {
    const reply = await suggestReply(
      ticket.subject,
      ticket.priority,
      messages.map((m) => ({ authorRole: m.author.role, body: m.body, isInternalNote: m.isInternalNote }))
    );
    res.json({ reply });
  } catch (err) {
    console.error("Gemini suggest-reply failed:", err);
    throw Errors.aiUnavailable();
  }
});

router.get("/:id/tasks", requireAuth, requireRole("Admin", "Manager", "Agent"), async (req, res) => {
  const id = String(req.params.id);
  const exists = await prisma.ticket.findUnique({ where: { id } });
  if (!exists) throw Errors.notFound("Ticket not found");

  const tasks = await prisma.ticketTask.findMany({ where: { ticketId: id }, orderBy: { createdAt: "asc" } });
  res.json({ tasks });
});

router.post("/:id/tasks", requireAuth, requireRole("Admin", "Manager", "Agent"), async (req, res) => {
  const id = String(req.params.id);
  const exists = await prisma.ticket.findUnique({ where: { id } });
  if (!exists) throw Errors.notFound("Ticket not found");

  const body = createTaskSchema.parse(req.body);
  const assignedToId = body.assignedToId ?? req.user!.id;
  if (body.assignedToId) {
    const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
    if (!assignee || assignee.role === "Customer") throw Errors.validation("assignedToId must reference a staff user");
  }

  const task = await prisma.ticketTask.create({
    data: {
      ticketId: id,
      assignedToId,
      title: body.title,
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
    },
  });
  res.status(201).json({ task });
});

router.patch("/:id/tasks/:taskId", requireAuth, requireRole("Admin", "Manager", "Agent"), async (req, res) => {
  const taskId = String(req.params.taskId);
  const existing = await prisma.ticketTask.findUnique({ where: { id: taskId } });
  if (!existing || existing.ticketId !== String(req.params.id)) throw Errors.notFound("Task not found");

  if (req.user!.role === "Agent" && existing.assignedToId !== req.user!.id) {
    throw Errors.forbidden("Only the assigned staff member can update this task");
  }

  const body = updateTaskSchema.parse(req.body);
  const task = await prisma.ticketTask.update({
    where: { id: taskId },
    data: {
      title: body.title,
      completed: body.completed,
      ...(body.dueAt !== undefined ? { dueAt: body.dueAt ? new Date(body.dueAt) : null } : {}),
    },
  });
  res.json({ task });
});

router.get("/:id/feedback", requireAuth, requireRole("Admin", "Manager", "Agent", "Customer"), async (req, res) => {
  await assertTicketAccess(String(req.params.id), req.user!);
  const feedback = await prisma.customerFeedback.findUnique({ where: { ticketId: String(req.params.id) } });
  res.json({ feedback });
});

router.post("/:id/feedback", requireAuth, requireRole("Customer"), async (req, res) => {
  const id = String(req.params.id);
  const ticket = await assertTicketAccess(id, req.user!);

  if (ticket.status !== "Resolved" && ticket.status !== "Closed") {
    throw Errors.validation("Feedback can only be submitted once the ticket is Resolved or Closed");
  }

  const existing = await prisma.customerFeedback.findUnique({ where: { ticketId: id } });
  if (existing) throw Errors.conflict("Feedback has already been submitted for this ticket");

  const body = createFeedbackSchema.parse(req.body);
  const feedback = await prisma.customerFeedback.create({
    data: { ticketId: id, rating: body.rating, comment: body.comment },
  });
  res.status(201).json({ feedback });
});

router.get("/:id/history", requireAuth, requireRole("Admin", "Manager", "Agent", "Customer"), async (req, res) => {
  const user = req.user!;
  await assertTicketAccess(String(req.params.id), user);

  const history = await prisma.ticketStatusHistory.findMany({
    where: { ticketId: String(req.params.id) },
    orderBy: { changedAt: "asc" },
  });
  res.json({ history });
});

export default router;
