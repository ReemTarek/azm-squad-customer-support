import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createConversation, getConversation, sendChatMessage } from "../lib/chatApi";
import { extractApiErrorMessage } from "../lib/apiClient";
import { connectSocket } from "../lib/socketClient";
import {
  endLiveChatSession,
  listLiveChatMessages,
  sendLiveChatMessage,
  startLiveChatSession,
} from "../lib/liveChatApi";
import type { LiveChatMessage } from "../lib/liveChatApi";

export function ChatPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastConfident, setLastConfident] = useState(true);
  const [lastQuestion, setLastQuestion] = useState("");
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
  const [liveMessages, setLiveMessages] = useState<LiveChatMessage[]>([]);
  const [liveInput, setLiveInput] = useState("");
  const [liveEnded, setLiveEnded] = useState(false);
  const joinedSessionRef = useRef<string | null>(null);

  const startMutation = useMutation({
    mutationFn: createConversation,
    onSuccess: (conversation) => setConversationId(conversation.id),
    onError: (err) => setError(extractApiErrorMessage(err)),
  });

  useEffect(() => {
    if (!conversationId) startMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const conversationQuery = useQuery({
    queryKey: ["chat", conversationId],
    queryFn: () => getConversation(conversationId!),
    enabled: Boolean(conversationId),
  });

  const sendMutation = useMutation({
    mutationFn: (body: string) => sendChatMessage(conversationId!, body),
    onSuccess: (result) => {
      setLastConfident(result.confident);
      queryClient.invalidateQueries({ queryKey: ["chat", conversationId] });
    },
    onError: (err) => setError(extractApiErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLastQuestion(input);
    sendMutation.mutate(input);
    setInput("");
  }

  function handleCreateTicket() {
    navigate("/tickets/new", { state: { prefillSubject: lastQuestion } });
  }

  async function handleTalkToHuman() {
    setError(null);
    const session = await startLiveChatSession().catch((err) => {
      setError(extractApiErrorMessage(err));
      return null;
    });
    if (!session) return;
    setLiveSessionId(session.id);
    setLiveEnded(false);
    const history = await listLiveChatMessages(session.id);
    setLiveMessages(history);
  }

  useEffect(() => {
    if (!liveSessionId) return;

    const socket = connectSocket();

    function join() {
      socket.emit("join-session", { sessionId: liveSessionId }, (ack: { ok: boolean }) => {
        if (ack.ok) joinedSessionRef.current = liveSessionId;
      });
    }

    if (socket.connected) join();
    socket.on("connect", join);

    function onMessage(message: LiveChatMessage) {
      if (message.sessionId !== liveSessionId) return;
      setLiveMessages((prev) => [...prev, message]);
    }
    function onEnded(payload: { sessionId: string }) {
      if (payload.sessionId !== liveSessionId) return;
      setLiveEnded(true);
    }

    socket.on("message:new", onMessage);
    socket.on("session:ended", onEnded);

    return () => {
      socket.off("connect", join);
      socket.off("message:new", onMessage);
      socket.off("session:ended", onEnded);
    };
  }, [liveSessionId]);

  async function handleSendLive(e: FormEvent) {
    e.preventDefault();
    if (!liveSessionId || !liveInput.trim()) return;
    const body = liveInput;
    setLiveInput("");
    await sendLiveChatMessage(liveSessionId, body).catch((err) => setError(extractApiErrorMessage(err)));
  }

  async function handleEndLive() {
    if (!liveSessionId) return;
    await endLiveChatSession(liveSessionId).catch((err) => setError(extractApiErrorMessage(err)));
    setLiveEnded(true);
  }

  return (
    <div className="page">
      <h1>Ask a Question</h1>
      <p className="form-text text-muted">Answers are sourced from our knowledge base only.</p>
      {error && <p role="alert" className="alert alert-danger">{error}</p>}

      <ul className="list-group mb-3">
        {conversationQuery.data?.messages.map((m) => (
          <li key={m.id} className={m.role === "assistant" ? "list-group-item" : "list-group-item list-group-item-warning"}>
            <span className={m.role === "assistant" ? "badge bg-secondary mb-1" : "badge bg-warning text-dark mb-1"}>
              {m.role === "assistant" ? "Assistant" : "You"}
            </span>
            <p className="mb-0">{m.body}</p>
          </li>
        ))}
        {conversationQuery.data?.messages.length === 0 && <li className="list-group-item">Ask anything — I'll answer from our help articles.</li>}
      </ul>

      <div className="d-flex gap-2 mb-3">
        {!lastConfident && (
          <button type="button" className="btn btn-outline-primary" onClick={handleCreateTicket}>
            Create a ticket about this
          </button>
        )}
        {!liveSessionId && (
          <button type="button" className="btn btn-outline-primary" onClick={handleTalkToHuman}>
            Talk to a human
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="d-flex gap-2">
        <label className="visually-hidden" htmlFor="chat-question-input">Type your question</label>
        <input
          id="chat-question-input"
          type="text"
          className="form-control"
          placeholder="Type your question…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          required
          disabled={!conversationId || sendMutation.isPending}
        />
        <button type="submit" className="btn btn-primary" disabled={!conversationId || sendMutation.isPending}>
          {sendMutation.isPending ? "Asking…" : "Send"}
        </button>
      </form>

      {liveSessionId && (
        <section className="card card-body mt-3">
          <h2>Live Chat</h2>
          {liveEnded && <p className="alert alert-secondary">This chat has ended.</p>}
          <ul className="list-group mb-3">
            {liveMessages.map((m) => (
              <li key={m.id} className={m.authorRole === "Customer" ? "list-group-item list-group-item-warning" : "list-group-item"}>
                <span className={m.authorRole === "Customer" ? "badge bg-warning text-dark mb-1" : "badge bg-secondary mb-1"}>
                  {m.authorRole === "Customer" ? "You" : m.authorRole}
                </span>
                <p className="mb-0">{m.body}</p>
              </li>
            ))}
            {liveMessages.length === 0 && <li className="list-group-item">Waiting for an agent to join…</li>}
          </ul>
          {!liveEnded && (
            <form onSubmit={handleSendLive} className="d-flex gap-2">
              <label className="visually-hidden" htmlFor="live-chat-input">Type a message</label>
              <input
                id="live-chat-input"
                type="text"
                className="form-control"
                placeholder="Type a message…"
                value={liveInput}
                onChange={(e) => setLiveInput(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">Send</button>
              <button type="button" className="btn btn-outline-secondary" onClick={handleEndLive}>End chat</button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
