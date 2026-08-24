import { apiClient } from "./apiClient";

export interface TicketTask {
  id: string;
  ticketId: string;
  assignedToId: string;
  title: string;
  dueAt: string | null;
  completed: boolean;
  createdAt: string;
}

export async function listTasks(ticketId: string) {
  const { data } = await apiClient.get<{ tasks: TicketTask[] }>(`/tickets/${ticketId}/tasks`);
  return data.tasks;
}

export async function createTask(ticketId: string, input: { title: string; dueAt?: string; assignedToId?: string }) {
  const { data } = await apiClient.post<{ task: TicketTask }>(`/tickets/${ticketId}/tasks`, input);
  return data.task;
}

export async function updateTask(ticketId: string, taskId: string, input: { completed?: boolean; title?: string }) {
  const { data } = await apiClient.patch<{ task: TicketTask }>(`/tickets/${ticketId}/tasks/${taskId}`, input);
  return data.task;
}
