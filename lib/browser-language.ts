import { normalizeLanguage, type AppLanguage } from "@/lib/i18n";

export function getBrowserAppLanguage(): AppLanguage {
  if (typeof window === "undefined") {
    return "es";
  }

  const browserLanguage = window.navigator.language.toLowerCase();
  return normalizeLanguage(browserLanguage.startsWith("en") ? "en" : "es");
}
