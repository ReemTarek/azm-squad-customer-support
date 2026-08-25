import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createArticle } from "../../lib/kbApi";
import { extractApiErrorMessage } from "../../lib/apiClient";

export function KbFormPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: "", category: "", body: "" });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const article = await createArticle(form);
      navigate(`/kb/${article.id}`, { replace: true });
    } catch (err) {
      setError(extractApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page">
      <h1>New Article</h1>
      <form onSubmit={handleSubmit} className="card card-body mb-3">
        {error && <p role="alert" className="alert alert-danger">{error}</p>}
        <div className="mb-3">
          <label className="form-label" htmlFor="kb-title">Title</label>
          <input id="kb-title" className="form-control" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="kb-category">Category</label>
          <input id="kb-category" className="form-control" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="kb-body">Body</label>
          <textarea id="kb-body" className="form-control" rows={8} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
        </div>
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create article (draft)"}
        </button>
      </form>
    </div>
  );
}
