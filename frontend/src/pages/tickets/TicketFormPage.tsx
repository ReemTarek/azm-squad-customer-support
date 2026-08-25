import { useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { createTicket } from "../../lib/ticketsApi";
import type { Priority } from "../../lib/ticketsApi";
import { listCustomers } from "../../lib/customersApi";
import { listDepartments, listBranches } from "../../lib/orgApi";
import { extractApiErrorMessage } from "../../lib/apiClient";
import { useAuth } from "../../auth/AuthContext";

export function TicketFormPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const prefillSubject = (location.state as { prefillSubject?: string } | null)?.prefillSubject ?? "";
  const needsCustomerPicker = user?.role === "Admin" || user?.role === "Agent";
  const canSetOrg = user?.role === "Admin" || user?.role === "Manager" || user?.role === "Agent";

  const { data: customers } = useQuery({
    queryKey: ["customers", ""],
    queryFn: () => listCustomers(),
    enabled: needsCustomerPicker,
  });
  const { data: departments } = useQuery({ queryKey: ["departments"], queryFn: listDepartments, enabled: canSetOrg });
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: listBranches, enabled: canSetOrg });

  const [subject, setSubject] = useState(prefillSubject);
  const [category, setCategory] = useState("General");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [customerId, setCustomerId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const ticket = await createTicket({
        subject,
        category,
        priority,
        customerId: needsCustomerPicker ? customerId : undefined,
        departmentId: departmentId || undefined,
        branchId: branchId || undefined,
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
      <form onSubmit={handleSubmit} className="card card-body mb-3">
        {error && <p role="alert" className="alert alert-danger">{error}</p>}
        {needsCustomerPicker && (
          <div className="mb-3">
            <label className="form-label" htmlFor="ticket-customer">Customer</label>
            <select id="ticket-customer" className="form-select" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
              <option value="">Select a customer…</option>
              {customers?.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
              ))}
            </select>
          </div>
        )}
        <div className="mb-3">
          <label className="form-label" htmlFor="ticket-subject">Subject</label>
          <input id="ticket-subject" className="form-control" value={subject} onChange={(e) => setSubject(e.target.value)} required />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="ticket-category">Category</label>
          <input id="ticket-category" className="form-control" value={category} onChange={(e) => setCategory(e.target.value)} list="ticket-categories" required />
          <datalist id="ticket-categories">
            <option value="General" />
            <option value="Billing" />
            <option value="Technical" />
            <option value="Account" />
          </datalist>
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="ticket-priority">Priority</label>
          <select id="ticket-priority" className="form-select" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Urgent">Urgent</option>
          </select>
        </div>
        {canSetOrg && (
          <>
            <div className="mb-3">
              <label className="form-label" htmlFor="ticket-department">Department (optional)</label>
              <select id="ticket-department" className="form-select" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                <option value="">None</option>
                {departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="ticket-branch">Branch (optional)</label>
              <select id="ticket-branch" className="form-select" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">None</option>
                {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </>
        )}
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create ticket"}
        </button>
      </form>
    </div>
  );
}
