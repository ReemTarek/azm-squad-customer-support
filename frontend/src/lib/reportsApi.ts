import { apiClient } from "./apiClient";

export interface ReportsSummary {
  byStatus: { status: string; count: number }[];
  byPriority: { priority: string; count: number }[];
  byDepartment: { departmentId: string; departmentName: string; count: number }[];
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

export interface AiUsageReport {
  suggestedReply: { shown: number; used: number; usedRatePercent: number };
  suggestedArticles: { shown: number; clicked: number; clickRatePercent: number };
  summaryRequests: number;
  chatbot: { confident: number; fallback: number; confidentRatePercent: number };
}

export async function getAiUsageReport() {
  const { data } = await apiClient.get<AiUsageReport>("/reports/ai-usage");
  return data;
}

export type AiUsageEventType = "suggest_reply_used" | "suggested_article_clicked";

export async function recordAiUsageEvent(eventType: AiUsageEventType, ticketId?: string) {
  await apiClient.post("/reports/ai-usage/event", { eventType, ticketId });
}
