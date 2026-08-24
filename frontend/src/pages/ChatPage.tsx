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
      <p className="form-hint">Answers are sourced from our knowledge base only.</p>
      {error && <p role="alert" className="form-error">{error}</p>}

      <ul className="message-thread">
        {conversationQuery.data?.messages.map((m) => (
          <li key={m.id} className={m.role === "assistant" ? "message" : "message message--internal"}>
            <span className="internal-tag">{m.role === "assistant" ? "Assistant" : "You"}</span>
            <p>{m.body}</p>
          </li>
        ))}
        {conversationQuery.data?.messages.length === 0 && <li>Ask anything — I'll answer from our help articles.</li>}
      </ul>

      {!lastConfident && (
        <button type="button" className="secondary-button" onClick={handleCreateTicket}>
          Create a ticket about this
        </button>
      )}

      <form onSubmit={handleSubmit} className="entity-form entity-form--inline">
        <input
          type="text"
          placeholder="Type your question…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          required
          disabled={!conversationId || sendMutation.isPending}
        />
        <button type="submit" disabled={!conversationId || sendMutation.isPending}>
          {sendMutation.isPending ? "Asking…" : "Send"}
        </button>
      </form>
    </div>
  );
}
