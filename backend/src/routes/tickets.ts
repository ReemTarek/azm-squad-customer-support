import { Router, type NextFunction, type Request, type Response } from "express";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";
import { requireAuth, requireRole } from "../middleware/auth";
import { computeSlaDueDates, computeSlaState } from "../services/sla";
import { suggestReply, summarizeTicket, suggestRelevantArticleIds, suggestTicketCategory } from "../services/gemini";
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
import { notifyCustomer } from "../integrations/notificationDispatcher";
import { upload } from "../lib/upload";
import { toAttachmentDto } from "../lib/attachmentDto";
import type { Ticket } from "@prisma/client";

const router = Router();

// Truncates a reply body for inclusion in the customer notification email,
// keeping the message short while still giving the customer a preview of
// what was said. Exported for focused unit testing.
export function buildReplyPreview(body: string): string {
  return body.length > 200 ? `${body.slice(0, 200)}...` : body;
}

function toTicketDto(ticket: Ticket) {
  return {
    id: ticket.id,
    customerId: ticket.customerId,
    assignedAgentId: ticket.assignedAgentId,
    subject: ticket.subject,
    category: ticket.category,
    departmentId: ticket.departmentId,
    branchId: ticket.branchId,
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

export async function assertTicketAccess(ticketId: string, user: { id: string; role: string }) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw Errors.notFound("Ticket not found");
  if (user.role === "Customer" && ticket.customerId !== user.id) {
    throw Errors.forbidden("Cannot access another customer's ticket");
  }

  // Same department/branch scoping as the list view (TASK-040) — enforced
  // here too so a Manager can't bypass the list filter via a direct ticket ID.
  if (user.role === "Manager") {
    const managerRecord = await prisma.user.findUnique({
      where: { id: user.id },
      select: { departmentId: true, branchId: true },
    });
    if (managerRecord?.departmentId && ticket.departmentId !== managerRecord.departmentId) {
      throw Errors.forbidden("Cannot access a ticket outside your department");
    }
    if (managerRecord?.branchId && ticket.branchId !== managerRecord.branchId) {
      throw Errors.forbidden("Cannot access a ticket outside your branch");
    }
  }

  return ticket;
}

// Runs the ownership/scoping check for a ticket BEFORE any body-parsing
// middleware that could have side effects (e.g. multer writing an uploaded
// file to disk). Keeping this ahead of `upload.single(...)` on the
// attachment-bearing route ensures an unauthorized request never gets far
// enough to leave an orphaned file behind.
async function loadTicketForAccess(req: Request, res: Response, next: NextFunction) {
  try {
    await assertTicketAccess(String(req.params.id), req.user!);
    next();
  } catch (err) {
    next(err);
  }
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

  const { responseDueAt, resolutionDueAt } = await computeSlaDueDates(body.priority);
  const ticket = await prisma.ticket.create({
    data: {
      subject: body.subject,
      category: body.category ?? "General",
      priority: body.priority,
      customerId,
      departmentId: body.departmentId,
      branchId: body.branchId,
      responseDueAt,
      resolutionDueAt,
    },
  });
  await prisma.ticketStatusHistory.create({
    data: { ticketId: ticket.id, fromStatus: null, toStatus: "Open", changedById: req.user!.id },
  });

  let finalTicket = ticket;
  if (ticket.category === "General") {
    try {
      // groupBy instead of findMany({ distinct }) so this never scans/returns
      // every row that has a given category — only one row per distinct
      // category value, capped at 50 (bounds both the query and the
      // eventual prompt size sent to Gemini).
      const grouped = await prisma.ticket.groupBy({
        by: ["category"],
        where: { category: { not: "General" } },
        orderBy: { category: "asc" },
        take: 50,
      });
      const existingCategories = grouped.map((g) => g.category);
      if (existingCategories.length > 0) {
        const suggested = await suggestTicketCategory(body.subject, existingCategories);
        if (suggested !== "General") {
          // updateMany (scoped to category still being "General") instead of
          // update, so a concurrent edit to this ticket's category between
          // creation and this AI-suggested update can't be silently
          // clobbered by a stale suggestion.
          const { count } = await prisma.ticket.updateMany({
            where: { id: ticket.id, category: "General" },
            data: { category: suggested },
          });
          if (count > 0) {
            finalTicket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
          }
        }
      }
    } catch (err) {
      console.error("Ticket category suggestion failed (non-fatal):", err);
    }
  }

  res.status(201).json({ ticket: toTicketDto(finalTicket) });
});

