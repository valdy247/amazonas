import { getContactFieldValues } from "@/lib/provider-contact";

export type ProviderLinkReviewContact = {
  id: number;
  title: string;
  network: string | null;
  url: string;
  contact_methods?: string | null;
};

export type ProviderLinkReviewStatus = "healthy" | "warning" | "broken";

export type ProviderLinkReviewItem = {
  field: "instagram" | "messenger" | "facebook";
  label: string;
  value: string;
  finalUrl: string;
  status: ProviderLinkReviewStatus;
  note: string;
};

export type ProviderLinkReviewResult = {
  contactId: number;
  checkedAt: string;
  overallStatus: ProviderLinkReviewStatus;
  summary: string;
  items: ProviderLinkReviewItem[];
};

const UNAVAILABLE_PATTERNS = [
  "este contenido no está disponible",
  "este contenido no esta disponible",
  "contenido no disponible",
  "this content isn't available",
  "this content is not available",
  "content isn't available right now",
  "content is not available right now",
  "page isn't available",
  "page is not available",
];

const RESTRICTED_PATTERNS = [
  "inicia sesión en facebook",
  "iniciar sesión en facebook",
  "log into facebook",
  "log in to facebook",
  "you must log in",
];

function getUrlLabelFromValue(value: string) {
  if (value.includes("instagram.com")) return "Instagram";
  if (value.includes("m.me") || value.includes("messenger.com")) return "Messenger";
  return "Facebook";
}

function normalizeSocialUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

async function fetchVisualStatus(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; VerifyzonLinkReview/1.0)",
        "Accept-Language": "es,en;q=0.9",
      },
    });

    const html = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      html,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function detectVisualStatus(input: { html: string; finalUrl: string; statusCode: number }) {
  const haystack = `${input.finalUrl}\n${input.html}`.toLowerCase();

  if (UNAVAILABLE_PATTERNS.some((pattern) => haystack.includes(pattern))) {
    return {
      status: "broken" as const,
      note: "The destination reports that the content is unavailable.",
    };
  }

  if (
    RESTRICTED_PATTERNS.some((pattern) => haystack.includes(pattern)) ||
    input.finalUrl.toLowerCase().includes("/login")
  ) {
    return {
      status: "warning" as const,
      note: "The destination looks restricted or requires a logged-in session.",
    };
  }

  if (!input.statusCode || input.statusCode >= 500) {
    return {
      status: "warning" as const,
      note: `The destination could not be checked reliably (HTTP ${input.statusCode || "unknown"}).`,
    };
  }

  if (input.statusCode === 404 || input.statusCode === 410) {
    return {
      status: "broken" as const,
      note: `The destination responded with HTTP ${input.statusCode}.`,
    };
  }

  return {
    status: "healthy" as const,
    note: "The destination opened without unavailable-content markers.",
  };
}

export async function runProviderLinkReview(contact: ProviderLinkReviewContact): Promise<ProviderLinkReviewResult> {
  const values = getContactFieldValues(contact.contact_methods, contact.url, contact.network);
  const items: ProviderLinkReviewItem[] = [];

  const socialCandidates = [
    { field: "instagram" as const, value: values.instagram },
    { field: "messenger" as const, value: values.messenger },
    { field: "facebook" as const, value: values.facebook },
  ].filter((item) => item.value);

  for (const candidate of socialCandidates) {
    const value = normalizeSocialUrl(String(candidate.value || ""));
    if (!value) {
      continue;
    }

    try {
      const result = await fetchVisualStatus(value);
      const detected = detectVisualStatus({
        html: result.html,
        finalUrl: result.finalUrl,
        statusCode: result.status,
      });

      items.push({
        field: candidate.field,
        label: getUrlLabelFromValue(value),
        value,
        finalUrl: result.finalUrl,
        status: !result.ok && detected.status === "healthy" ? "warning" : detected.status,
        note: !result.ok && detected.status === "healthy" ? `The destination responded with HTTP ${result.status}.` : detected.note,
      });
    } catch {
      items.push({
        field: candidate.field,
        label: getUrlLabelFromValue(value),
        value,
        finalUrl: value,
        status: "warning",
        note: "The destination could not be opened reliably right now.",
      });
    }
  }

  const overallStatus: ProviderLinkReviewStatus = items.some((item) => item.status === "broken")
    ? "broken"
    : items.some((item) => item.status === "warning")
      ? "warning"
      : "healthy";

  const summary =
    overallStatus === "broken"
      ? "At least one social link looks unavailable."
      : overallStatus === "warning"
        ? "Some social links need manual review."
        : "The reviewed social links look available.";

  return {
    contactId: contact.id,
    checkedAt: new Date().toISOString(),
    overallStatus,
    summary,
    items,
  };
}
