import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { listTickets } from "../../lib/ticketsApi";
import type { Priority, TicketStatus } from "../../lib/ticketsApi";
import { listDepartments, listBranches } from "../../lib/orgApi";
import { SlaBadge } from "../../components/SlaBadge";
import { useAuth } from "../../auth/AuthContext";

export function TicketsListPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canFilterOrg = user?.role === "Admin" || user?.role === "Manager";
  const [status, setStatus] = useState<TicketStatus | "">("");
  const [priority, setPriority] = useState<Priority | "">("");
  const [category, setCategory] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [branchId, setBranchId] = useState("");

  const { data: departments } = useQuery({ queryKey: ["departments"], queryFn: listDepartments, enabled: canFilterOrg });
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: listBranches, enabled: canFilterOrg });

  const { data: tickets, isLoading, error } = useQuery({
    queryKey: ["tickets", status, priority, category, departmentId, branchId],
    queryFn: () =>
      listTickets({
        status: status || undefined,
        priority: priority || undefined,
        category: category || undefined,
        departmentId: departmentId || undefined,
        branchId: branchId || undefined,
      }),
  });

  return (
    <div className="page">
      <div className="page-header d-flex justify-content-between align-items-center mb-3">
        <h1>{t("tickets.title")}</h1>
        <Link to="/tickets/new" className="btn btn-primary">{t("tickets.newTicket")}</Link>
      </div>
      <div className="filters d-flex flex-wrap gap-2 mb-3">
        <select
          className="form-select form-select-sm"
          style={{ width: "auto" }}
          value={status}
          onChange={(e) => setStatus(e.target.value as TicketStatus | "")}
        >
          <option value="">{t("tickets.allStatuses")}</option>
          <option value="Open">Open</option>
          <option value="InProgress">In Progress</option>
          <option value="Resolved">Resolved</option>
          <option value="Closed">Closed</option>
        </select>
        <select
          className="form-select form-select-sm"
          style={{ width: "auto" }}
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority | "")}
        >
          <option value="">{t("tickets.allPriorities")}</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          <option value="Urgent">Urgent</option>
        </select>
        <input
          type="text"
          placeholder="Filter by category…"
          className="form-control form-control-sm"
          style={{ width: "auto" }}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        {canFilterOrg && (
          <>
            <select
              className="form-select form-select-sm"
              style={{ width: "auto" }}
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">All departments</option>
              {departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select
              className="form-select form-select-sm"
              style={{ width: "auto" }}
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              <option value="">All branches</option>
              {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </>
        )}
      </div>
      {isLoading && <p>Loading…</p>}
      {error && <p role="alert" className="form-error">Failed to load tickets.</p>}
      {tickets && (
        <div className="table-responsive">
        <table className="table table-striped table-hover align-middle">
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
