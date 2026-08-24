import { apiClient } from "./apiClient";

export interface ChatConversation {
  id: string;
  customerId: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  body: string;
  createdAt: string;
}

export async function createConversation() {
  const { data } = await apiClient.post<{ conversation: ChatConversation }>("/chat/conversations");
  return data.conversation;
}

export async function getConversation(id: string) {
  const { data } = await apiClient.get<{ conversation: ChatConversation; messages: ChatMessage[] }>(
    `/chat/conversations/${id}`
  );
  return data;
}

export async function sendChatMessage(conversationId: string, body: string) {
  const { data } = await apiClient.post<{ userMessage: ChatMessage; assistantMessage: ChatMessage; confident: boolean }>(
    `/chat/conversations/${conversationId}/messages`,
    { body }
  );
  return data;
}
