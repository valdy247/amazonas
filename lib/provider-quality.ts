import { getComparableContactMethods, getContactFieldValues, normalizeContactValue } from "@/lib/provider-contact";

type ProviderDraftInput = {
  email?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  messenger?: string | null;
  facebook?: string | null;
  network?: string | null;
  url?: string | null;
  contact_methods?: string | null;
};

export type SanitizedProviderDraft = {
  email: string;
  whatsapp: string;
  instagram: string;
  messenger: string;
  facebook: string;
  changedFields: string[];
  validMethodCount: number;
};

export function sanitizeProviderEmail(raw?: string | null) {
  const match = String(raw || "")
    .trim()
    .match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : "";
}

export function sanitizeProviderPhone(raw?: string | null) {
  const value = String(raw || "").trim();
  const match = value.match(/\+?\d[\d\s().-]{7,}\d/);
  if (!match) {
    return "";
  }

  const normalized = match[0].replace(/[^\d+]/g, "");
  const digits = normalized.replace(/\D/g, "");

  if (digits.length < 8 || digits.length > 15) {
    return "";
  }

  return normalized.startsWith("+") ? normalized : `+${digits}`;
}

export function sanitizeProviderUrl(raw?: string | null, type?: "facebook" | "instagram" | "messenger") {
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

  if (
    type === "facebook" &&
    (/^(www\.)?facebook\.com\//i.test(candidate) || /^share\//i.test(candidate) || /^profile\.php\?/i.test(candidate))
  ) {
    return candidate.startsWith("http")
      ? candidate.replace(/\/+$/, "")
      : `https://facebook.com/${candidate.replace(/^(www\.)?facebook\.com\//i, "").replace(/^\/+/, "")}`.replace(
          "https://facebook.com/https://facebook.com/",
          "https://facebook.com/"
        );
  }

  if (type === "instagram" && /^(www\.)?instagram\.com\//i.test(candidate)) {
    return candidate.startsWith("http") ? candidate.replace(/\/+$/, "") : `https://${candidate}`.replace(/\/+$/, "");
  }

  if (
    type === "messenger" &&
    (/^(www\.)?(m\.me|messenger\.com)\//i.test(candidate) || /^messages?\//i.test(candidate) || /^profile\.php\?id=/i.test(candidate))
  ) {
    if (candidate.startsWith("http")) {
      return candidate.replace(/\/+$/, "");
    }
    const cleaned = candidate.replace(/^(www\.)?(m\.me|messenger\.com)\//i, "").replace(/^\/+/, "");
    return /^profile\.php\?id=/i.test(cleaned) ? `https://messenger.com/${cleaned}` : `https://m.me/${cleaned}`.replace(/\/+$/, "");
  }

  return "";
}

export function sanitizeProviderDraft(input: ProviderDraftInput): SanitizedProviderDraft {
  const fields = getContactFieldValues(input.contact_methods, input.url, input.network);
  const rawEmail = String(input.email || fields.email || "").trim().toLowerCase();
  const rawWhatsapp = String(input.whatsapp || fields.whatsapp || "").trim();
  const rawInstagram = String(input.instagram || fields.instagram || "").trim();
  const rawMessenger = String(input.messenger || fields.messenger || "").trim();
  const rawFacebook = String(input.facebook || fields.facebook || "").trim();

  const email = sanitizeProviderEmail(rawEmail);
  const whatsapp = sanitizeProviderPhone(rawWhatsapp);
  const instagram = sanitizeProviderUrl(rawInstagram, "instagram");
  const messenger = sanitizeProviderUrl(rawMessenger, "messenger");
  const facebook = sanitizeProviderUrl(rawFacebook, "facebook");

  const changedFields: string[] = [];
  if (email !== rawEmail) changedFields.push("email");
  if (normalizeContactValue(whatsapp) !== normalizeContactValue(rawWhatsapp)) changedFields.push("whatsapp");
  if (normalizeContactValue(instagram) !== normalizeContactValue(rawInstagram)) changedFields.push("instagram");
  if (normalizeContactValue(messenger) !== normalizeContactValue(rawMessenger)) changedFields.push("messenger");
  if (normalizeContactValue(facebook) !== normalizeContactValue(rawFacebook)) changedFields.push("facebook");

  return {
    email,
    whatsapp,
    instagram,
    messenger,
    facebook,
    changedFields,
    validMethodCount: [email, whatsapp, instagram, messenger, facebook].filter(Boolean).length,
  };
}

export function buildDuplicateContactGroups<T extends { id: number; email?: string | null; contact_methods?: string | null; url: string; network: string | null }>(
  contacts: T[]
) {
  const buckets = new Map<string, number[]>();

  for (const contact of contacts) {
    const email = sanitizeProviderEmail(contact.email);
    const methods = getComparableContactMethods(contact.contact_methods, contact.url, contact.network);

    if (email) {
      const key = `email:${email}`;
      buckets.set(key, [...(buckets.get(key) || []), contact.id]);
    }

    for (const method of methods) {
      const key = `method:${method}`;
      buckets.set(key, [...(buckets.get(key) || []), contact.id]);
    }
  }

  return Array.from(buckets.entries())
    .map(([key, ids]) => ({ key, ids: Array.from(new Set(ids)).sort((a, b) => a - b) }))
    .filter((group) => group.ids.length > 1);
}
