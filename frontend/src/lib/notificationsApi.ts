import { apiClient } from "./apiClient";

export interface NotificationsSummary {
  breachedCount: number;
  atRiskCount: number;
}

export async function getNotificationsSummary() {
  const { data } = await apiClient.get<NotificationsSummary>("/notifications/summary");
  return data;
}

export async function escalateOverdueTickets() {
  const { data } = await apiClient.post<{ escalatedCount: number; escalatedTicketIds: string[] }>(
    "/tickets/escalate-overdue"
  );
  return data;
}
