import { NextResponse } from "next/server";

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

    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      },
      body: JSON.stringify({
        email,
        password,
        data: body.data || {},
      }),
      cache: "no-store",
    });

    const json = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: json?.msg || json?.error_description || json?.error || "Error de registro" }, { status: res.status });
    }

    return NextResponse.json({ data: json }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "No se pudo procesar el registro" }, { status: 500 });
  }
}
