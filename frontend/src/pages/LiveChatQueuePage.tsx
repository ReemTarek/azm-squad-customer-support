import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { connectSocket } from "../lib/socketClient";
import {
  claimLiveChatSession,
  endLiveChatSession,
  listLiveChatMessages,
  listLiveChatSessions,
  sendLiveChatMessage,
} from "../lib/liveChatApi";
import type { LiveChatMessage, LiveChatSession } from "../lib/liveChatApi";
import { extractApiErrorMessage } from "../lib/apiClient";

export function LiveChatQueuePage() {
  const queryClient = useQueryClient();
  const sessionsQuery = useQuery({ queryKey: ["live-chat-sessions"], queryFn: listLiveChatSessions });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const joinedSessionRef = useRef<string | null>(null);

  useEffect(() => {
    const socket = connectSocket();

    function onQueueUpdate() {
      queryClient.invalidateQueries({ queryKey: ["live-chat-sessions"] });
    }
    socket.on("queue:new-session", onQueueUpdate);

    return () => {
      socket.off("queue:new-session", onQueueUpdate);
    };
  }, [queryClient]);

  useEffect(() => {
    if (!activeSessionId) return;
    const socket = connectSocket();

    function join() {
      socket.emit("join-session", { sessionId: activeSessionId }, (ack: { ok: boolean }) => {
        if (ack.ok) joinedSessionRef.current = activeSessionId;
      });
    }
    if (socket.connected) join();
    socket.on("connect", join);

    function onMessage(message: LiveChatMessage) {
      if (message.sessionId !== activeSessionId) return;
      setMessages((prev) => [...prev, message]);
    }
    socket.on("message:new", onMessage);

    function onEnded(payload: { sessionId: string }) {
      if (payload.sessionId !== activeSessionId) return;
      setSessionEnded(true);
      queryClient.invalidateQueries({ queryKey: ["live-chat-sessions"] });
    }
    socket.on("session:ended", onEnded);

    return () => {
      socket.off("connect", join);
      socket.off("message:new", onMessage);
      socket.off("session:ended", onEnded);
    };
  }, [activeSessionId, queryClient]);

  async function handleClaim(session: LiveChatSession) {
    setError(null);
    const claimed = await claimLiveChatSession(session.id).catch((err) => {
      setError(extractApiErrorMessage(err));
      return null;
    });
    if (!claimed) return;
    setSessionEnded(false);
    setActiveSessionId(claimed.id);
    const history = await listLiveChatMessages(claimed.id);
    setMessages(history);
    queryClient.invalidateQueries({ queryKey: ["live-chat-sessions"] });
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!activeSessionId || !input.trim()) return;
    const body = input;
    setInput("");
    await sendLiveChatMessage(activeSessionId, body).catch((err) => setError(extractApiErrorMessage(err)));
  }

  async function handleEnd() {
    if (!activeSessionId) return;
    await endLiveChatSession(activeSessionId).catch((err) => setError(extractApiErrorMessage(err)));
    setActiveSessionId(null);
    setMessages([]);
    setSessionEnded(false);
    queryClient.invalidateQueries({ queryKey: ["live-chat-sessions"] });
  }

  const waiting = sessionsQuery.data?.filter((s) => s.status === "Waiting") ?? [];
  const active = sessionsQuery.data?.filter((s) => s.status === "Active") ?? [];

  return (
    <div className="page">
      <div className="page-header d-flex justify-content-between align-items-center mb-3">
        <h1>Live Chat</h1>
      </div>
      {error && <p role="alert" className="alert alert-danger">{error}</p>}

      <div className="row g-3">
        <div className="col-md-4">
          <div className="card card-body mb-3">
            <h2 className="h5 card-title">Waiting</h2>
            <ul className="list-group list-group-flush">
              {waiting.map((s) => (
                <li key={s.id} className="list-group-item d-flex justify-content-between align-items-center">
                  <span>Session {s.id.slice(0, 8)}</span>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => handleClaim(s)}>
                    Claim
                  </button>
                </li>
              ))}
              {waiting.length === 0 && <li className="list-group-item">No one waiting.</li>}
            </ul>
          </div>
          <div className="card card-body">
            <h2 className="h5 card-title">My Active Chats</h2>
            <ul className="list-group list-group-flush">
              {active.map((s) => (
                <li key={s.id} className="list-group-item d-flex justify-content-between align-items-center">
                  <span>Session {s.id.slice(0, 8)}</span>
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    onClick={async () => {
                      setSessionEnded(false);
                      setActiveSessionId(s.id);
                      setMessages(await listLiveChatMessages(s.id));
                    }}
                  >
                    Open
                  </button>
                </li>
              ))}
              {active.length === 0 && <li className="list-group-item">No active chats.</li>}
            </ul>
          </div>
        </div>

        <div className="col-md-8">
          {activeSessionId ? (
            <div className="card card-body">
              {sessionEnded && <p className="alert alert-secondary">This chat has ended.</p>}
              <ul className="list-group mb-3">
                {messages.map((m) => (
                  <li key={m.id} className="list-group-item">
                    <span className="badge bg-secondary mb-1">{m.authorRole}</span>
                    <p className="mb-0">{m.body}</p>
                  </li>
                ))}
                {messages.length === 0 && <li className="list-group-item">No messages yet.</li>}
              </ul>
              {!sessionEnded && (
                <form onSubmit={handleSend} className="d-flex gap-2">
                  <label className="visually-hidden" htmlFor="agent-live-chat-input">Type a message</label>
                  <input
                    id="agent-live-chat-input"
                    type="text"
                    className="form-control"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary">Send</button>
                  <button type="button" className="btn btn-outline-secondary" onClick={handleEnd}>End chat</button>
                </form>
              )}
            </div>
          ) : (
            <p className="text-muted">Claim a waiting session or open an active one to start chatting.</p>
          )}
        </div>
      </div>
    </div>
  );
}
