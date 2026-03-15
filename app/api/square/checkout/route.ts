import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
    const { orderId, url } = await createSquarePaymentLink({
      userId: user.id,
      email: user.email || "",
      fullName: profile.full_name || "Reviewer",
      redirectUrl: `${origin}/dashboard?square=processing`,
    });

    await supabase
      .from("memberships")
      .update({
        status: "pending_payment",
        square_subscription_id: orderId,
      })
      .eq("user_id", user.id);

    return NextResponse.redirect(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo iniciar el checkout de Square.";
    return NextResponse.redirect(new URL(`/dashboard?square_error=${encodeURIComponent(message)}`, origin));
  }
}
