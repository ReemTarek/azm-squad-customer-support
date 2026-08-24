import { apiClient } from "./apiClient";

export interface SlaPolicy {
  id: string;
  priority: "Low" | "Medium" | "High" | "Urgent";
  responseMinutes: number;
  resolutionMinutes: number;
  updatedAt: string;
}

export async function listSlaPolicies() {
  const { data } = await apiClient.get<{ policies: SlaPolicy[] }>("/admin/sla-config");
  return data.policies;
}

export async function updateSlaPolicy(priority: string, input: { responseMinutes: number; resolutionMinutes: number }) {
  const { data } = await apiClient.patch<{ policy: SlaPolicy }>(`/admin/sla-config/${priority}`, input);
  return data.policy;
}
