import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getCustomer, updateCustomer } from "../../lib/customersApi";
import { listTickets } from "../../lib/ticketsApi";
import { createCustomerNote, listCustomerNotes } from "../../lib/customerNotesApi";
import { extractApiErrorMessage } from "../../lib/apiClient";
import { useAuth } from "../../auth/AuthContext";
import { SlaBadge } from "../../components/SlaBadge";

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isStaff = user?.role === "Admin" || user?.role === "Manager" || user?.role === "Agent";
  const queryClient = useQueryClient();
  const { data: customer, isLoading, error } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => getCustomer(id!),
    enabled: Boolean(id),
  });
  const ticketsQuery = useQuery({
    queryKey: ["tickets", "byCustomer", id],
    queryFn: () => listTickets({ customerId: id }),
    enabled: Boolean(id) && isStaff,
  });
  const notesQuery = useQuery({
    queryKey: ["customer", id, "notes"],
    queryFn: () => listCustomerNotes(id!),
    enabled: Boolean(id) && isStaff,
  });

  const [form, setForm] = useState({ name: "", phone: "", company: "" });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");

  useEffect(() => {
    if (customer) {
      setForm({ name: customer.name, phone: customer.phone ?? "", company: customer.company ?? "" });
    }
  }, [customer]);

  const mutation = useMutation({
    mutationFn: () => updateCustomer(id!, { name: form.name, phone: form.phone, company: form.company }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customer", id] }),
    onError: (err) => setSaveError(extractApiErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaveError(null);
    mutation.mutate();
  }

  const noteMutation = useMutation({
    mutationFn: () => createCustomerNote(id!, newNote),
    onSuccess: () => {
      setNewNote("");
      queryClient.invalidateQueries({ queryKey: ["customer", id, "notes"] });
    },
  });

  function handleAddNote(e: FormEvent) {
    e.preventDefault();
    noteMutation.mutate();
  }

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p role="alert" className="alert alert-danger">Failed to load customer.</p>;
  if (!customer) return null;

  return (
    <div className="page">
      <h1>{customer.name}</h1>
      <p className="form-text text-muted">{customer.email}</p>
      <form onSubmit={handleSubmit} className="card card-body mb-3">
        {saveError && <p role="alert" className="alert alert-danger">{saveError}</p>}
        <div className="mb-3">
          <label className="form-label" htmlFor="customer-name">Name</label>
          <input id="customer-name" className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="customer-phone">Phone</label>
          <input id="customer-phone" className="form-control" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="customer-company">Company</label>
          <input id="customer-company" className="form-control" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save changes"}
        </button>
        {mutation.isSuccess && <p className="alert alert-success">Saved.</p>}
      </form>

      {isStaff && (
        <section className="card card-body mb-3">
          <h2>Ticket History</h2>
          <ul className="list-group list-group-flush">
            {ticketsQuery.data?.map((t) => (
              <li key={t.id} className="list-group-item">
                <Link to={`/tickets/${t.id}`}>{t.subject}</Link> — {t.status} <SlaBadge state={t.slaState} />
              </li>
            ))}
            {ticketsQuery.data?.length === 0 && <li className="list-group-item">No tickets yet.</li>}
          </ul>
        </section>
      )}

      {isStaff && (
        <section className="card card-body mb-3">
          <h2>Notes</h2>
          <ul className="list-group list-group-flush mb-3">
            {notesQuery.data?.map((n) => (
              <li key={n.id} className="list-group-item">
                {n.body} <span className="form-text text-muted">— {n.authorName}, {new Date(n.createdAt).toLocaleString()}</span>
              </li>
            ))}
            {notesQuery.data?.length === 0 && <li className="list-group-item">No notes yet.</li>}
          </ul>
          <form onSubmit={handleAddNote} className="d-flex gap-2">
            <input
              type="text"
              placeholder="Add a note about this customer…"
              className="form-control"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary" disabled={noteMutation.isPending}>
              {noteMutation.isPending ? "Adding…" : "Add"}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
