import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSquarePaymentLink } from "@/lib/square";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const origin = new URL(request.url).origin;

  if (!user) {
    return NextResponse.redirect(new URL("/auth?mode=signin", origin));
  }

  const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).single();

  if (!profile || profile.role === "provider" || profile.role === "admin") {
    return NextResponse.redirect(new URL("/dashboard", origin));
  }

  try {
    const admin = createAdminClient();
    const { orderId, url } = await createSquarePaymentLink({
      userId: user.id,
      email: user.email || "",
      fullName: profile.full_name || "Reviewer",
      redirectUrl: `${origin}/dashboard?square=processing`,
    });

    const { error: membershipError } = await admin
      .from("memberships")
      .update({
        status: "payment_processing",
        square_order_id: orderId,
        last_square_event_type: "checkout_started",
        last_square_event_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (membershipError) {
      throw new Error(membershipError.message);
    }

    return NextResponse.redirect(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo iniciar el checkout de Square.";
    return NextResponse.redirect(new URL(`/dashboard?square_error=${encodeURIComponent(message)}`, origin));
  }
}
