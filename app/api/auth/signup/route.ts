import { NextResponse } from "next/server";
import { callSupabaseAuth } from "@/lib/auth-api";

type SignupBody = {
  email?: string;
  password?: string;
  data?: Record<string, unknown>;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SignupBody;
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    const result = await callSupabaseAuth("/auth/v1/signup", {
      email,
      password,
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
