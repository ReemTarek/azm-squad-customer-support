import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  assignTicket,
  autoAssignTicket,
  getFeedback,
  getSuggestedArticles,
  getTicket,
  getTicketSummary,
  listHistory,
  listMessages,
  postMessage,
  submitFeedback,
  suggestReply,
  updateTicket,
} from "../../lib/ticketsApi";
import type { TicketStatus } from "../../lib/ticketsApi";
import { listUsersByRole } from "../../lib/usersApi";
import { createTask, listTasks, updateTask } from "../../lib/tasksApi";
import { listQuickReplies } from "../../lib/quickRepliesApi";
import { extractApiErrorMessage } from "../../lib/apiClient";
import { useAuth } from "../../auth/AuthContext";
import { SlaBadge } from "../../components/SlaBadge";

const STATUS_OPTIONS: TicketStatus[] = ["Open", "InProgress", "Resolved", "Closed"];

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = user?.role === "Admin" || user?.role === "Manager" || user?.role === "Agent";
  const canAssign = user?.role === "Admin" || user?.role === "Manager";

  const ticketQuery = useQuery({ queryKey: ["ticket", id], queryFn: () => getTicket(id!), enabled: Boolean(id) });
  const messagesQuery = useQuery({ queryKey: ["ticket", id, "messages"], queryFn: () => listMessages(id!), enabled: Boolean(id) });
  const historyQuery = useQuery({ queryKey: ["ticket", id, "history"], queryFn: () => listHistory(id!), enabled: Boolean(id) });
  const agentsQuery = useQuery({ queryKey: ["agents"], queryFn: () => listUsersByRole("Agent"), enabled: canAssign });
  const tasksQuery = useQuery({ queryKey: ["ticket", id, "tasks"], queryFn: () => listTasks(id!), enabled: Boolean(id) && canManage });
  const quickRepliesQuery = useQuery({ queryKey: ["quick-replies"], queryFn: listQuickReplies, enabled: canManage });
  const feedbackQuery = useQuery({ queryKey: ["ticket", id, "feedback"], queryFn: () => getFeedback(id!), enabled: Boolean(id) });

  const [actionError, setActionError] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const statusMutation = useMutation({
    mutationFn: (status: TicketStatus) => updateTicket(id!, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket", id] });
      queryClient.invalidateQueries({ queryKey: ["ticket", id, "history"] });
    },
    onError: (err) => setActionError(extractApiErrorMessage(err)),
  });

  const assignMutation = useMutation({
    mutationFn: (agentId: string) => assignTicket(id!, agentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ticket", id] }),
    onError: (err) => setActionError(extractApiErrorMessage(err)),
  });

  const autoAssignMutation = useMutation({
    mutationFn: () => autoAssignTicket(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ticket", id] }),
    onError: (err) => setActionError(extractApiErrorMessage(err)),
  });

  const suggestMutation = useMutation({
    mutationFn: () => suggestReply(id!),
    onSuccess: (reply) => setReplyBody(reply),
    onError: (err) => setActionError(extractApiErrorMessage(err)),
  });

  const summaryMutation = useMutation({
    mutationFn: () => getTicketSummary(id!),
    onError: (err) => setActionError(extractApiErrorMessage(err)),
  });

  const suggestedArticlesMutation = useMutation({
    mutationFn: () => getSuggestedArticles(id!),
    onError: (err) => setActionError(extractApiErrorMessage(err)),
  });

  const messageMutation = useMutation({
    mutationFn: () => postMessage(id!, { body: replyBody, isInternalNote }),
    onSuccess: () => {
      setReplyBody("");
      setIsInternalNote(false);
      queryClient.invalidateQueries({ queryKey: ["ticket", id, "messages"] });
    },
    onError: (err) => setActionError(extractApiErrorMessage(err)),
  });

  function handleReplySubmit(e: FormEvent) {
    e.preventDefault();
    setActionError(null);
    messageMutation.mutate();
  }

  const addTaskMutation = useMutation({
    mutationFn: () => createTask(id!, { title: newTaskTitle }),
    onSuccess: () => {
      setNewTaskTitle("");
      queryClient.invalidateQueries({ queryKey: ["ticket", id, "tasks"] });
    },
    onError: (err) => setActionError(extractApiErrorMessage(err)),
  });

  const toggleTaskMutation = useMutation({
    mutationFn: ({ taskId, completed }: { taskId: string; completed: boolean }) =>
      updateTask(id!, taskId, { completed }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ticket", id, "tasks"] }),
    onError: (err) => setActionError(extractApiErrorMessage(err)),
  });

  function handleAddTask(e: FormEvent) {
    e.preventDefault();
    setActionError(null);
    addTaskMutation.mutate();
  }

  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState("");
  const feedbackMutation = useMutation({
    mutationFn: () => submitFeedback(id!, { rating: feedbackRating, comment: feedbackComment || undefined }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ticket", id, "feedback"] }),
    onError: (err) => setActionError(extractApiErrorMessage(err)),
  });

  function handleFeedbackSubmit(e: FormEvent) {
    e.preventDefault();
    setActionError(null);
    feedbackMutation.mutate();
  }

  if (ticketQuery.isLoading) return <p>Loading…</p>;
  if (ticketQuery.error) return <p role="alert" className="form-error">Failed to load ticket.</p>;
  const ticket = ticketQuery.data;
  if (!ticket) return null;

  return (
    <div className="page ticket-detail">
      <div className="page-header d-flex justify-content-between align-items-center mb-3">
        <h1>{ticket.subject}</h1>
        <SlaBadge state={ticket.slaState} />
      </div>
      {actionError && <p role="alert" className="form-error">{actionError}</p>}

      <div className="d-flex flex-wrap gap-4 text-secondary mb-3">
        <span>Category: {ticket.category}</span>
        <span>Priority: {ticket.priority}</span>
        <span>Status: {ticket.status}</span>
      </div>

      {canManage && (
        <div className="d-flex flex-wrap gap-4 p-3 bg-light rounded mb-4">
          <div>
            <label className="form-label" htmlFor="ticket-status-select">Status</label>
            <select
              id="ticket-status-select"
              className="form-select form-select-sm"
              style={{ width: "auto" }}
              value={ticket.status}
              onChange={(e) => statusMutation.mutate(e.target.value as TicketStatus)}
              disabled={statusMutation.isPending}
            >
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {canAssign && (
            <div>
              <label className="form-label" htmlFor="ticket-assign-select">Assign to</label>
              <select
                id="ticket-assign-select"
                className="form-select form-select-sm"
                style={{ width: "auto", maxWidth: "12rem" }}
                value={ticket.assignedAgentId ?? ""}
                onChange={(e) => e.target.value && assignMutation.mutate(e.target.value)}
                disabled={assignMutation.isPending}
              >
                <option value="">Unassigned</option>
                {agentsQuery.data?.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
                ))}
              </select>
            </div>
          )}
          {canAssign && (
            <button
              type="button"
              className="btn btn-outline-primary align-self-end"
              onClick={() => autoAssignMutation.mutate()}
              disabled={autoAssignMutation.isPending}
            >
              {autoAssignMutation.isPending ? "Auto-assigning…" : "Auto-assign (least loaded)"}
            </button>
          )}
        </div>
      )}

      {canManage && (
        <section className="card card-body mb-3">
          <h2>AI Assist</h2>
          <div className="d-flex flex-wrap gap-2 mb-2">
            <button
              type="button"
              className="btn btn-outline-primary"
              onClick={() => summaryMutation.mutate()}
              disabled={summaryMutation.isPending}
            >
              {summaryMutation.isPending ? "Summarizing…" : "Summarize Ticket"}
            </button>
            <button
              type="button"
              className="btn btn-outline-primary"
              onClick={() => suggestedArticlesMutation.mutate()}
              disabled={suggestedArticlesMutation.isPending}
            >
              {suggestedArticlesMutation.isPending ? "Searching…" : "Suggest Articles"}
            </button>
          </div>
          {summaryMutation.data && <p className="card card-body bg-light mb-3">{summaryMutation.data}</p>}
          {suggestedArticlesMutation.data && (
            <ul className="list-unstyled card card-body bg-light mb-3">
              {suggestedArticlesMutation.data.map((a) => (
                <li key={a.id}><Link to={`/kb/${a.id}`}>{a.title}</Link> ({a.category})</li>
              ))}
              {suggestedArticlesMutation.data.length === 0 && <li>No relevant articles found.</li>}
            </ul>
          )}
        </section>
      )}

      <section className="card card-body mb-3">
        <h2>Messages</h2>
        <ul className="list-group mb-3">
          {messagesQuery.data?.map((m) => (
            <li key={m.id} className={m.isInternalNote ? "list-group-item list-group-item-warning" : "list-group-item"}>
              {m.isInternalNote && <span className="badge bg-warning text-dark mb-1">Internal note</span>}
              <p className="mb-0">{m.body}</p>
            </li>
          ))}
        </ul>
        <form onSubmit={handleReplySubmit}>
          <div className="mb-3">
            <label className="form-label" htmlFor="ticket-reply-body">Reply</label>
            <textarea id="ticket-reply-body" className="form-control" value={replyBody} onChange={(e) => setReplyBody(e.target.value)} required rows={3} />
          </div>
          {canManage && (
            <div className="d-flex align-items-center gap-2 mb-2">
              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={() => suggestMutation.mutate()}
                disabled={suggestMutation.isPending}
              >
                {suggestMutation.isPending ? "Asking Gemini…" : "Suggest Reply"}
              </button>
              <select
                aria-label="Insert quick reply"
                className="form-select form-select-sm"
                style={{ width: "auto", maxWidth: "12rem" }}
                value=""
                onChange={(e) => {
                  const qr = quickRepliesQuery.data?.find((q) => q.id === e.target.value);
                  if (qr) setReplyBody((prev) => (prev ? `${prev}\n${qr.body}` : qr.body));
                }}
              >
                <option value="">Insert quick reply…</option>
                {quickRepliesQuery.data?.map((qr) => (
                  <option key={qr.id} value={qr.id}>{qr.title}</option>
                ))}
              </select>
            </div>
          )}
          {canManage && (
            <div className="form-check mb-2">
              <input
                type="checkbox"
                className="form-check-input"
                id="ticket-internal-note"
                checked={isInternalNote}
                onChange={(e) => setIsInternalNote(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="ticket-internal-note">
                Internal note (not visible to customer)
              </label>
            </div>
          )}
          <button type="submit" className="btn btn-primary" disabled={messageMutation.isPending}>
            {messageMutation.isPending ? "Sending…" : "Send"}
          </button>
        </form>
      </section>

      {canManage && (
        <section className="card card-body mb-3">
          <h2>Tasks / Reminders</h2>
          <ul className="list-group mb-3">
            {tasksQuery.data?.map((task) => (
              <li key={task.id} className="list-group-item d-flex align-items-center gap-2">
                <div className="form-check mb-0">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id={`task-${task.id}`}
                    checked={task.completed}
                    onChange={(e) => toggleTaskMutation.mutate({ taskId: task.id, completed: e.target.checked })}
                  />
                  <label
                    className={task.completed ? "form-check-label text-decoration-line-through text-muted" : "form-check-label"}
                    htmlFor={`task-${task.id}`}
                  >
                    {task.title}
                  </label>
                </div>
                {task.dueAt && <span className="badge text-bg-warning">Due {new Date(task.dueAt).toLocaleDateString()}</span>}
              </li>
            ))}
            {tasksQuery.data?.length === 0 && <li className="list-group-item">No tasks yet.</li>}
          </ul>
          <form onSubmit={handleAddTask} className="d-flex gap-2">
            <input
              type="text"
              placeholder="New task or reminder…"
              className="form-control"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary" disabled={addTaskMutation.isPending}>
              {addTaskMutation.isPending ? "Adding…" : "Add"}
            </button>
          </form>
        </section>
      )}

      <section className="card card-body mb-3">
        <h2>History</h2>
        <ul className="list-group list-group-flush small text-secondary">
          {historyQuery.data?.map((h) => (
            <li key={h.id} className="list-group-item">{h.fromStatus ?? "—"} → {h.toStatus} ({new Date(h.changedAt).toLocaleString()})</li>
          ))}
        </ul>
      </section>

      {(ticket.status === "Resolved" || ticket.status === "Closed") && (
        <section className="card card-body mb-3">
          <h2>Customer Satisfaction</h2>
          {feedbackQuery.data ? (
            <p>
              Rating: {"★".repeat(feedbackQuery.data.rating)}{"☆".repeat(5 - feedbackQuery.data.rating)}
              {feedbackQuery.data.comment && <> — "{feedbackQuery.data.comment}"</>}
            </p>
          ) : user?.role === "Customer" ? (
            <form onSubmit={handleFeedbackSubmit}>
              <div className="mb-3">
                <label className="form-label" htmlFor="feedback-rating">Rating (1-5)</label>
                <select id="feedback-rating" className="form-select" style={{ width: "auto" }} value={feedbackRating} onChange={(e) => setFeedbackRating(Number(e.target.value))}>
                  {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="feedback-comment">Comment (optional)</label>
                <textarea id="feedback-comment" className="form-control" rows={2} value={feedbackComment} onChange={(e) => setFeedbackComment(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={feedbackMutation.isPending}>
                {feedbackMutation.isPending ? "Submitting…" : "Submit feedback"}
              </button>
            </form>
          ) : (
            <p className="form-hint">No feedback submitted yet.</p>
          )}
        </section>
      )}
    </div>
  );
}
