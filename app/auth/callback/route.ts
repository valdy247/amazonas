import { NextRequest, NextResponse } from "next/server";
import { resolveSiteOrigin } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function syncConfirmedEmailProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const confirmedAt =
    (user as { email_confirmed_at?: string | null }).email_confirmed_at ||
    new Date().toISOString();

  const admin = createAdminClient();
  await admin.from("profiles").update({ email_confirmed_at: confirmedAt }).eq("id", user.id).is("email_confirmed_at", null);
}

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
  const accessToken = url.searchParams.get("access_token");
  const refreshToken = url.searchParams.get("refresh_token");
  const baseUrl = getSafeRedirect(request);
  const hasAuthPayload = Boolean(code || (tokenHash && type) || (accessToken && refreshToken));

  try {
    if (hasAuthPayload) {
      await supabase.auth.signOut();
    }

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        return NextResponse.redirect(new URL("/auth?confirm_error=1", baseUrl));
      }

      await syncConfirmedEmailProfile(supabase);

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

      await syncConfirmedEmailProfile(supabase);

      if (type === "recovery") {
        return NextResponse.redirect(new URL("/auth?mode=recovery", baseUrl));
      }

      return NextResponse.redirect(new URL("/dashboard?email_confirmed=1", baseUrl));
    }

    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        return NextResponse.redirect(new URL("/auth?confirm_error=1", baseUrl));
      }

      await syncConfirmedEmailProfile(supabase);

      if (type === "recovery") {
        return NextResponse.redirect(new URL("/auth?mode=recovery", baseUrl));
      }

      return NextResponse.redirect(new URL("/dashboard?email_confirmed=1", baseUrl));
    }

    if (!url.search) {
      const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Confirming...</title>
  </head>
  <body>
    <script>
      (function () {
        var hash = window.location.hash ? window.location.hash.slice(1) : "";
        if (!hash) {
          window.location.replace(${JSON.stringify(`${baseUrl}/auth?confirm_error=1`)});
          return;
        }

        var nextUrl = new URL(window.location.href);
        nextUrl.hash = "";
        nextUrl.search = hash;
        window.location.replace(nextUrl.toString());
      })();
    </script>
  </body>
</html>`;

      return new NextResponse(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.redirect(new URL("/auth?confirm_error=1", baseUrl));
  } catch {
    return NextResponse.redirect(new URL("/auth?confirm_error=1", baseUrl));
  }
}
