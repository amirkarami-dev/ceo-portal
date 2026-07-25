import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import fa from "./locales/fa.json";
import en from "./locales/en.json";

export type AppLocale = "fa" | "en";

i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fa: { translation: fa },
      en: { translation: en },
    },
    fallbackLng: "fa",
    supportedLngs: ["fa", "en"],
    interpolation: { escapeValue: false },
    detection: { order: ["localStorage", "navigator"], lookupLocalStorage: "report.locale" },
  });

export const i18n = i18next;

export function applyLocale(locale: AppLocale): void {
  const dir = locale === "fa" ? "rtl" : "ltr";
  document.documentElement.lang = locale;
  document.documentElement.dir = dir;
  void i18next.changeLanguage(locale);
}
