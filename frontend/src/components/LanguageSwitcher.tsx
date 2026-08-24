import { useTranslation } from "react-i18next";
import { getStoredLocale, setLocale } from "../i18n";
import type { SupportedLocale } from "../i18n";

export function LanguageSwitcher() {
  const { t } = useTranslation();

  return (
    <select
      aria-label={t("language.label")}
      className="form-select form-select-sm"
      defaultValue={getStoredLocale()}
      onChange={(e) => setLocale(e.target.value as SupportedLocale)}
    >
      <option value="en">{t("language.english")}</option>
      <option value="ar">{t("language.arabic")}</option>
    </select>
  );
}
