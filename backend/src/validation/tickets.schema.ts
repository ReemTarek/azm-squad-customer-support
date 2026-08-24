import { z } from "zod";

const priorityEnum = z.enum(["Low", "Medium", "High", "Urgent"]);
const statusEnum = z.enum(["Open", "InProgress", "Resolved", "Closed"]);

export const createTicketSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  priority: priorityEnum,
  customerId: z.string().uuid().optional(),
});

export const listTicketsQuerySchema = z.object({
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  assignedAgentId: z.string().optional(),
});

export const updateTicketSchema = z.object({
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  subject: z.string().min(1).optional(),
});

export const assignTicketSchema = z.object({
  agentId: z.string().uuid(),
});

export const createMessageSchema = z.object({
  body: z.string().min(1, "Message body is required"),
  isInternalNote: z.boolean().optional(),
});
