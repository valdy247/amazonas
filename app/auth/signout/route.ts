import { NextResponse } from "next/server";
import { rejectUntrustedOrigin } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const originError = rejectUntrustedOrigin(request);
  if (originError) {
    return originError;
  }

  const supabase = await createClient();
  await supabase.auth.signOut();

  const url = new URL("/", request.url);
  return NextResponse.redirect(url);
}
