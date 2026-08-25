import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createQuickReply, deleteQuickReply, listQuickReplies } from "../lib/quickRepliesApi";
import { extractApiErrorMessage } from "../lib/apiClient";

export function QuickRepliesPage() {
  const queryClient = useQueryClient();
  const { data: quickReplies, isLoading } = useQuery({ queryKey: ["quick-replies"], queryFn: listQuickReplies });
  const [form, setForm] = useState({ title: "", body: "" });
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createQuickReply(form),
    onSuccess: () => {
      setForm({ title: "", body: "" });
      queryClient.invalidateQueries({ queryKey: ["quick-replies"] });
    },
    onError: (err) => setError(extractApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteQuickReply(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quick-replies"] }),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    createMutation.mutate();
  }

  return (
    <div className="page">
      <h1>Quick Replies</h1>
      <p className="form-text text-muted">Reusable reply templates, insertable from any ticket's reply box.</p>

      <form onSubmit={handleSubmit} className="card card-body mb-3">
        {error && <p role="alert" className="alert alert-danger">{error}</p>}
        <div className="mb-3">
          <label className="form-label" htmlFor="quick-reply-title">Title</label>
          <input id="quick-reply-title" className="form-control" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="quick-reply-body">Body</label>
          <textarea id="quick-reply-body" className="form-control" rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
        </div>
        <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Saving…" : "Save quick reply"}
        </button>
      </form>

      {isLoading && <p>Loading…</p>}
      <ul className="list-group mt-3">
        {quickReplies?.map((qr) => (
          <li key={qr.id} className="list-group-item d-flex justify-content-between align-items-start">
            <div>
              <strong>{qr.title}</strong>
              <p className="form-text text-muted">{qr.body}</p>
            </div>
            <button className="btn btn-outline-primary" onClick={() => deleteMutation.mutate(qr.id)}>
              Delete
            </button>
          </li>
        ))}
        {quickReplies?.length === 0 && <li className="list-group-item">No quick replies saved yet.</li>}
      </ul>
    </div>
  );
}
