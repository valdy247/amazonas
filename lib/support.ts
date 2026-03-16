import { normalizeLanguage, type AppLanguage } from "@/lib/i18n";

export const SUPPORT_CATEGORIES = ["general", "payment", "verification", "chat", "account", "provider", "bug"] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];
export type SupportStatus = "open" | "in_progress" | "resolved";

const CATEGORY_LABELS: Record<SupportCategory, Record<AppLanguage, string>> = {
  general: { es: "General", en: "General" },
  payment: { es: "Pago", en: "Payment" },
  verification: { es: "Verificacion", en: "Verification" },
  chat: { es: "Mensajeria", en: "Messaging" },
  account: { es: "Cuenta", en: "Account" },
  provider: { es: "Proveedor", en: "Provider" },
  bug: { es: "Error tecnico", en: "Bug" },
};

const STATUS_LABELS: Record<SupportStatus, Record<AppLanguage, string>> = {
  open: { es: "Abierto", en: "Open" },
  in_progress: { es: "En proceso", en: "In progress" },
  resolved: { es: "Resuelto", en: "Resolved" },
};

export function getSupportCategoryLabel(category: string, language: AppLanguage) {
  const normalized = SUPPORT_CATEGORIES.includes(category as SupportCategory) ? (category as SupportCategory) : "general";
  return CATEGORY_LABELS[normalized][normalizeLanguage(language)];
}

export function getSupportStatusLabel(status: string, language: AppLanguage) {
  const normalized = ["open", "in_progress", "resolved"].includes(status) ? (status as SupportStatus) : "open";
  return STATUS_LABELS[normalized][normalizeLanguage(language)];
}
