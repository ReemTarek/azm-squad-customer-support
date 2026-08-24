import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ar from "./locales/ar.json";

const STORAGE_KEY = "azm_crm_locale";

export type SupportedLocale = "en" | "ar";

export function getStoredLocale(): SupportedLocale {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "ar" ? "ar" : "en";
}

export function applyDirection(locale: SupportedLocale) {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
}

export function setLocale(locale: SupportedLocale) {
  localStorage.setItem(STORAGE_KEY, locale);
  i18n.changeLanguage(locale);
  applyDirection(locale);
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ar: { translation: ar } },
  lng: getStoredLocale(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

applyDirection(getStoredLocale());

export default i18n;
