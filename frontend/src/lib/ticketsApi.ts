import { apiClient } from "./apiClient";

export type Priority = "Low" | "Medium" | "High" | "Urgent";
export type TicketStatus = "Open" | "InProgress" | "Resolved" | "Closed";
export type SlaState = "on_track" | "at_risk" | "breached";

export interface Ticket {
  id: string;
  customerId: string;
  assignedAgentId: string | null;
  subject: string;
  category: string;
  departmentId: string | null;
  branchId: string | null;
  priority: Priority;
  status: TicketStatus;
  responseDueAt: string;
  resolutionDueAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  slaState: SlaState;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  isInternalNote: boolean;
  createdAt: string;
  attachments: { id: string; fileName: string; mimeType: string; sizeBytes: number; createdAt: string }[];
}

export interface TicketStatusHistoryEntry {
  id: string;
  ticketId: string;
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus;
  changedById: string;
  changedAt: string;
}

export async function listTickets(filters?: {
  status?: TicketStatus;
  priority?: Priority;
  category?: string;
  customerId?: string;
  departmentId?: string;
  branchId?: string;
}) {
  const { data } = await apiClient.get<{ tickets: Ticket[] }>("/tickets", { params: filters });
  return data.tickets;
}

export async function getTicket(id: string) {
  const { data } = await apiClient.get<{ ticket: Ticket }>(`/tickets/${id}`);
  return data.ticket;
}

export async function createTicket(input: {
  subject: string;
  category?: string;
  priority: Priority;
  customerId?: string;
  departmentId?: string;
  branchId?: string;
}) {
  const { data } = await apiClient.post<{ ticket: Ticket }>("/tickets", input);
  return data.ticket;
}

export async function updateTicket(id: string, input: { status?: TicketStatus; priority?: Priority; category?: string }) {
  const { data } = await apiClient.patch<{ ticket: Ticket }>(`/tickets/${id}`, input);
  return data.ticket;
}

export async function assignTicket(id: string, agentId: string) {
  const { data } = await apiClient.post<{ ticket: Ticket }>(`/tickets/${id}/assign`, { agentId });
  return data.ticket;
}

export async function autoAssignTicket(id: string) {
  const { data } = await apiClient.post<{ ticket: Ticket; assignedAgent: { id: string; name: string } }>(
    `/tickets/${id}/auto-assign`
  );
  return data;
}

export async function listMessages(ticketId: string) {
  const { data } = await apiClient.get<{ messages: TicketMessage[] }>(`/tickets/${ticketId}/messages`);
  return data.messages;
}

export async function suggestReply(ticketId: string) {
  const { data } = await apiClient.post<{ reply: string }>(`/tickets/${ticketId}/suggest-reply`);
  return data.reply;
}

export async function getTicketSummary(ticketId: string) {
  const { data } = await apiClient.get<{ summary: string }>(`/tickets/${ticketId}/summary`);
  return data.summary;
}

export interface SuggestedArticle {
  id: string;
  title: string;
  category: string;
}

export async function getSuggestedArticles(ticketId: string) {
  const { data } = await apiClient.get<{ articles: SuggestedArticle[] }>(`/tickets/${ticketId}/suggested-articles`);
  return data.articles;
}

export async function postMessage(
  ticketId: string,
  input: { body: string; isInternalNote?: boolean; file?: File }
) {
  if (input.file) {
    const form = new FormData();
    form.append("body", input.body);
    if (input.isInternalNote !== undefined) form.append("isInternalNote", String(input.isInternalNote));
    form.append("file", input.file);
    const { data } = await apiClient.post<{ message: TicketMessage }>(`/tickets/${ticketId}/messages`, form);
    return data.message;
  }
  const { data } = await apiClient.post<{ message: TicketMessage }>(`/tickets/${ticketId}/messages`, input);
  return data.message;
}

export interface Feedback {
  id: string;
  ticketId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export async function getFeedback(ticketId: string) {
  const { data } = await apiClient.get<{ feedback: Feedback | null }>(`/tickets/${ticketId}/feedback`);
  return data.feedback;
}

export async function submitFeedback(ticketId: string, input: { rating: number; comment?: string }) {
  const { data } = await apiClient.post<{ feedback: Feedback }>(`/tickets/${ticketId}/feedback`, input);
  return data.feedback;
}

export async function listHistory(ticketId: string) {
  const { data } = await apiClient.get<{ history: TicketStatusHistoryEntry[] }>(`/tickets/${ticketId}/history`);
  return data.history;
}
