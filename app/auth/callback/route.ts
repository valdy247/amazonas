import { NextRequest, NextResponse } from "next/server";
import { resolveSiteOrigin } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

function getSafeRedirect(request: NextRequest) {
  return resolveSiteOrigin({
    requestUrl: request.url,
    headerOrigin: request.headers.get("origin"),
    forwardedHost: request.headers.get("x-forwarded-host") || request.headers.get("host"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
  });
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const baseUrl = getSafeRedirect(request);

  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        return NextResponse.redirect(new URL("/auth?confirm_error=1", baseUrl));
      }

      if (type === "recovery") {
        return NextResponse.redirect(new URL("/auth?mode=recovery", baseUrl));
      }

      return NextResponse.redirect(new URL("/dashboard?email_confirmed=1", baseUrl));
    }

    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as
          | "signup"
          | "invite"
          | "magiclink"
          | "recovery"
          | "email_change"
          | "email",
      });

      if (error) {
        return NextResponse.redirect(new URL("/auth?confirm_error=1", baseUrl));
      }

      if (type === "recovery") {
        return NextResponse.redirect(new URL("/auth?mode=recovery", baseUrl));
      }

      return NextResponse.redirect(new URL("/dashboard?email_confirmed=1", baseUrl));
    }

    return NextResponse.redirect(new URL("/auth?confirm_error=1", baseUrl));
  } catch {
    return NextResponse.redirect(new URL("/auth?confirm_error=1", baseUrl));
  }
}
