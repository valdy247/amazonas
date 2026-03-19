function readAuthEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return {
      error:
        "Faltan variables de entorno de Supabase. Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }

  return { supabaseUrl, supabaseKey };
}

async function parseAuthResponse(res: Response) {
  const text = await res.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
}

type SupabaseAuthRequestOptions = {
  redirectTo?: string;
};

export async function callSupabaseAuth(
  path: string,
  body: Record<string, unknown>,
  options?: SupabaseAuthRequestOptions
) {
  const env = readAuthEnv();

  if ("error" in env) {
    return {
      ok: false,
      status: 500,
      error: env.error,
    };
  }

  try {
    const url = new URL(`${env.supabaseUrl}${path}`);

    if (options?.redirectTo) {
      url.searchParams.set("redirect_to", options.redirectTo);
    }

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseKey,
        Authorization: `Bearer ${env.supabaseKey}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const json = await parseAuthResponse(res);
    const error =
      typeof json?.msg === "string"
        ? json.msg
        : typeof json?.error_description === "string"
          ? json.error_description
          : typeof json?.error === "string"
            ? json.error
            : !res.ok
              ? "Error de autenticacion"
              : null;

    return {
      ok: res.ok,
      status: res.status,
      data: json,
      error,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo conectar con Supabase";

    return {
      ok: false,
      status: 500,
      error: message,
    };
  }
}
