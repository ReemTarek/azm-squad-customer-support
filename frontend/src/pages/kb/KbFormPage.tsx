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
      <form onSubmit={handleSubmit} className="entity-form">
        {error && <p role="alert" className="form-error">{error}</p>}
        <label>
          Title
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </label>
        <label>
          Category
          <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />
        </label>
        <label>
          Body
          <textarea rows={8} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
        </label>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create article (draft)"}
        </button>
      </form>
    </div>
  );
}
