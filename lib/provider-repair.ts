import { getContactFieldValues, normalizeContactValue } from "@/lib/provider-contact";

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

function cleanEmail(raw?: string | null) {
  const match = String(raw || "")
    .trim()
    .match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : "";
}

function cleanPhone(raw?: string | null) {
  const value = String(raw || "").trim();
  const match = value.match(/\+?\d[\d\s().-]{7,}\d/);
  return match ? match[0].replace(/[^\d+]/g, "") : "";
}

function cleanUrl(raw?: string | null, type?: "facebook" | "instagram" | "messenger") {
  const value = String(raw || "").trim();
  if (!value) {
    return "";
  }

  const directMatch = value.match(/https?:\/\/[^\s<>"']+/i)?.[0] || "";
  const domainLikeMatch =
    value.match(
      type === "facebook"
        ? /(www\.)?facebook\.com\/[^\s<>"']+/i
        : type === "instagram"
          ? /(www\.)?instagram\.com\/[^\s<>"']+/i
          : /(www\.)?(m\.me|messenger\.com)\/[^\s<>"']+/i
    )?.[0] || "";
  const candidate = directMatch || domainLikeMatch || value;

  if (/^https?:\/\//i.test(candidate)) {
    return candidate.replace(/\/+$/, "");
  }

  if (type === "facebook" && (/^(www\.)?facebook\.com\//i.test(candidate) || /^share\//i.test(candidate) || /^profile\.php\?/i.test(candidate))) {
    return candidate.startsWith("http") ? candidate : `https://facebook.com/${candidate.replace(/^(www\.)?facebook\.com\//i, "").replace(/^\/+/, "")}`.replace("https://facebook.com/https://facebook.com/", "https://facebook.com/");
  }

  if (type === "instagram" && /^(www\.)?instagram\.com\//i.test(candidate)) {
    return candidate.startsWith("http") ? candidate : `https://${candidate}`.replace(/\/+$/, "");
  }

  if (type === "messenger" && (/^(www\.)?(m\.me|messenger\.com)\//i.test(candidate) || /^messages?\//i.test(candidate) || /^profile\.php\?id=/i.test(candidate))) {
    if (candidate.startsWith("http")) {
      return candidate.replace(/\/+$/, "");
    }
    const cleaned = candidate.replace(/^(www\.)?(m\.me|messenger\.com)\//i, "").replace(/^\/+/, "");
    return /^profile\.php\?id=/i.test(cleaned)
      ? `https://messenger.com/${cleaned}`
      : `https://m.me/${cleaned}`.replace(/\/+$/, "");
  }

  return candidate;
}

export function buildProviderRepairSuggestion(contact: RepairContactRow): ProviderRepairSuggestion | null {
  const fields = getContactFieldValues(contact.contact_methods, contact.url, contact.network);
  const cleanedEmail = cleanEmail(contact.email || fields.email);
  const cleanedWhatsapp = cleanPhone(fields.whatsapp);
  const cleanedInstagram = cleanUrl(fields.instagram, "instagram");
  const cleanedMessenger = cleanUrl(fields.messenger, "messenger");
  const cleanedFacebook = cleanUrl(fields.facebook || (String(contact.network || "").toLowerCase().includes("facebook") ? contact.url : ""), "facebook");
  const changedFields: string[] = [];

  if (cleanedEmail && cleanedEmail !== String(contact.email || "").trim().toLowerCase()) changedFields.push("email");
  if (cleanedWhatsapp && normalizeContactValue(cleanedWhatsapp) !== normalizeContactValue(fields.whatsapp)) changedFields.push("whatsapp");
  if (cleanedInstagram && normalizeContactValue(cleanedInstagram) !== normalizeContactValue(fields.instagram)) changedFields.push("instagram");
  if (cleanedMessenger && normalizeContactValue(cleanedMessenger) !== normalizeContactValue(fields.messenger)) changedFields.push("messenger");
  if (cleanedFacebook && normalizeContactValue(cleanedFacebook) !== normalizeContactValue(fields.facebook || contact.url)) changedFields.push("facebook");

  const reasons: string[] = [];
  if (changedFields.length) {
    reasons.push(`Campos reparables: ${changedFields.join(", ")}`);
  }
  if (!cleanedEmail && contact.email) {
    reasons.push("Email con formato dudoso");
  }
  if ((fields.whatsapp || "").trim() && !cleanedWhatsapp) {
    reasons.push("WhatsApp con formato dudoso");
  }
  if (String(contact.url || "").trim() && contact.url !== "#" && !/^https?:\/\//i.test(contact.url) && !String(contact.network || "").toLowerCase().includes("email")) {
    reasons.push("URL base incompleta");
  }

  if (!reasons.length) {
    return null;
  }

  const severity =
    reasons.some((reason) => reason.includes("dudoso")) ? "warning" : changedFields.length >= 2 ? "high" : "info";

  return {
    contactId: contact.id,
    reason: reasons.join(" · "),
    severity,
    email: cleanedEmail || String(contact.email || "").trim().toLowerCase(),
    whatsapp: cleanedWhatsapp || fields.whatsapp,
    instagram: cleanedInstagram || fields.instagram,
    messenger: cleanedMessenger || fields.messenger,
    facebook: cleanedFacebook || fields.facebook,
    changedFields,
  };
}