router.get("/", requireAuth, requireRole("Admin", "Manager", "Agent", "Customer"), async (req, res) => {
  const query = listTicketsQuerySchema.parse(req.query);
  const user = req.user!;

  const where: Record<string, unknown> = {};
  if (query.status) where.status = query.status;
  if (query.priority) where.priority = query.priority;
  if (query.category) where.category = query.category;
  if (query.departmentId) where.departmentId = query.departmentId;
  if (query.branchId) where.branchId = query.branchId;

  if (user.role === "Customer") {
    where.customerId = user.id;
  } else if (user.role === "Agent") {
    // Agents only ever see their own assigned tickets, regardless of query params.
    // (Not additionally department/branch-scoped: assignment is the authoritative
    // scope for an Agent — see decisions.md for why department scoping is layered
    // onto Manager only, not Agent.)
    where.assignedAgentId = user.id;
    if (query.customerId) where.customerId = query.customerId;
  } else if (user.role === "Manager") {
    if (query.assignedAgentId) where.assignedAgentId = query.assignedAgentId === "me" ? user.id : query.assignedAgentId;
    if (query.customerId) where.customerId = query.customerId;

    // Managers are scoped to their own department/branch, if assigned one.
    // An unassigned Manager (departmentId/branchId both null) keeps seeing
    // everything, preserving prior behavior for existing/unconfigured users.
    const managerRecord = await prisma.user.findUnique({
      where: { id: user.id },
      select: { departmentId: true, branchId: true },
    });
    if (managerRecord?.departmentId) where.departmentId = managerRecord.departmentId;
    if (managerRecord?.branchId) where.branchId = managerRecord.branchId;
  } else {
    // Admin: unrestricted.
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

  if (req.user!.role === "Manager") {
    const managerRecord = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { departmentId: true, branchId: true },
    });
    if (managerRecord?.departmentId && existing.departmentId !== managerRecord.departmentId) {
      throw Errors.forbidden("Cannot update a ticket outside your department");
    }
    if (managerRecord?.branchId && existing.branchId !== managerRecord.branchId) {
      throw Errors.forbidden("Cannot update a ticket outside your branch");
    }
  }

  const data: Record<string, unknown> = {};
  if (body.subject) data.subject = body.subject;
  if (body.category) data.category = body.category;
  if (body.departmentId !== undefined) data.departmentId = body.departmentId;
  if (body.branchId !== undefined) data.branchId = body.branchId;

  if (body.priority && body.priority !== existing.priority) {
    data.priority = body.priority;
    const { responseDueAt, resolutionDueAt } = await computeSlaDueDates(body.priority, existing.createdAt);
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

    if (body.status === "Resolved" || body.status === "Closed") {
      const customer = await prisma.user.findUnique({ where: { id: ticket.customerId } });
      if (customer) {
        // Demonstrates the notification integration boundary (mock channel — see integrations/).
        await notifyCustomer(
          "email",
          customer.email,
          "Your ticket has been resolved",
          `Your ticket "${ticket.subject}" is now ${body.status}.`,
          req.user!.id
        ).catch((err) => console.error("Notification dispatch failed (non-fatal):", err));
      }
    }
  }

  res.json({ ticket: toTicketDto(ticket) });
});

router.post("/:id/assign", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
  const id = String(req.params.id);
  const body = assignTicketSchema.parse(req.body);

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw Errors.notFound("Ticket not found");

  if (req.user!.role === "Manager") {
    const managerRecord = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { departmentId: true, branchId: true },
    });
    if (managerRecord?.departmentId && ticket.departmentId !== managerRecord.departmentId) {
      throw Errors.forbidden("Cannot assign a ticket outside your department");
    }
    if (managerRecord?.branchId && ticket.branchId !== managerRecord.branchId) {
      throw Errors.forbidden("Cannot assign a ticket outside your branch");
    }
  }

  const agent = await prisma.user.findUnique({ where: { id: body.agentId } });
  if (!agent || agent.role !== "Agent") throw Errors.validation("agentId must reference an existing Agent");
  if (!agent.isActive) throw Errors.validation("agentId must reference an active Agent");

  const updated = await prisma.ticket.update({ where: { id }, data: { assignedAgentId: body.agentId } });
  await writeAuditLog(req.user!.id, "ticket.assign", "Ticket", id, { agentId: body.agentId, method: "manual" });
  res.json({ ticket: toTicketDto(updated) });
});

