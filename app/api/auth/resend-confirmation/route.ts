import { NextResponse } from "next/server";
import { rejectRateLimited } from "@/lib/rate-limit";
import { rejectUntrustedOrigin } from "@/lib/security";
import { resolveSiteOrigin } from "@/lib/site-url";
import { callSupabaseAuth } from "@/lib/auth-api";

type ResendConfirmationBody = {
  email?: string;
};

export async function POST(request: Request) {
  try {
    const originError = rejectUntrustedOrigin(request);
    if (originError) {
      return originError;
    }

    const body = (await request.json()) as ResendConfirmationBody;
    const email = String(body.email || "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Correo requerido" }, { status: 400 });
    }

    const rateLimitError = await rejectRateLimited({
      scope: "auth_resend_confirmation",
      request,
      identifierParts: [email],
      limit: 3,
      windowSeconds: 600,
      message: "Demasiados intentos para reenviar el correo. Espera unos minutos.",
    });
    if (rateLimitError) {
      return rateLimitError;
    }

    const redirectTo = `${resolveSiteOrigin({
      requestUrl: request.url,
      headerOrigin: request.headers.get("origin"),
      forwardedHost: request.headers.get("x-forwarded-host") || request.headers.get("host"),
      forwardedProto: request.headers.get("x-forwarded-proto"),
    })}/auth/callback`;

    const result = await callSupabaseAuth(
      "/auth/v1/resend",
      {
        type: "signup",
        email,
      },
      { redirectTo }
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error || "No se pudo reenviar el correo" }, { status: result.status });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo reenviar el correo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
