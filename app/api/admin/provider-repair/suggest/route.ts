import { NextResponse } from "next/server";
import { hasAdminAccess } from "@/lib/admin";
import { rejectRateLimited } from "@/lib/rate-limit";
import { rejectUntrustedOrigin } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";
import { suggestProviderRepairFromAi } from "@/lib/openai";

async function assertAdminRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("No autorizado");
  }

  const { data: profile } = await supabase.from("profiles").select("role, email").eq("id", user.id).single();

  if (!hasAdminAccess(profile?.role, profile?.email || user.email)) {
    throw new Error("Solo admin");
  }

  return { userId: user.id };
}

export async function POST(request: Request) {
  try {
    const originError = rejectUntrustedOrigin(request);
    if (originError) {
      return originError;
    }

    const { userId } = await assertAdminRoute();
    const rateLimitError = await rejectRateLimited({
      scope: "provider_repair_ai",
      request,
      identifierParts: [userId],
      limit: 25,
      windowSeconds: 3600,
      message: "Estas usando demasiadas sugerencias de IA en poco tiempo.",
    });
    if (rateLimitError) {
      return rateLimitError;
    }

    const body = (await request.json()) as {
      title?: string;
      email?: string | null;
      network?: string | null;
      url?: string | null;
      notes?: string | null;
      contactMethods?: string | null;
    };

    const suggestion = await suggestProviderRepairFromAi({
      title: String(body.title || ""),
      email: body.email || "",
      network: body.network || "",
      url: body.url || "",
      notes: body.notes || "",
      contactMethods: body.contactMethods || "",
    });

    return NextResponse.json({ suggestion });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo generar la sugerencia.",
      },
      { status: 500 }
    );
  }
}
