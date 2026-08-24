import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listTickets } from "../../lib/ticketsApi";
import type { Priority, TicketStatus } from "../../lib/ticketsApi";
import { SlaBadge } from "../../components/SlaBadge";

export function TicketsListPage() {
  const [status, setStatus] = useState<TicketStatus | "">("");
  const [priority, setPriority] = useState<Priority | "">("");

  const { data: tickets, isLoading, error } = useQuery({
    queryKey: ["tickets", status, priority],
    queryFn: () => listTickets({ status: status || undefined, priority: priority || undefined }),
  });

  return (
    <div className="page">
      <div className="page-header">
        <h1>Tickets</h1>
        <Link to="/tickets/new" className="button-link">New Ticket</Link>
      </div>
      <div className="filters">
        <select value={status} onChange={(e) => setStatus(e.target.value as TicketStatus | "")}>
          <option value="">All statuses</option>
          <option value="Open">Open</option>
          <option value="InProgress">In Progress</option>
          <option value="Resolved">Resolved</option>
          <option value="Closed">Closed</option>
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value as Priority | "")}>
          <option value="">All priorities</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          <option value="Urgent">Urgent</option>
        </select>
      </div>
      {isLoading && <p>Loading…</p>}
      {error && <p role="alert" className="form-error">Failed to load tickets.</p>}
      {tickets && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Priority</th>
              <th>Status</th>
              <th>SLA</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id}>
                <td><Link to={`/tickets/${t.id}`}>{t.subject}</Link></td>
                <td>{t.priority}</td>
                <td>{t.status}</td>
                <td><SlaBadge state={t.slaState} /></td>
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr><td colSpan={4}>No tickets found.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
