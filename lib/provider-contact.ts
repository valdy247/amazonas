export type ContactMethod = {
  label: string;
  href: string;
};

function labelFromUrl(raw: string) {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");

    if (host.includes("instagram")) return "Instagram";
    if (host.includes("facebook") || host.includes("m.me") || host.includes("messenger")) return "Messenger";
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

export function parseContactMethods(contactMethods?: string | null, fallbackUrl?: string | null, fallbackNetwork?: string | null) {
  const methods: ContactMethod[] = [];
  const rawLines = String(contactMethods || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  rawLines.forEach((line) => {
    const [left, right] = line.includes("|") ? line.split("|", 2) : line.includes(":") ? line.split(":", 2) : ["", line];
    const target = right ? right.trim() : left.trim();
    const href = toHref(target);

    if (!href) return;

    const derivedLabel = labelFromUrl(href);
    const requestedLabel = right ? left.trim() : "";
    const label =
      derivedLabel === "WhatsApp"
        ? "WhatsApp"
        : requestedLabel || derivedLabel;
    methods.push({ label, href });
  });

  if (!methods.length) {
    const fallbackHref = toHref(String(fallbackUrl || ""));
    const networkHref = toHref(String(fallbackNetwork || ""));
    const href = fallbackHref || networkHref;

    if (href) {
      methods.push({
        label: labelFromUrl(href) === "WhatsApp" ? "WhatsApp" : fallbackNetwork || labelFromUrl(href),
        href,
      });
    }
  }

  return methods;
}

export function getPrimaryContactUrl(contactMethods?: string | null, fallbackUrl?: string | null) {
  const methods = parseContactMethods(contactMethods, fallbackUrl);
  return methods[0]?.href || fallbackUrl || "#";
}

export function buildContactMethodsFromFields({
  whatsapp,
  instagram,
  messenger,
}: {
  whatsapp?: string | null;
  instagram?: string | null;
  messenger?: string | null;
}) {
  const rows = [
    whatsapp?.trim() ? `WhatsApp|${whatsapp.trim()}` : null,
    instagram?.trim() ? `Instagram|${instagram.trim()}` : null,
    messenger?.trim() ? `Messenger|${messenger.trim()}` : null,
  ].filter(Boolean);

  return rows.join("\n");
}

export function getContactFieldValues(contactMethods?: string | null, fallbackUrl?: string | null, fallbackNetwork?: string | null) {
  const methods = parseContactMethods(contactMethods, fallbackUrl, fallbackNetwork);
  let whatsapp = "";
  let instagram = "";
  let messenger = "";

  methods.forEach((method) => {
    const href = method.href.trim();
    const label = method.label.toLowerCase();

    if (!whatsapp && (label.includes("whatsapp") || href.includes("wa.me/"))) {
      const match = href.match(/wa\.me\/(\d+)/i);
      whatsapp = match ? `+${match[1]}` : href;
      return;
    }

    if (!instagram && (label.includes("instagram") || href.includes("instagram.com"))) {
      instagram = href;
      return;
    }

    if (!messenger && (label.includes("messenger") || href.includes("m.me/") || href.includes("facebook.com"))) {
      messenger = href;
    }
  });

  return { whatsapp, instagram, messenger };
}
