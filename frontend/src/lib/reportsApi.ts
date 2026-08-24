import { apiClient } from "./apiClient";

export interface ReportsSummary {
  byStatus: { status: string; count: number }[];
  byPriority: { priority: string; count: number }[];
  avgResolutionMinutes: number | null;
  ticketsPerAgent: { agentId: string; agentName: string; count: number }[];
}

export async function getReportsSummary() {
  const { data } = await apiClient.get<ReportsSummary>("/reports/summary");
  return data;
}
