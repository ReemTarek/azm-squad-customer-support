import { Link, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { getNotificationsSummary } from "../lib/notificationsApi";

export function Layout() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const notificationsQuery = useQuery({
    queryKey: ["notifications-summary"],
    queryFn: getNotificationsSummary,
    enabled: Boolean(user),
    refetchInterval: 30_000,
  });

  if (!user) return null;

  const alertCount = (notificationsQuery.data?.breachedCount ?? 0) + (notificationsQuery.data?.atRiskCount ?? 0);

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">{t("nav.brand")}</Link>
        <nav>
          {(user.role === "Admin" || user.role === "Manager" || user.role === "Agent") && (
            <Link to="/customers">{t("nav.customers")}</Link>
          )}
          <Link to="/tickets" className="nav-link-with-badge">
            {t("nav.tickets")}
            {alertCount > 0 && (
              <span
                className="notification-badge"
                title={`${notificationsQuery.data?.breachedCount ?? 0} breached, ${notificationsQuery.data?.atRiskCount ?? 0} at risk`}
              >
                {alertCount}
              </span>
            )}
          </Link>
          <Link to="/kb">{t("nav.kb")}</Link>
          {(user.role === "Admin" || user.role === "Manager" || user.role === "Agent") && (
            <Link to="/quick-replies">Quick Replies</Link>
          )}
          {(user.role === "Admin" || user.role === "Manager") && <Link to="/reports">{t("nav.reports")}</Link>}
          {user.role === "Admin" && <Link to="/audit-log">Audit Log</Link>}
          {user.role === "Admin" && <Link to="/admin/sla-settings">SLA Settings</Link>}
        </nav>
        <div className="app-header-user">
          <LanguageSwitcher />
          <span>{user.name} ({user.role})</span>
          <button onClick={logout}>{t("nav.logout")}</button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
