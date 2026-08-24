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
      <p className="form-hint">Reusable reply templates, insertable from any ticket's reply box.</p>

      <form onSubmit={handleSubmit} className="entity-form">
        {error && <p role="alert" className="form-error">{error}</p>}
        <label>
          Title
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </label>
        <label>
          Body
          <textarea rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
        </label>
        <button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Saving…" : "Save quick reply"}
        </button>
      </form>

      {isLoading && <p>Loading…</p>}
      <ul className="kb-list quick-replies-list">
        {quickReplies?.map((qr) => (
          <li key={qr.id}>
            <div>
              <strong>{qr.title}</strong>
              <p className="form-hint">{qr.body}</p>
            </div>
            <button className="secondary-button" onClick={() => deleteMutation.mutate(qr.id)}>
              Delete
            </button>
          </li>
        ))}
        {quickReplies?.length === 0 && <li>No quick replies saved yet.</li>}
      </ul>
    </div>
  );
}
