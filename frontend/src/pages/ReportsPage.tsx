import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getReportsSummary, getReportsTrends } from "../lib/reportsApi";
import { escalateOverdueTickets } from "../lib/notificationsApi";

export function ReportsPage() {
  const queryClient = useQueryClient();
  const summaryQuery = useQuery({ queryKey: ["reports-summary"], queryFn: getReportsSummary });
  const trendsQuery = useQuery({ queryKey: ["reports-trends"], queryFn: getReportsTrends });
  const [escalationResult, setEscalationResult] = useState<string | null>(null);

  const escalateMutation = useMutation({
    mutationFn: escalateOverdueTickets,
    onSuccess: (result) => {
      setEscalationResult(`Escalated ${result.escalatedCount} overdue ticket${result.escalatedCount === 1 ? "" : "s"} to Urgent.`);
      queryClient.invalidateQueries({ queryKey: ["notifications-summary"] });
      queryClient.invalidateQueries({ queryKey: ["reports-trends"] });
    },
  });

  if (summaryQuery.isLoading) return <p>Loading…</p>;
  if (summaryQuery.error) return <p role="alert" className="form-error">Failed to load report.</p>;
  const data = summaryQuery.data;
  if (!data) return null;

  const trends = trendsQuery.data;
  const maxDayCount = trends ? Math.max(1, ...trends.ticketsCreatedPerDay.map((d) => d.count)) : 1;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Reports</h1>
        <button
          type="button"
          className="secondary-button"
          onClick={() => escalateMutation.mutate()}
          disabled={escalateMutation.isPending}
        >
          {escalateMutation.isPending ? "Checking…" : "Escalate Overdue Tickets"}
        </button>
      </div>
      {escalationResult && <p className="form-success">{escalationResult}</p>}
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
        {trends && (
          <section className="report-card">
            <h2>SLA breach rate</h2>
            <p className="report-stat">{trends.slaBreachRatePercent}%</p>
            <p className="form-hint">{trends.totalBreached} of {trends.totalResolved} resolved tickets breached SLA</p>
          </section>
        )}
        {trends && (
          <section className="report-card">
            <h2>Customer satisfaction</h2>
            <p className="report-stat">{trends.avgCsatRating === null ? "No ratings yet" : `${trends.avgCsatRating} / 5`}</p>
            <p className="form-hint">{trends.csatCount} rating{trends.csatCount === 1 ? "" : "s"} submitted</p>
          </section>
        )}
        {trends && (
          <section className="report-card">
            <h2>Agent performance</h2>
            <ul>
              {trends.agentPerformance.map((a) => (
                <li key={a.agentId}>{a.agentName}: {a.resolvedCount} resolved, avg {a.avgResolutionMinutes} min</li>
              ))}
              {trends.agentPerformance.length === 0 && <li>No resolved tickets yet.</li>}
            </ul>
          </section>
        )}
      </div>

      {trends && (
        <section className="report-card trend-card">
          <h2>Tickets created (last 7 days)</h2>
          <div className="trend-bars">
            {trends.ticketsCreatedPerDay.map((d) => (
              <div key={d.date} className="trend-bar-col">
                <div className="trend-bar" style={{ height: `${(d.count / maxDayCount) * 80 + 4}px` }} />
                <span className="trend-bar-label">{d.date.slice(5)}</span>
                <span className="trend-bar-count">{d.count}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
