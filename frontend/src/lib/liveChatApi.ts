import { apiClient } from "./apiClient";

export type LiveChatSessionStatus = "Waiting" | "Active" | "Ended";

export interface LiveChatSession {
  id: string;
  customerId: string;
  assignedAgentId: string | null;
  status: LiveChatSessionStatus;
  createdAt: string;
  endedAt: string | null;
}

export interface LiveChatMessage {
  id: string;
  sessionId: string;
  authorId: string;
  authorRole: string;
  body: string;
  createdAt: string;
}

export async function startLiveChatSession() {
  const { data } = await apiClient.post<{ session: LiveChatSession }>("/live-chat/sessions");
  return data.session;
}

export async function getMyLiveChatSession() {
  const { data } = await apiClient.get<{ session: LiveChatSession | null }>(
    "/live-chat/sessions/mine"
  );
  return data.session;
}

export async function listLiveChatSessions() {
  const { data } = await apiClient.get<{ sessions: LiveChatSession[] }>("/live-chat/sessions");
  return data.sessions;
}

export async function claimLiveChatSession(sessionId: string) {
  const { data } = await apiClient.post<{ session: LiveChatSession }>(
    `/live-chat/sessions/${sessionId}/claim`
  );
  return data.session;
}

export async function listLiveChatMessages(sessionId: string) {
  const { data } = await apiClient.get<{ messages: LiveChatMessage[] }>(
    `/live-chat/sessions/${sessionId}/messages`
  );
  return data.messages;
}

export async function sendLiveChatMessage(sessionId: string, body: string) {
  const { data } = await apiClient.post<{ message: LiveChatMessage }>(
    `/live-chat/sessions/${sessionId}/messages`,
    { body }
  );
  return data.message;
}

export async function endLiveChatSession(sessionId: string) {
  const { data } = await apiClient.post<{ session: LiveChatSession }>(
    `/live-chat/sessions/${sessionId}/end`
  );
  return data.session;
}
