import { NextResponse } from "next/server";
import { hasAdminAccess } from "@/lib/admin";
import { rejectRateLimited } from "@/lib/rate-limit";
import { rejectUntrustedOrigin } from "@/lib/security";
import { runProviderLinkReview } from "@/lib/provider-link-review";
import { createClient } from "@/lib/supabase/server";

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

  return { supabase, userId: user.id };
}

export async function POST(request: Request) {
  try {
    const originError = rejectUntrustedOrigin(request);
    if (originError) {
      return originError;
    }

    const { supabase, userId } = await assertAdminRoute();
    const rateLimitError = await rejectRateLimited({
      scope: "provider_link_review",
      request,
      identifierParts: [userId],
      limit: 60,
      windowSeconds: 3600,
      message: "Demasiadas revisiones visuales en poco tiempo.",
    });
    if (rateLimitError) {
      return rateLimitError;
    }

    const body = (await request.json()) as { contactId?: number };
    const contactId = Number(body.contactId || 0);
    if (!Number.isFinite(contactId) || contactId <= 0) {
      return NextResponse.json({ error: "Contacto invalido." }, { status: 400 });
    }

    const { data: contact, error } = await supabase
      .from("provider_contacts")
      .select("id, title, network, url, contact_methods")
      .eq("id", contactId)
      .maybeSingle();

    if (error || !contact) {
      return NextResponse.json({ error: "No se encontro ese proveedor." }, { status: 404 });
    }

    const result = await runProviderLinkReview(contact);
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo ejecutar la revision visual." },
      { status: 500 }
    );
  }
}
