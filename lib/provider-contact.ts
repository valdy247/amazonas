export type ContactMethod = {
  label: string;
  value: string;
  href?: string;
  mode: "link" | "copy";
};

export function normalizeWhatsappPrefix(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.includes(":")) {
    return raw.split(":").slice(1).join(":").trim();
  }
  return raw;
}

function labelFromUrl(raw: string) {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");

    if (host.includes("instagram")) return "Instagram";
    if (host.includes("m.me") || host.includes("messenger")) return "Messenger";
    if (host.includes("facebook")) return "Facebook";
    if (host.includes("wa.me") || host.includes("whatsapp")) return "WhatsApp";
    if (host.includes("telegram")) return "Telegram";

    return host;
  } catch {
    if (raw.startsWith("https://wa.me/")) return "WhatsApp";
    return "Enlace";
  }
}

function toHref(raw: string) {
  const value = raw.trim();

  if (!value) return null;
  if (value === "#") return null;
  if (/^https?:\/\//i.test(value)) return value;

  const normalizedPhone = value.replace(/[^\d+]/g, "");
  if (/^\+?\d{7,15}$/.test(normalizedPhone)) {
    return `https://wa.me/${normalizedPhone.replace(/^\+/, "")}`;
  }

  return `https://${value}`;
}

function isLikelyDirectLink(value: string) {
  const trimmed = value.trim();
  return (
    /^https?:\/\//i.test(trimmed) ||
    /^(www\.)?[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(trimmed) ||
    /^\+?\d{7,15}$/.test(trimmed.replace(/[^\d+]/g, ""))
  );
}

export function parseContactMethods(contactMethods?: string | null, fallbackUrl?: string | null, fallbackNetwork?: string | null) {
  const methods: ContactMethod[] = [];
  const rawLines = String(contactMethods || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  rawLines.forEach((line) => {
    const [left, right] = line.includes("|") ? line.split("|", 2) : line.includes(":") ? line.split(":", 2) : ["", line];
    const target = right ? right.trim() : left.trim();
    const requestedLabel = right ? left.trim() : "";
    const copyMode = /^copy:/i.test(target);
    const rawValue = copyMode ? target.replace(/^copy:/i, "").trim() : target;
    const directCopyHref = copyMode && isLikelyDirectLink(rawValue) ? toHref(rawValue) : null;
    const href = copyMode ? directCopyHref : toHref(rawValue);
    const derivedLabel = href ? labelFromUrl(href) : "";
    const label = derivedLabel === "WhatsApp" ? "WhatsApp" : requestedLabel || derivedLabel || "Enlace";

    if (!rawValue) return;

    if ((copyMode && !directCopyHref) || !href) {
      methods.push({ label, value: rawValue, mode: "copy" });
      return;
    }

    methods.push({ label, value: rawValue, href, mode: "link" });
  });

  if (!methods.length) {
    const fallbackHref = toHref(String(fallbackUrl || ""));
    const networkHref = toHref(String(fallbackNetwork || ""));
    const href = fallbackHref || networkHref;

    if (href) {
      methods.push({
        label: labelFromUrl(href) === "WhatsApp" ? "WhatsApp" : fallbackNetwork || labelFromUrl(href),
        value: href,
        href,
        mode: "link",
      });
    }
  }

  return methods;
}

export function getPrimaryContactUrl(contactMethods?: string | null, fallbackUrl?: string | null) {
  const methods = parseContactMethods(contactMethods, fallbackUrl);
  return methods.find((method) => method.mode === "link")?.href || fallbackUrl || "#";
}

export function buildContactMethodsFromFields({
  whatsapp,
  instagram,
  messenger,
  facebook,
}: {
  whatsapp?: string | null;
  instagram?: string | null;
  messenger?: string | null;
  facebook?: string | null;
}) {
  const trimmedMessenger = messenger?.trim() || "";
  const trimmedFacebook = facebook?.trim() || "";
  const rows = [
    whatsapp?.trim() ? `WhatsApp|${whatsapp.trim()}` : null,
    instagram?.trim() ? `Instagram|${instagram.trim()}` : null,
    trimmedMessenger ? `Messenger|${isLikelyDirectLink(trimmedMessenger) ? trimmedMessenger : `copy:${trimmedMessenger}`}` : null,
    trimmedFacebook ? `Facebook|${isLikelyDirectLink(trimmedFacebook) ? trimmedFacebook : `copy:${trimmedFacebook}`}` : null,
  ].filter(Boolean);

  return rows.join("\n");
}

export function normalizeContactValue(raw?: string | null) {
  const value = String(raw || "").trim();

  if (!value) {
    return "";
  }

  if (/^copy:/i.test(value)) {
    return value.replace(/^copy:/i, "").trim().toLowerCase();
  }

  if (!/^https?:\/\//i.test(value) && /\s/.test(value)) {
    return value.toLowerCase();
  }

  const href = toHref(value);
  return href ? href.toLowerCase() : value.toLowerCase();
}

export function getComparableContactMethods(contactMethods?: string | null, fallbackUrl?: string | null, fallbackNetwork?: string | null) {
  return parseContactMethods(contactMethods, fallbackUrl, fallbackNetwork)
    .map((method) => normalizeContactValue(method.mode === "copy" ? method.value : method.href || method.value))
    .filter(Boolean);
}

export function getContactFieldValues(contactMethods?: string | null, fallbackUrl?: string | null, fallbackNetwork?: string | null) {
  const methods = parseContactMethods(contactMethods, fallbackUrl, fallbackNetwork);
  let whatsapp = "";
  let instagram = "";
  let messenger = "";
  let facebook = "";

  methods.forEach((method) => {
    const href = method.href?.trim() || "";
    const label = method.label.toLowerCase();
    const value = method.value.trim();

    if (!whatsapp && (label.includes("whatsapp") || href.includes("wa.me/"))) {
      const match = href.match(/wa\.me\/(\d+)/i);
      whatsapp = match ? `+${match[1]}` : href;
      return;
    }

    if (!instagram && (label.includes("instagram") || href.includes("instagram.com"))) {
      instagram = href || value;
      return;
    }

    if (!messenger && (label.includes("messenger") || href.includes("m.me/") || href.includes("messenger.com"))) {
      messenger = href || value;
      return;
    }

    if (!facebook && (label.includes("facebook") || href.includes("facebook.com"))) {
      facebook = href || value;
    }
  });

  return { whatsapp, instagram, messenger, facebook };
}
