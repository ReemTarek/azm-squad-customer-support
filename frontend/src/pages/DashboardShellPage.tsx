import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { listTickets } from "../lib/ticketsApi";
import type { Ticket } from "../lib/ticketsApi";
import { getNotificationsSummary } from "../lib/notificationsApi";
import { getReportsSummary, getReportsTrends, getAiUsageReport } from "../lib/reportsApi";
import { SlaBadge } from "../components/SlaBadge";

const SLA_SORT_ORDER: Record<Ticket["slaState"], number> = { breached: 0, at_risk: 1, on_track: 2 };

function byRecency(tickets: Ticket[]): Ticket[] {
  return [...tickets].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function bySlaUrgencyThenRecency(tickets: Ticket[]): Ticket[] {
  return [...tickets].sort((a, b) => {
    const slaDiff = SLA_SORT_ORDER[a.slaState] - SLA_SORT_ORDER[b.slaState];
    if (slaDiff !== 0) return slaDiff;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function DashboardShellPage() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const ticketsQuery = useQuery({
    queryKey: ["dashboard-tickets"],
    queryFn: () => listTickets(),
    enabled: user?.role === "Customer" || user?.role === "Agent",
  });

  const notificationsQuery = useQuery({
    queryKey: ["notifications-summary"],
    queryFn: getNotificationsSummary,
    enabled: user?.role === "Agent",
  });

  const summaryQuery = useQuery({
    queryKey: ["reports-summary"],
    queryFn: getReportsSummary,
    enabled: user?.role === "Admin" || user?.role === "Manager",
  });

  const trendsQuery = useQuery({
    queryKey: ["reports-trends"],
    queryFn: getReportsTrends,
    enabled: user?.role === "Admin" || user?.role === "Manager",
  });

  const aiUsageQuery = useQuery({
    queryKey: ["reports-ai-usage"],
    queryFn: getAiUsageReport,
    enabled: user?.role === "Admin",
  });

  const topTickets = useMemo(() => {
    if (!ticketsQuery.data) return [];
    if (user?.role === "Agent") {
      // Only surface actionable tickets in the urgency-sorted list. A ticket
      // resolved/closed after its due window keeps slaState "breached"
      // permanently (existing backend behavior), so without this filter the
      // "urgent work first" list fills up with dead closed tickets instead of
      // live at-risk work — and contradicts the SLA-alerts tile below, which
      // only counts Open/InProgress tickets.
      const actionable = ticketsQuery.data.filter((t) => t.status === "Open" || t.status === "InProgress");
      return bySlaUrgencyThenRecency(actionable).slice(0, 5);
    }
    return byRecency(ticketsQuery.data).slice(0, 5);
  }, [ticketsQuery.data, user?.role]);

  if (!user) return null;

  const isStaffReportRole = user.role === "Admin" || user.role === "Manager";

  return (
    <div className="page">
      <h1>{t("dashboard.welcome", { name: user.name })}</h1>

      {(user.role === "Customer" || user.role === "Agent") && (
        <section className="card card-body mb-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h2 className="h5 mb-0">{t("dashboard.myTickets")}</h2>
            {user.role === "Customer" && (
              <Link to="/tickets/new" className="btn btn-sm btn-primary">{t("dashboard.newTicket")}</Link>
            )}
            {user.role === "Agent" && (
              <Link to="/tickets" className="btn btn-sm btn-outline-primary">{t("dashboard.viewAllMyTickets")}</Link>
            )}
          </div>
          {ticketsQuery.error && (
            <p role="alert" className="alert alert-danger mb-0">{t("dashboard.ticketsError")}</p>
          )}
          {!ticketsQuery.error && ticketsQuery.isLoading && <p className="mb-0">{t("dashboard.loading")}</p>}
          {!ticketsQuery.error && ticketsQuery.data && topTickets.length === 0 && (
            <p className="text-muted mb-0">
              {user.role === "Customer" ? t("dashboard.noTicketsCustomer") : t("dashboard.noTicketsAgent")}
            </p>
          )}
          {!ticketsQuery.error && topTickets.length > 0 && (
            <ul className="list-group list-group-flush">
              {topTickets.map((ticket) => (
                <li key={ticket.id} className="list-group-item d-flex justify-content-between align-items-center px-0">
                  <Link to={`/tickets/${ticket.id}`}>{ticket.subject}</Link>
                  <span className="d-flex align-items-center gap-2">
                    <span className="badge bg-secondary">{ticket.status}</span>
                    <SlaBadge state={ticket.slaState} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {user.role === "Agent" && notificationsQuery.error && (
        <div className="row row-cols-1 row-cols-md-2 g-3 mb-3">
          <div className="col">
            <div className="card h-100">
              <div className="card-body">
                <h2 className="h5 card-title">{t("dashboard.slaAlerts")}</h2>
                <p role="alert" className="alert alert-danger small mb-0">{t("dashboard.slaAlertsError")}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {user.role === "Agent" && !notificationsQuery.error && notificationsQuery.data && (
        <div className="row row-cols-1 row-cols-md-2 g-3 mb-3">
          <div className="col">
            <div className="card h-100">
              <div className="card-body">
                <h2 className="h5 card-title">{t("dashboard.slaAlerts")}</h2>
                <p className="display-6 fw-bold mb-0">
                  {notificationsQuery.data.breachedCount + notificationsQuery.data.atRiskCount}
                </p>
                <p className="form-text text-muted">
                  {notificationsQuery.data.breachedCount} {t("dashboard.breached")}, {notificationsQuery.data.atRiskCount} {t("dashboard.atRisk")}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isStaffReportRole && (
        <>
          <p className="text-muted small">
            {user.role === "Admin" ? t("dashboard.scopeOrgWide") : t("dashboard.scopeDepartment")}
          </p>

          {(summaryQuery.isLoading || trendsQuery.isLoading) && <p>{t("dashboard.loading")}</p>}

          {(summaryQuery.error || trendsQuery.error) && (
            <p role="alert" className="alert alert-danger">{t("dashboard.reportError")}</p>
          )}

          {!(summaryQuery.error || trendsQuery.error) && (summaryQuery.data || trendsQuery.data) && (
            <div className="row row-cols-1 row-cols-md-2 row-cols-lg-4 g-3 mb-3">
              {summaryQuery.data?.byStatus.map((s) => (
                <div className="col" key={s.status}>
                  <div className="card h-100">
                    <div className="card-body">
                      <h2 className="h5 card-title">{s.status}</h2>
                      <p className="display-6 fw-bold mb-0">{s.count}</p>
                    </div>
                  </div>
                </div>
              ))}
              {summaryQuery.data && (
                <div className="col">
                  <div className="card h-100">
                    <div className="card-body">
                      <h2 className="h5 card-title">{t("dashboard.avgResolution")}</h2>
                      <p className="display-6 fw-bold mb-0">
                        {summaryQuery.data.avgResolutionMinutes === null ? "—" : `${summaryQuery.data.avgResolutionMinutes} min`}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {trendsQuery.data && (
                <div className="col">
                  <div className="card h-100">
                    <div className="card-body">
                      <h2 className="h5 card-title">{t("dashboard.slaBreachRate")}</h2>
                      <p className="display-6 fw-bold mb-0">{trendsQuery.data.slaBreachRatePercent}%</p>
                    </div>
                  </div>
                </div>
              )}
              {user.role === "Admin" && aiUsageQuery.error && (
                <div className="col">
                  <div className="card h-100">
                    <div className="card-body">
                      <h2 className="h5 card-title">{t("dashboard.aiTrust")}</h2>
                      <p role="alert" className="alert alert-danger small mb-0">{t("dashboard.aiTrustError")}</p>
                    </div>
                  </div>
                </div>
              )}
              {user.role === "Admin" && !aiUsageQuery.error && aiUsageQuery.data && (
                <div className="col">
                  <div className="card h-100">
                    <div className="card-body">
                      <h2 className="h5 card-title">{t("dashboard.aiTrust")}</h2>
                      <p className="display-6 fw-bold mb-0">{aiUsageQuery.data.suggestedReply.usedRatePercent}%</p>
                      <p className="form-text text-muted">{t("dashboard.aiTrustSubtext")}</p>
                      <p className="form-text text-muted">
                        {aiUsageQuery.data.chatbot.confidentRatePercent}% {t("dashboard.chatbotConfidentSubtext")}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <Link to="/reports" className="btn btn-outline-primary">{t("dashboard.viewFullReport")}</Link>
        </>
      )}
    </div>
  );
}
