import { apiClient } from "./apiClient";

export interface AuditLogEntry {
  id: string;
  actorName: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export async function listAuditLogs(entityType?: string) {
  const { data } = await apiClient.get<{ logs: AuditLogEntry[] }>("/audit-logs", {
    params: entityType ? { entityType } : undefined,
  });
  return data.logs;
}
