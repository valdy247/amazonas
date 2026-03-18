import { getContactFieldValues } from "@/lib/provider-contact";

export type ProviderHealthContact = {
  id: number;
  title: string;
  email?: string | null;
  network: string | null;
  url: string;
  notes?: string | null;
  contact_methods?: string | null;
};

export type ProviderHealthStatus = "healthy" | "warning" | "broken";

export type ProviderHealthCheckItem = {
  field: "email" | "whatsapp" | "instagram" | "messenger" | "facebook";
  label: string;
  value: string;
  status: ProviderHealthStatus;
  note: string;
};

export type ProviderHealthCheckResult = {
  contactId: number;
  checkedAt: string;
  overallStatus: ProviderHealthStatus;
  summary: string;
  items: ProviderHealthCheckItem[];
};

function hasValidEmail(value: string) {
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value);
}

function normalizePhoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

function getUrlLabelFromValue(value: string) {
  if (value.includes("instagram.com")) return "Instagram";
  if (value.includes("facebook.com")) return "Facebook";
  if (value.includes("m.me") || value.includes("messenger.com")) return "Messenger";
  return "Link";
}

async function fetchUrlStatus(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "VerifyzonHealthCheck/1.0",
      },
    });

    return {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function runProviderHealthCheck(contact: ProviderHealthContact): Promise<ProviderHealthCheckResult> {
  const values = getContactFieldValues(contact.contact_methods, contact.url, contact.network);
  const items: ProviderHealthCheckItem[] = [];

  const email = String(contact.email || values.email || "").trim().toLowerCase();
  if (email) {
    items.push({
      field: "email",
      label: "Email",
      value: email,
      status: hasValidEmail(email) ? "healthy" : "broken",
      note: hasValidEmail(email) ? "Email format looks valid." : "Email format is invalid.",
    });
  }

  const whatsapp = String(values.whatsapp || "").trim();
  if (whatsapp) {
    const digits = normalizePhoneDigits(whatsapp);
    if (digits.length < 8 || digits.length > 15) {
      items.push({
        field: "whatsapp",
        label: "WhatsApp",
        value: whatsapp,
        status: "broken",
        note: "Phone format is too short or too long for a plausible WhatsApp number.",
      });
    } else {
      items.push({
        field: "whatsapp",
        label: "WhatsApp",
        value: `+${digits}`,
        status: "warning",
        note: "Phone format looks plausible, but Verifyzon cannot confirm WhatsApp registration automatically.",
      });
    }
  }

  const socialCandidates = [
    { field: "instagram" as const, value: String(values.instagram || "").trim() },
    { field: "messenger" as const, value: String(values.messenger || "").trim() },
    { field: "facebook" as const, value: String(values.facebook || "").trim() },
  ].filter((item) => item.value);

  for (const candidate of socialCandidates) {
    const value = candidate.value.startsWith("http") ? candidate.value : `https://${candidate.value}`;

    try {
      const result = await fetchUrlStatus(value);
      if (result.ok) {
        items.push({
          field: candidate.field,
          label: getUrlLabelFromValue(value),
          value,
          status: result.finalUrl !== value ? "warning" : "healthy",
          note:
            result.finalUrl !== value
              ? `Link responds but redirects to ${result.finalUrl}.`
              : "Link responds correctly.",
        });
        continue;
      }

      if (result.status === 401 || result.status === 403) {
        items.push({
          field: candidate.field,
          label: getUrlLabelFromValue(value),
          value,
          status: "warning",
          note: "Link is restricted or requires a logged-in session.",
        });
        continue;
      }

      items.push({
        field: candidate.field,
        label: getUrlLabelFromValue(value),
        value,
        status: result.status === 404 || result.status === 410 ? "broken" : "warning",
        note: `Link responded with HTTP ${result.status}.`,
      });
    } catch {
      items.push({
        field: candidate.field,
        label: getUrlLabelFromValue(value),
        value,
        status: "warning",
        note: "Link could not be checked reliably right now.",
      });
    }
  }

  const overallStatus: ProviderHealthStatus = items.some((item) => item.status === "broken")
    ? "broken"
    : items.some((item) => item.status === "warning")
      ? "warning"
      : "healthy";

  const summary =
    overallStatus === "broken"
      ? "At least one contact method looks broken."
      : overallStatus === "warning"
        ? "Some contact methods need manual review."
        : "All checked methods look technically healthy.";

  return {
    contactId: contact.id,
    checkedAt: new Date().toISOString(),
    overallStatus,
    summary,
    items,
  };
}
