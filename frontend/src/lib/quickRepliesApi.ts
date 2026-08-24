import { apiClient } from "./apiClient";

export interface QuickReply {
  id: string;
  title: string;
  body: string;
  authorId: string;
  createdAt: string;
}

export async function listQuickReplies() {
  const { data } = await apiClient.get<{ quickReplies: QuickReply[] }>("/quick-replies");
  return data.quickReplies;
}

export async function createQuickReply(input: { title: string; body: string }) {
  const { data } = await apiClient.post<{ quickReply: QuickReply }>("/quick-replies", input);
  return data.quickReply;
}

export async function deleteQuickReply(id: string) {
  await apiClient.delete(`/quick-replies/${id}`);
}
