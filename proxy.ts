import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  const response = await updateSession(request);
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // Managed in updateSession.
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && (request.nextUrl.pathname.startsWith("/dashboard") || request.nextUrl.pathname.startsWith("/admin") || request.nextUrl.pathname.startsWith("/onboarding"))) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/onboarding/:path*"],
};


