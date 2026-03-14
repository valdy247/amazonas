import { NextResponse } from "next/server";

type SignInBody = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SignInBody;
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
        },
        body: JSON.stringify({ email, password }),
        cache: "no-store",
      }
    );

    const json = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: json?.msg || json?.error_description || json?.error || "Error al iniciar sesion" }, { status: res.status });
    }

    return NextResponse.json({ data: json }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "No se pudo procesar el inicio de sesion" }, { status: 500 });
  }
}
