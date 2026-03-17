import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { membershipHasAccess } from "@/lib/membership";
import { createVeriffSession } from "@/lib/veriff";

function splitName(fullName: string | null | undefined) {
  const value = String(fullName || "").trim();
  if (!value) {
    return { firstName: "", lastName: "" };
  }

  const parts = value.split(/\s+/);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const origin = new URL(request.url).origin;

  if (!user) {
    return NextResponse.redirect(new URL("/auth?mode=signin", origin));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, first_name, last_name, phone, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role === "provider" || profile.role === "admin") {
    return NextResponse.redirect(new URL("/dashboard", origin));
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("status, current_period_end_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membershipHasAccess(membership)) {
    return NextResponse.redirect(new URL("/dashboard?veriff_error=Activa%20tu%20membresia%20antes%20de%20verificarte.", origin));
  }

  const fullName = profile.full_name || "";
  const names = splitName(profile.full_name);
  const firstName = profile.first_name || names.firstName || "Miembro";
  const lastName = profile.last_name || names.lastName || "";

  try {
    const { sessionId, sessionUrl } = await createVeriffSession({
      userId: user.id,
      firstName,
      lastName,
      fullName,
      phone: profile.phone,
      callbackUrl: `${origin}/dashboard?veriff=processing`,
    });

    const admin = createAdminClient();
    const { error } = await admin
      .from("kyc_checks")
      .update({
        status: "in_review",
        provider_name: "veriff",
        reference_id: sessionId,
        reviewed_at: null,
      })
      .eq("user_id", user.id);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.redirect(sessionUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo iniciar la verificacion con Veriff.";
    return NextResponse.redirect(new URL(`/dashboard?veriff_error=${encodeURIComponent(message)}`, origin));
  }
}
