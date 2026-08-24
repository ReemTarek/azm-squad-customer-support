import { useQuery } from "@tanstack/react-query";
import { getReportsSummary } from "../lib/reportsApi";

export function ReportsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["reports-summary"], queryFn: getReportsSummary });

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p role="alert" className="form-error">Failed to load report.</p>;
  if (!data) return null;

  return (
    <div className="page">
      <h1>Reports</h1>
      <div className="report-grid">
        <section className="report-card">
          <h2>Tickets by status</h2>
          <ul>
            {data.byStatus.map((s) => <li key={s.status}>{s.status}: {s.count}</li>)}
          </ul>
        </section>
        <section className="report-card">
          <h2>Tickets by priority</h2>
          <ul>
            {data.byPriority.map((p) => <li key={p.priority}>{p.priority}: {p.count}</li>)}
          </ul>
        </section>
        <section className="report-card">
          <h2>Avg. resolution time</h2>
          <p className="report-stat">
            {data.avgResolutionMinutes === null ? "No resolved tickets yet" : `${data.avgResolutionMinutes} min`}
          </p>
        </section>
        <section className="report-card">
          <h2>Tickets per agent</h2>
          <ul>
            {data.ticketsPerAgent.map((a) => <li key={a.agentId}>{a.agentName}: {a.count}</li>)}
            {data.ticketsPerAgent.length === 0 && <li>No assignments yet.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
