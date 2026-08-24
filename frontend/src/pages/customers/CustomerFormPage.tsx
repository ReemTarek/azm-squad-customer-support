import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createCustomer } from "../../lib/customersApi";
import { extractApiErrorMessage } from "../../lib/apiClient";

export function CustomerFormPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", company: "" });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const customer = await createCustomer({
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        company: form.company || undefined,
      });
      navigate(`/customers/${customer.id}`, { replace: true });
    } catch (err) {
      setError(extractApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page">
      <h1>New Customer</h1>
      <form onSubmit={handleSubmit} className="entity-form">
        {error && <p role="alert" className="form-error">{error}</p>}
        <label>
          Name
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </label>
        <label>
          Email
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </label>
        <label>
          Temporary password
          <input type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        </label>
        <label>
          Phone
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        <label>
          Company
          <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
        </label>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create customer"}
        </button>
      </form>
    </div>
  );
}
