import { Link, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { getNotificationsSummary } from "../lib/notificationsApi";
import { useBranding } from "../context/BrandingContext";

export function Layout() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const { appName, logoUrl } = useBranding();
  const notificationsQuery = useQuery({
    queryKey: ["notifications-summary"],
    queryFn: getNotificationsSummary,
    enabled: Boolean(user),
    refetchInterval: 30_000,
  });

  if (!user) return null;

  const alertCount = (notificationsQuery.data?.breachedCount ?? 0) + (notificationsQuery.data?.atRiskCount ?? 0);

  return (
    <div className="d-flex flex-column min-vh-100">
      <nav className="navbar navbar-expand-lg navbar-light bg-white border-bottom px-3">
        <div className="container-fluid">
          <Link to="/" className="navbar-brand fw-bold d-flex align-items-center gap-2">
            {logoUrl && <img src={logoUrl} alt="" style={{ height: 28 }} />}
            {appName ?? t("nav.brand")}
          </Link>
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#main-nav-collapse"
            aria-controls="main-nav-collapse"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon" />
          </button>
          <div className="collapse navbar-collapse" id="main-nav-collapse">
            <ul className="navbar-nav me-auto mb-2 mb-lg-0 gap-lg-1">
              {(user.role === "Admin" || user.role === "Manager" || user.role === "Agent") && (
                <li className="nav-item"><Link to="/customers" className="nav-link">{t("nav.customers")}</Link></li>
              )}
              <li className="nav-item">
                <Link to="/tickets" className="nav-link">
                  {t("nav.tickets")}
                  {alertCount > 0 && (
                    <span
                      className="badge bg-danger rounded-pill ms-1"
                      title={`${notificationsQuery.data?.breachedCount ?? 0} breached, ${notificationsQuery.data?.atRiskCount ?? 0} at risk`}
                    >
                      {alertCount}
                    </span>
                  )}
                </Link>
              </li>
              <li className="nav-item"><Link to="/kb" className="nav-link">{t("nav.kb")}</Link></li>
              {user.role === "Customer" && (
                <li className="nav-item"><Link to="/chat" className="nav-link">Ask a Question</Link></li>
              )}
              {(user.role === "Admin" || user.role === "Manager" || user.role === "Agent") && (
                <li className="nav-item"><Link to="/quick-replies" className="nav-link">Quick Replies</Link></li>
              )}
              {(user.role === "Admin" || user.role === "Manager" || user.role === "Agent") && (
                <li className="nav-item"><Link to="/live-chat" className="nav-link">Live Chat</Link></li>
              )}
              {(user.role === "Admin" || user.role === "Manager") && (
                <li className="nav-item"><Link to="/reports" className="nav-link">{t("nav.reports")}</Link></li>
              )}
              {user.role === "Admin" && (
                <li className="nav-item"><Link to="/audit-log" className="nav-link">Audit Log</Link></li>
              )}
              {user.role === "Admin" && (
                <li className="nav-item"><Link to="/admin/sla-settings" className="nav-link">SLA Settings</Link></li>
              )}
              {user.role === "Admin" && (
                <li className="nav-item"><Link to="/admin/org-settings" className="nav-link">Departments &amp; Branches</Link></li>
              )}
              {user.role === "Admin" && (
                <li className="nav-item"><Link to="/admin/branding" className="nav-link">Branding</Link></li>
              )}
              {user.role === "Admin" && (
                <li className="nav-item"><Link to="/admin/users" className="nav-link">Users</Link></li>
              )}
            </ul>
            <div className="d-flex align-items-center gap-2">
              <LanguageSwitcher />
              <span className="text-secondary small text-nowrap">{user.name} ({user.role})</span>
              <button className="btn btn-outline-secondary btn-sm" onClick={logout}>{t("nav.logout")}</button>
            </div>
          </div>
        </div>
      </nav>
      <main className="flex-grow-1 container-fluid px-3 px-md-4 py-4">
        <Outlet />
      </main>
    </div>
  );
}
