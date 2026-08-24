import { apiClient } from "./apiClient";

export interface CustomerNote {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
}

export async function listCustomerNotes(customerId: string) {
  const { data } = await apiClient.get<{ notes: CustomerNote[] }>(`/customers/${customerId}/notes`);
  return data.notes;
}

export async function createCustomerNote(customerId: string, body: string) {
  const { data } = await apiClient.post<{ note: CustomerNote }>(`/customers/${customerId}/notes`, { body });
  return data.note;
}
