import { Link, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function Layout() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  if (!user) return null;

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">{t("nav.brand")}</Link>
        <nav>
          {(user.role === "Admin" || user.role === "Manager" || user.role === "Agent") && (
            <Link to="/customers">{t("nav.customers")}</Link>
          )}
          <Link to="/tickets">{t("nav.tickets")}</Link>
          <Link to="/kb">{t("nav.kb")}</Link>
          {(user.role === "Admin" || user.role === "Manager" || user.role === "Agent") && (
            <Link to="/quick-replies">Quick Replies</Link>
          )}
          {(user.role === "Admin" || user.role === "Manager") && <Link to="/reports">{t("nav.reports")}</Link>}
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
