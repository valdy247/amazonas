import { NextResponse } from "next/server";

function normalizeOrigin(value?: string | null) {
  return String(value || "").trim().replace(/\/$/, "");
}

export function getTrustedOrigins(request: Request) {
  const requestOrigin = normalizeOrigin(new URL(request.url).origin);
  const configuredOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  return Array.from(new Set([requestOrigin, configuredOrigin].filter(Boolean)));
}

export function isTrustedOrigin(request: Request) {
  const origin = normalizeOrigin(request.headers.get("origin"));
  if (!origin) {
    return false;
  }

  return getTrustedOrigins(request).includes(origin);
}

export function rejectUntrustedOrigin(request: Request) {
  if (isTrustedOrigin(request)) {
    return null;
  }

  return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
}

export function applySecurityHeaders(response: NextResponse) {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  );

  return response;
}
