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
      <div className="page-header d-flex justify-content-between align-items-center mb-3">
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
      <div className="row row-cols-1 row-cols-md-2 row-cols-lg-4 g-3">
        <div className="col">
          <div className="card h-100">
            <div className="card-body">
              <h2>Tickets by status</h2>
              <ul>
                {data.byStatus.map((s) => <li key={s.status}>{s.status}: {s.count}</li>)}
              </ul>
            </div>
          </div>
        </div>
        <div className="col">
          <div className="card h-100">
            <div className="card-body">
              <h2>Tickets by priority</h2>
              <ul>
                {data.byPriority.map((p) => <li key={p.priority}>{p.priority}: {p.count}</li>)}
              </ul>
            </div>
          </div>
        </div>
        <div className="col">
          <div className="card h-100">
            <div className="card-body">
              <h2>Avg. resolution time</h2>
              <p className="display-6 fw-bold mb-0">
                {data.avgResolutionMinutes === null ? "No resolved tickets yet" : `${data.avgResolutionMinutes} min`}
              </p>
            </div>
          </div>
        </div>
        {data.byDepartment.length > 0 && (
          <div className="col">
            <div className="card h-100">
              <div className="card-body">
                <h2>Tickets by department</h2>
                <ul>
                  {data.byDepartment.map((d) => <li key={d.departmentId}>{d.departmentName}: {d.count}</li>)}
                </ul>
              </div>
            </div>
          </div>
        )}
        <div className="col">
          <div className="card h-100">
            <div className="card-body">
              <h2>Tickets per agent</h2>
              <ul>
                {data.ticketsPerAgent.map((a) => <li key={a.agentId}>{a.agentName}: {a.count}</li>)}
                {data.ticketsPerAgent.length === 0 && <li>No assignments yet.</li>}
              </ul>
            </div>
          </div>
        </div>
        {trends && (
          <div className="col">
            <div className="card h-100">
              <div className="card-body">
                <h2>SLA breach rate</h2>
                <p className="display-6 fw-bold mb-0">{trends.slaBreachRatePercent}%</p>
                <p className="form-hint">{trends.totalBreached} of {trends.totalResolved} resolved tickets breached SLA</p>
              </div>
            </div>
          </div>
        )}
        {trends && (
          <div className="col">
            <div className="card h-100">
              <div className="card-body">
                <h2>Customer satisfaction</h2>
                <p className="display-6 fw-bold mb-0">{trends.avgCsatRating === null ? "No ratings yet" : `${trends.avgCsatRating} / 5`}</p>
                <p className="form-hint">{trends.csatCount} rating{trends.csatCount === 1 ? "" : "s"} submitted</p>
              </div>
            </div>
          </div>
        )}
        {trends && (
          <div className="col">
            <div className="card h-100">
              <div className="card-body">
                <h2>Agent performance</h2>
                <ul>
                  {trends.agentPerformance.map((a) => (
                    <li key={a.agentId}>{a.agentName}: {a.resolvedCount} resolved, avg {a.avgResolutionMinutes} min</li>
                  ))}
                  {trends.agentPerformance.length === 0 && <li>No resolved tickets yet.</li>}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {trends && (
        <section className="trend-card card card-body mt-3">
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
