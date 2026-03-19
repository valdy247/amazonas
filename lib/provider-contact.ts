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

    if (host.includes("mailto")) return "Email";
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
  if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value)) {
    return `mailto:${value}`;
  }

  const normalizedPhone = value.replace(/[^\d+]/g, "");
  if (/^\+?\d{7,15}$/.test(normalizedPhone)) {
    return `https://wa.me/${normalizedPhone.replace(/^\+/, "")}`;
  }

  return `https://${value}`;
}

function toLabeledHref(raw: string, label?: string | null) {
  const value = raw.trim();
  const normalizedLabel = String(label || "").trim().toLowerCase();

  if (!value) {
    return null;
  }

  if ((normalizedLabel.includes("facebook") || normalizedLabel.includes("messenger")) && /^share\//i.test(value)) {
    return `https://facebook.com/${value.replace(/^\/+/, "")}`;
  }

  if (normalizedLabel.includes("facebook") && /^profile\.php\?/i.test(value)) {
    return `https://facebook.com/${value.replace(/^\/+/, "")}`;
  }

  return toHref(value);
}

function recoverSpecialSocialHref(raw: string, label?: string | null) {
  const value = raw.trim();
  const normalizedLabel = String(label || "").trim().toLowerCase();

  if (!value) {
    return null;
  }

  if ((normalizedLabel.includes("facebook") || normalizedLabel.includes("messenger")) && /^share\//i.test(value)) {
    return `https://facebook.com/${value.replace(/^\/+/, "")}`;
  }

  if (normalizedLabel.includes("facebook") && /^profile\.php\?/i.test(value)) {
    return `https://facebook.com/${value.replace(/^\/+/, "")}`;
  }

  return null;
}

function isLikelyDirectLink(value: string) {
  const trimmed = value.trim();
  return (
    /^https?:\/\//i.test(trimmed) ||
    /^(www\.)?[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(trimmed) ||
    /^\+?\d{7,15}$/.test(trimmed.replace(/[^\d+]/g, ""))
  );
}

function methodMatchesPreferredNetwork(method: ContactMethod, preferredNetwork: string) {
  const normalizedPreferred = preferredNetwork.trim().toLowerCase();
  if (!normalizedPreferred) {
    return false;
  }

  const label = method.label.trim().toLowerCase();
  const href = String(method.href || "").toLowerCase();
  const value = method.value.trim().toLowerCase();

  if (normalizedPreferred.includes("whatsapp")) {
    return label.includes("whatsapp") || href.includes("wa.me/") || /^\+?\d{7,15}$/.test(value.replace(/[^\d+]/g, ""));
  }

  if (normalizedPreferred.includes("instagram")) {
    return label.includes("instagram") || href.includes("instagram.com");
  }

  if (normalizedPreferred.includes("messenger")) {
    return label.includes("messenger") || href.includes("m.me/") || href.includes("messenger.com");
  }

  if (normalizedPreferred.includes("facebook")) {
    return label.includes("facebook") || href.includes("facebook.com");
  }

  if (normalizedPreferred.includes("email")) {
    return label.includes("email") || href.startsWith("mailto:");
  }

  return label.includes(normalizedPreferred) || href.includes(normalizedPreferred) || value.includes(normalizedPreferred);
}

function prioritizeContactMethods(methods: ContactMethod[], fallbackUrl?: string | null, fallbackNetwork?: string | null) {
  if (methods.length <= 1) {
    return methods;
  }

  const normalizedFallbackUrl = normalizeContactValue(fallbackUrl);
  const normalizedFallbackNetwork = String(fallbackNetwork || "").trim().toLowerCase();

  return methods
    .map((method, index) => {
      const comparableValue = normalizeContactValue(method.href || method.value);
      let score = 0;

      if (normalizedFallbackUrl && comparableValue === normalizedFallbackUrl) {
        score += 10;
      }

      if (normalizedFallbackNetwork && methodMatchesPreferredNetwork(method, normalizedFallbackNetwork)) {
        score += 5;
      }

      return { method, index, score };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.method);
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
    const directCopyHref = copyMode
      ? recoverSpecialSocialHref(rawValue, requestedLabel) || (isLikelyDirectLink(rawValue) ? toHref(rawValue) : null)
      : null;
    const href = copyMode ? directCopyHref : toLabeledHref(rawValue, requestedLabel);
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
    const fallbackHref = toLabeledHref(String(fallbackUrl || ""), fallbackNetwork);
    const networkHref = toLabeledHref(String(fallbackNetwork || ""), fallbackNetwork);
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

  return prioritizeContactMethods(methods, fallbackUrl, fallbackNetwork);
}

export function getPrimaryContactUrl(contactMethods?: string | null, fallbackUrl?: string | null, fallbackNetwork?: string | null) {
  const methods = parseContactMethods(contactMethods, fallbackUrl, fallbackNetwork);
  return methods.find((method) => method.mode === "link")?.href || fallbackUrl || "#";
}

export function getPrimaryContactLabel(contactMethods?: string | null, fallbackUrl?: string | null, fallbackNetwork?: string | null) {
  const methods = parseContactMethods(contactMethods, fallbackUrl, fallbackNetwork);
  return methods[0]?.label || fallbackNetwork || "Enlace";
}

export function buildContactMethodsFromFields({
  whatsapp,
  instagram,
  messenger,
  facebook,
  email,
}: {
  whatsapp?: string | null;
  instagram?: string | null;
  messenger?: string | null;
  facebook?: string | null;
  email?: string | null;
}) {
  const trimmedWhatsapp = whatsapp?.trim() || "";
  const trimmedInstagram = instagram?.trim() || "";
  const trimmedMessenger = messenger?.trim() || "";
  const trimmedFacebook = facebook?.trim() || "";
  const normalizedInstagram = trimmedInstagram ? toLabeledHref(trimmedInstagram, "Instagram") || trimmedInstagram : "";
  const normalizedMessenger = trimmedMessenger
    ? isLikelyDirectLink(trimmedMessenger)
      ? toLabeledHref(trimmedMessenger, "Messenger") || trimmedMessenger
      : `copy:${trimmedMessenger}`
    : "";
  const normalizedFacebook = trimmedFacebook
    ? isLikelyDirectLink(trimmedFacebook)
      ? toLabeledHref(trimmedFacebook, "Facebook") || trimmedFacebook
      : `copy:${trimmedFacebook}`
    : "";
  const rows = [
    email?.trim() ? `Email|${email.trim()}` : null,
    trimmedWhatsapp ? `WhatsApp|${trimmedWhatsapp}` : null,
    normalizedInstagram ? `Instagram|${normalizedInstagram}` : null,
    normalizedMessenger ? `Messenger|${normalizedMessenger}` : null,
    normalizedFacebook ? `Facebook|${normalizedFacebook}` : null,
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
  let email = "";
  let whatsapp = "";
  let instagram = "";
  let messenger = "";
  let facebook = "";

  methods.forEach((method) => {
    const href = method.href?.trim() || "";
    const label = method.label.toLowerCase();
    const value = method.value.trim();

    if (!email && (label.includes("email") || href.startsWith("mailto:") || /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value))) {
      email = href.startsWith("mailto:") ? href.replace(/^mailto:/i, "") : value;
      return;
    }

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

  return { email, whatsapp, instagram, messenger, facebook };
}
