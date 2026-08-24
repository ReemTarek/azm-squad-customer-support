import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { createTicket } from "../../lib/ticketsApi";
import type { Priority } from "../../lib/ticketsApi";
import { listCustomers } from "../../lib/customersApi";
import { extractApiErrorMessage } from "../../lib/apiClient";
import { useAuth } from "../../auth/AuthContext";

export function TicketFormPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const needsCustomerPicker = user?.role === "Admin" || user?.role === "Agent";

  const { data: customers } = useQuery({
    queryKey: ["customers", ""],
    queryFn: () => listCustomers(),
    enabled: needsCustomerPicker,
  });

  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [customerId, setCustomerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const ticket = await createTicket({
        subject,
        priority,
        customerId: needsCustomerPicker ? customerId : undefined,
      });
      navigate(`/tickets/${ticket.id}`, { replace: true });
    } catch (err) {
      setError(extractApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page">
      <h1>New Ticket</h1>
      <form onSubmit={handleSubmit} className="entity-form">
        {error && <p role="alert" className="form-error">{error}</p>}
        {needsCustomerPicker && (
          <label>
            Customer
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
              <option value="">Select a customer…</option>
              {customers?.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
              ))}
            </select>
          </label>
        )}
        <label>
          Subject
          <input value={subject} onChange={(e) => setSubject(e.target.value)} required />
        </label>
        <label>
          Priority
          <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Urgent">Urgent</option>
          </select>
        </label>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create ticket"}
        </button>
      </form>
    </div>
  );
}
