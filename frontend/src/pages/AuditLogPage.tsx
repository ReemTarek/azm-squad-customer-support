import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listAuditLogs } from "../lib/auditLogsApi";

const ENTITY_TYPES = ["Ticket", "User", "KnowledgeBaseArticle"];

export function AuditLogPage() {
  const [entityType, setEntityType] = useState("");
  const { data: logs, isLoading, error } = useQuery({
    queryKey: ["audit-logs", entityType],
    queryFn: () => listAuditLogs(entityType || undefined),
  });

  return (
    <div className="page">
      <h1>Audit Log</h1>
      <div className="filters d-flex flex-wrap gap-2 mb-3">
        <select
          className="form-select form-select-sm"
          style={{ width: "auto" }}
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
        >
          <option value="">All entity types</option>
          {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      {isLoading && <p>Loading…</p>}
      {error && <p role="alert" className="alert alert-danger">Failed to load audit log.</p>}
      {logs && (
        <div className="table-responsive">
          <table className="table table-striped table-hover align-middle">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>{new Date(l.createdAt).toLocaleString()}</td>
                  <td>{l.actorName} ({l.actorEmail})</td>
                  <td>{l.action}</td>
                  <td>{l.entityType}: {l.entityId.slice(0, 8)}…</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={4}>No audit log entries yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
