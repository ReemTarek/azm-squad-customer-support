import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createConversation, getConversation, sendChatMessage } from "../lib/chatApi";
import { extractApiErrorMessage } from "../lib/apiClient";

export function ChatPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastConfident, setLastConfident] = useState(true);
  const [lastQuestion, setLastQuestion] = useState("");

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

      {!lastConfident && (
        <button type="button" className="btn btn-outline-primary" onClick={handleCreateTicket}>
          Create a ticket about this
        </button>
      )}

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
    </div>
  );
}
