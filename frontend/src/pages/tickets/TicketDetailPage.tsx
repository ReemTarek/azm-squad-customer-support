import { useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  assignTicket,
  autoAssignTicket,
  getFeedback,
  getTicket,
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
      <div className="page-header">
        <h1>{ticket.subject}</h1>
        <SlaBadge state={ticket.slaState} />
      </div>
      {actionError && <p role="alert" className="form-error">{actionError}</p>}

      <div className="ticket-meta">
        <span>Priority: {ticket.priority}</span>
        <span>Status: {ticket.status}</span>
      </div>

      {canManage && (
        <div className="ticket-controls">
          <label>
            Status
            <select
              value={ticket.status}
              onChange={(e) => statusMutation.mutate(e.target.value as TicketStatus)}
              disabled={statusMutation.isPending}
            >
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          {canAssign && (
            <label>
              Assign to
              <select
                value={ticket.assignedAgentId ?? ""}
                onChange={(e) => e.target.value && assignMutation.mutate(e.target.value)}
                disabled={assignMutation.isPending}
              >
                <option value="">Unassigned</option>
                {agentsQuery.data?.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
                ))}
              </select>
            </label>
          )}
          {canAssign && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => autoAssignMutation.mutate()}
              disabled={autoAssignMutation.isPending}
            >
              {autoAssignMutation.isPending ? "Auto-assigning…" : "Auto-assign (least loaded)"}
            </button>
          )}
        </div>
      )}

      <section>
        <h2>Messages</h2>
        <ul className="message-thread">
          {messagesQuery.data?.map((m) => (
            <li key={m.id} className={m.isInternalNote ? "message message--internal" : "message"}>
              {m.isInternalNote && <span className="internal-tag">Internal note</span>}
              <p>{m.body}</p>
            </li>
          ))}
        </ul>
        <form onSubmit={handleReplySubmit} className="entity-form">
          <label>
            Reply
            <textarea value={replyBody} onChange={(e) => setReplyBody(e.target.value)} required rows={3} />
          </label>
          {canManage && (
            <div className="reply-toolbar">
              <button
                type="button"
                className="secondary-button"
                onClick={() => suggestMutation.mutate()}
                disabled={suggestMutation.isPending}
              >
                {suggestMutation.isPending ? "Asking Gemini…" : "Suggest Reply"}
              </button>
              <select
                aria-label="Insert quick reply"
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
            <label className="checkbox-label">
              <input type="checkbox" checked={isInternalNote} onChange={(e) => setIsInternalNote(e.target.checked)} />
              Internal note (not visible to customer)
            </label>
          )}
          <button type="submit" disabled={messageMutation.isPending}>
            {messageMutation.isPending ? "Sending…" : "Send"}
          </button>
        </form>
      </section>

      {canManage && (
        <section>
          <h2>Tasks / Reminders</h2>
          <ul className="task-list">
            {tasksQuery.data?.map((task) => (
              <li key={task.id} className={task.completed ? "task-item task-item--done" : "task-item"}>
                <label>
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={(e) => toggleTaskMutation.mutate({ taskId: task.id, completed: e.target.checked })}
                  />
                  {task.title}
                </label>
                {task.dueAt && <span className="task-due">Due {new Date(task.dueAt).toLocaleDateString()}</span>}
              </li>
            ))}
            {tasksQuery.data?.length === 0 && <li>No tasks yet.</li>}
          </ul>
          <form onSubmit={handleAddTask} className="entity-form entity-form--inline">
            <input
              type="text"
              placeholder="New task or reminder…"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              required
            />
            <button type="submit" disabled={addTaskMutation.isPending}>
              {addTaskMutation.isPending ? "Adding…" : "Add"}
            </button>
          </form>
        </section>
      )}

      <section>
        <h2>History</h2>
        <ul className="history-list">
          {historyQuery.data?.map((h) => (
            <li key={h.id}>{h.fromStatus ?? "—"} → {h.toStatus} ({new Date(h.changedAt).toLocaleString()})</li>
          ))}
        </ul>
      </section>

      {(ticket.status === "Resolved" || ticket.status === "Closed") && (
        <section>
          <h2>Customer Satisfaction</h2>
          {feedbackQuery.data ? (
            <p>
              Rating: {"★".repeat(feedbackQuery.data.rating)}{"☆".repeat(5 - feedbackQuery.data.rating)}
              {feedbackQuery.data.comment && <> — "{feedbackQuery.data.comment}"</>}
            </p>
          ) : user?.role === "Customer" ? (
            <form onSubmit={handleFeedbackSubmit} className="entity-form">
              <label>
                Rating (1-5)
                <select value={feedbackRating} onChange={(e) => setFeedbackRating(Number(e.target.value))}>
                  {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label>
                Comment (optional)
                <textarea rows={2} value={feedbackComment} onChange={(e) => setFeedbackComment(e.target.value)} />
              </label>
              <button type="submit" disabled={feedbackMutation.isPending}>
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
