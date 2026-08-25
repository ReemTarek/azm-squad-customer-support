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
      <form onSubmit={handleSubmit} className="card card-body mb-3">
        {error && <p role="alert" className="alert alert-danger">{error}</p>}
        <div className="mb-3">
          <label className="form-label" htmlFor="new-customer-name">Name</label>
          <input id="new-customer-name" className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="new-customer-email">Email</label>
          <input id="new-customer-email" type="email" className="form-control" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="new-customer-password">Temporary password</label>
          <input id="new-customer-password" type="password" className="form-control" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="new-customer-phone">Phone</label>
          <input id="new-customer-phone" className="form-control" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="new-customer-company">Company</label>
          <input id="new-customer-company" className="form-control" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create customer"}
        </button>
      </form>
    </div>
  );
}
