import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { listTickets } from "../../lib/ticketsApi";
import type { Priority, TicketStatus } from "../../lib/ticketsApi";
import { SlaBadge } from "../../components/SlaBadge";

export function TicketsListPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<TicketStatus | "">("");
  const [priority, setPriority] = useState<Priority | "">("");
  const [category, setCategory] = useState("");

  const { data: tickets, isLoading, error } = useQuery({
    queryKey: ["tickets", status, priority, category],
    queryFn: () => listTickets({ status: status || undefined, priority: priority || undefined, category: category || undefined }),
  });

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t("tickets.title")}</h1>
        <Link to="/tickets/new" className="button-link">{t("tickets.newTicket")}</Link>
      </div>
      <div className="filters">
        <select value={status} onChange={(e) => setStatus(e.target.value as TicketStatus | "")}>
          <option value="">{t("tickets.allStatuses")}</option>
          <option value="Open">Open</option>
          <option value="InProgress">In Progress</option>
          <option value="Resolved">Resolved</option>
          <option value="Closed">Closed</option>
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value as Priority | "")}>
          <option value="">{t("tickets.allPriorities")}</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          <option value="Urgent">Urgent</option>
        </select>
        <input
          type="text"
          placeholder="Filter by category…"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
      </div>
      {isLoading && <p>Loading…</p>}
      {error && <p role="alert" className="form-error">Failed to load tickets.</p>}
      {tickets && (
        <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("tickets.subject")}</th>
              <th>Category</th>
              <th>{t("tickets.priority")}</th>
              <th>{t("tickets.status")}</th>
              <th>{t("tickets.sla")}</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id}>
                <td><Link to={`/tickets/${ticket.id}`}>{ticket.subject}</Link></td>
                <td>{ticket.category}</td>
                <td>{ticket.priority}</td>
                <td>{ticket.status}</td>
                <td><SlaBadge state={ticket.slaState} /></td>
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr><td colSpan={5}>{t("tickets.noneFound")}</td></tr>
            )}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
