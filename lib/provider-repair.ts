import { sanitizeProviderDraft } from "@/lib/provider-quality";

export type RepairContactRow = {
  id: number;
  title: string;
  email?: string | null;
  network: string | null;
  url: string;
  notes?: string | null;
  is_active: boolean;
  is_verified: boolean;
  contact_methods?: string | null;
};

export type ProviderRepairSuggestion = {
  contactId: number;
  reason: string;
  severity: "info" | "warning" | "high";
  email: string;
  whatsapp: string;
  instagram: string;
  messenger: string;
  facebook: string;
  changedFields: string[];
};

export function buildProviderRepairSuggestion(contact: RepairContactRow): ProviderRepairSuggestion | null {
  const sanitized = sanitizeProviderDraft(contact);
  const changedFields = sanitized.changedFields;

  const reasons: string[] = [];
  if (changedFields.length) {
    reasons.push(`Campos reparables: ${changedFields.join(", ")}`);
  }
  if (!sanitized.email && String(contact.email || "").trim()) {
    reasons.push("Email con formato dudoso");
  }
  if (changedFields.includes("whatsapp") && !sanitized.whatsapp) {
    reasons.push("WhatsApp invalido o demasiado corto");
  }
  if (String(contact.url || "").trim() && contact.url !== "#" && !/^https?:\/\//i.test(contact.url) && !String(contact.network || "").toLowerCase().includes("email")) {
    reasons.push("URL base incompleta");
  }

  if (!reasons.length) {
    return null;
  }

  const severity =
    reasons.some((reason) => reason.includes("invalido") || reason.includes("dudoso"))
      ? "warning"
      : changedFields.length >= 2
        ? "high"
        : "info";

  return {
    contactId: contact.id,
    reason: reasons.join(" | "),
    severity,
    email: sanitized.email,
    whatsapp: sanitized.whatsapp,
    instagram: sanitized.instagram,
    messenger: sanitized.messenger,
    facebook: sanitized.facebook,
    changedFields,
  };
}
