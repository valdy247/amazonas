import { NextResponse } from "next/server";
import { callSupabaseAuth } from "@/lib/auth-api";
import { rejectRateLimited } from "@/lib/rate-limit";
import { rejectUntrustedOrigin } from "@/lib/security";
import { resolveSiteOrigin } from "@/lib/site-url";

type SignupBody = {
  email?: string;
  password?: string;
  data?: Record<string, unknown>;
};

export async function POST(request: Request) {
  try {
    const originError = rejectUntrustedOrigin(request);
    if (originError) {
      return originError;
    }

    const body = (await request.json()) as SignupBody;
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    const rateLimitError = await rejectRateLimited({
      scope: "auth_signup",
      request,
      identifierParts: [email],
      limit: 5,
      windowSeconds: 900,
      message: "Demasiados intentos de registro. Espera un poco antes de intentarlo otra vez.",
    });
    if (rateLimitError) {
      return rateLimitError;
    }

    const result = await callSupabaseAuth("/auth/v1/signup", {
      email,
      password,
      emailRedirectTo: `${resolveSiteOrigin({
        requestUrl: request.url,
        headerOrigin: request.headers.get("origin"),
        forwardedHost: request.headers.get("x-forwarded-host") || request.headers.get("host"),
        forwardedProto: request.headers.get("x-forwarded-proto"),
      })}/auth/callback`,
      data: body.data || {},
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error || "Error de registro" }, { status: result.status });
    }

    return NextResponse.json({ data: result.data }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo procesar el registro";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
