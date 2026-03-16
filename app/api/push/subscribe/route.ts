import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { savePushSubscription } from "@/lib/push";
import { rejectUntrustedOrigin } from "@/lib/security";

type SubscribeBody = {
  subscription?: {
    endpoint?: string;
    keys?: {
      p256dh?: string;
      auth?: string;
    };
  };
};

export async function POST(request: Request) {
  try {
    const originError = rejectUntrustedOrigin(request);
    if (originError) {
      return originError;
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No authenticated user." }, { status: 401 });
    }

    const body = (await request.json()) as SubscribeBody;
    const endpoint = body.subscription?.endpoint || "";
    const p256dh = body.subscription?.keys?.p256dh || "";
    const auth = body.subscription?.keys?.auth || "";

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });
    }

    await savePushSubscription({
      userId: user.id,
      endpoint,
      p256dh,
      auth,
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The push subscription could not be saved.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
