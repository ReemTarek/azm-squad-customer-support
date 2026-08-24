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

export interface ReportsTrends {
  slaBreachRatePercent: number;
  totalResolved: number;
  totalBreached: number;
  ticketsCreatedPerDay: { date: string; count: number }[];
  avgCsatRating: number | null;
  csatCount: number;
  agentPerformance: { agentId: string; agentName: string; resolvedCount: number; avgResolutionMinutes: number }[];
}

export async function getReportsTrends() {
  const { data } = await apiClient.get<ReportsTrends>("/reports/trends");
  return data;
}