router.post("/escalate-overdue", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
  const candidates = await prisma.ticket.findMany({
    where: { status: { in: ["Open", "InProgress"] }, priority: { not: "Urgent" } },
  });

  const toEscalate = candidates.filter(
    (t) => computeSlaState(t.createdAt, t.resolutionDueAt, t.resolvedAt) === "breached"
  );

  for (const ticket of toEscalate) {
    await prisma.ticket.update({ where: { id: ticket.id }, data: { priority: "Urgent" } });
    await writeAuditLog(req.user!.id, "ticket.escalate", "Ticket", ticket.id, {
      fromPriority: ticket.priority,
      toPriority: "Urgent",
      reason: "SLA breached",
    });
  }

  res.json({ escalatedCount: toEscalate.length, escalatedTicketIds: toEscalate.map((t) => t.id) });
});

router.post("/:id/auto-assign", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
  const id = String(req.params.id);
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw Errors.notFound("Ticket not found");

  const agents = await prisma.user.findMany({ where: { role: "Agent", isActive: true }, orderBy: { createdAt: "asc" } });
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
    include: { attachments: true },
  });
  res.json({
    messages: messages.map((m) => ({ ...m, attachments: m.attachments.map(toAttachmentDto) })),
  });
});

router.post(
  "/:id/messages",
  requireAuth,
  requireRole("Admin", "Manager", "Agent", "Customer"),
  loadTicketForAccess,
  upload.single("file"),
  async (req, res) => {
    const user = req.user!;
    const id = String(req.params.id);

    const body = createMessageSchema.parse(req.body);
    const isInternalNote = user.role === "Customer" ? false : Boolean(body.isInternalNote);

    const message = await prisma.ticketMessage.create({
      data: {
        ticketId: id,
        authorId: user.id,
        body: body.body,
        isInternalNote,
        ...(req.file
          ? {
              attachments: {
                create: {
                  fileName: req.file.originalname,
                  mimeType: req.file.mimetype,
                  sizeBytes: req.file.size,
                  storagePath: req.file.filename,
                  uploadedById: user.id,
                },
              },
            }
          : {}),
      },
      include: { attachments: true },
    });

    if (!isInternalNote && user.role !== "Customer") {
      // The entire notification dispatch — including the DB lookups it needs —
      // is isolated behind this try/catch. The ticket message was already
      // successfully created above, so a failure here (lookup or send) must
      // never surface as a 500 to the client; that would invite a
      // duplicate-creating retry for a message that was actually saved.
      try {
        const ticket = await prisma.ticket.findUnique({
          where: { id },
          select: { customerId: true, subject: true },
        });
        if (ticket) {
          const customer = await prisma.user.findUnique({ where: { id: ticket.customerId } });
          if (customer) {
            const preview = buildReplyPreview(message.body);
            await notifyCustomer(
              "email",
              customer.email,
              "New reply on your ticket",
              `You have a new reply on your ticket "${ticket.subject}":\n\n${preview}`,
              user.id
            );
          }
        }
      } catch (err) {
        console.error("Notification dispatch failed (non-fatal):", err);
      }
    }

    res.status(201).json({
      message: { ...message, attachments: message.attachments.map(toAttachmentDto) },
    });
  }
);

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

router.get("/:id/summary", requireAuth, requireRole("Admin", "Manager", "Agent"), async (req, res) => {
  const id = String(req.params.id);
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw Errors.notFound("Ticket not found");

  const messages = await prisma.ticketMessage.findMany({
    where: { ticketId: id },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { role: true } } },
  });

  try {
    const summary = await summarizeTicket(
      ticket.subject,
      ticket.priority,
      messages.map((m) => ({ authorRole: m.author.role, body: m.body, isInternalNote: m.isInternalNote }))
    );
    res.json({ summary });
  } catch (err) {
    console.error("Gemini summarize failed:", err);
    throw Errors.aiUnavailable();
  }
});

router.get("/:id/suggested-articles", requireAuth, requireRole("Admin", "Manager", "Agent"), async (req, res) => {
  const id = String(req.params.id);
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw Errors.notFound("Ticket not found");

  const [messages, articles] = await Promise.all([
    prisma.ticketMessage.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { role: true } } },
    }),
    prisma.knowledgeBaseArticle.findMany({
      where: { published: true },
      select: { id: true, title: true, category: true },
    }),
  ]);

  try {
    const ids = await suggestRelevantArticleIds(
      ticket.subject,
      messages.map((m) => ({ authorRole: m.author.role, body: m.body, isInternalNote: m.isInternalNote })),
      articles
    );
    const suggested = articles.filter((a) => ids.includes(a.id));
    res.json({ articles: suggested });
  } catch (err) {
    console.error("Gemini suggested-articles failed:", err);
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
