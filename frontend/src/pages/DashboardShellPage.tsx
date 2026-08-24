import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";

export function DashboardShellPage() {
  const { user } = useAuth();
  const { t } = useTranslation();

  return (
    <div className="page">
      <h1>{t("dashboard.welcome", { name: user?.name })}</h1>
      <p>{t("dashboard.subtitle")}</p>
    </div>
  );
}
