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
    return "Enlace";
  }
}

function toHref(raw: string) {
  const value = raw.trim();

  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;

  const normalizedPhone = value.replace(/[^\d+]/g, "");
  if (/^\+?\d{7,15}$/.test(normalizedPhone)) {
    return `tel:${normalizedPhone}`;
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

    const label = right ? left.trim() || labelFromUrl(href) : labelFromUrl(href);
    methods.push({ label, href });
  });

  if (!methods.length && fallbackUrl) {
    methods.push({
      label: fallbackNetwork || labelFromUrl(fallbackUrl),
      href: fallbackUrl,
    });
  }

  return methods;
}

export function getPrimaryContactUrl(contactMethods?: string | null, fallbackUrl?: string | null) {
  const methods = parseContactMethods(contactMethods, fallbackUrl);
  return methods[0]?.href || fallbackUrl || "#";
}
