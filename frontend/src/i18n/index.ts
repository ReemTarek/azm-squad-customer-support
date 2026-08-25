import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ar from "./locales/ar.json";
import bootstrapLtrUrl from "bootstrap/dist/css/bootstrap.min.css?url";
import bootstrapRtlUrl from "bootstrap/dist/css/bootstrap.rtl.min.css?url";

const STORAGE_KEY = "azm_crm_locale";
const BOOTSTRAP_LINK_ID = "bootstrap-css";

export type SupportedLocale = "en" | "ar";

export function getStoredLocale(): SupportedLocale {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "ar" ? "ar" : "en";
}

function applyBootstrapBundle(locale: SupportedLocale) {
  let link = document.getElementById(BOOTSTRAP_LINK_ID) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = BOOTSTRAP_LINK_ID;
    link.rel = "stylesheet";
    document.head.prepend(link);
  }
  link.href = locale === "ar" ? bootstrapRtlUrl : bootstrapLtrUrl;
}

export function applyDirection(locale: SupportedLocale) {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  applyBootstrapBundle(locale);
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
