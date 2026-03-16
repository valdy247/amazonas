import { NextResponse } from "next/server";
import { callSupabaseAuth } from "@/lib/auth-api";
import { rejectUntrustedOrigin } from "@/lib/security";

type SignInBody = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  try {
    const originError = rejectUntrustedOrigin(request);
    if (originError) {
      return originError;
    }

    const body = (await request.json()) as SignInBody;
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    const result = await callSupabaseAuth("/auth/v1/token?grant_type=password", { email, password });

    if (!result.ok) {
      return NextResponse.json({ error: result.error || "Error al iniciar sesion" }, { status: result.status });
    }

    return NextResponse.json({ data: result.data }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo procesar el inicio de sesion";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
