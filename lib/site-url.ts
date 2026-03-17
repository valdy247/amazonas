function normalizeOrigin(value?: string | null) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return "";
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return "";
  }
}

function isLocalOrigin(origin: string) {
  return /:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

export function resolveSiteOrigin(input?: {
  requestUrl?: string | null;
  headerOrigin?: string | null;
  forwardedHost?: string | null;
  forwardedProto?: string | null;
}) {
  const configuredOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  const headerOrigin = normalizeOrigin(input?.headerOrigin);
  const requestOrigin = normalizeOrigin(input?.requestUrl);
  const forwardedHost = String(input?.forwardedHost || "").trim();
  const forwardedProto = String(input?.forwardedProto || "").trim() || "https";
  const forwardedOrigin = forwardedHost ? normalizeOrigin(`${forwardedProto}://${forwardedHost}`) : "";

  if (configuredOrigin && !isLocalOrigin(configuredOrigin)) {
    return configuredOrigin;
  }

  if (headerOrigin && !isLocalOrigin(headerOrigin)) {
    return headerOrigin;
  }

  if (forwardedOrigin && !isLocalOrigin(forwardedOrigin)) {
    return forwardedOrigin;
  }

  if (requestOrigin && !isLocalOrigin(requestOrigin)) {
    return requestOrigin;
  }

  return configuredOrigin || headerOrigin || forwardedOrigin || requestOrigin || "https://verifyzon.com";
}
