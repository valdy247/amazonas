import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapVeriffDecisionStatus, parseVeriffDecisionPayload, verifyVeriffWebhookSignature } from "@/lib/veriff";

function resolveUserId(payload: ReturnType<typeof parseVeriffDecisionPayload>) {
  const verification = payload.verification;
  const value = verification?.endUserId || verification?.vendorData || null;

  if (typeof value === "string" && /^[a-f0-9-]{36}$/i.test(value)) {
    return value;
  }

  return null;
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-hmac-signature");
  const apiKey = request.headers.get("x-auth-client");

  try {
    const isValid = verifyVeriffWebhookSignature({
      body,
      signature,
      apiKey,
    });

    if (!isValid) {
      return NextResponse.json({ ok: false, message: "Invalid Veriff signature." }, { status: 401 });
    }

    const payload = parseVeriffDecisionPayload(body);
    const verification = payload.verification;
    const userId = resolveUserId(payload);

    if (!verification?.id || !userId) {
      return NextResponse.json({ ok: false, message: "Webhook does not include a valid Veriff session or user." }, { status: 400 });
    }

    const status = mapVeriffDecisionStatus(verification.status);
    const admin = createAdminClient();
    const updatePayload = {
      status,
      provider_name: "veriff",
      reference_id: verification.id,
      reviewed_at: status === "approved" || status === "rejected" ? verification.decisionTime || new Date().toISOString() : null,
    };

    const { error } = await admin.from("kyc_checks").update(updatePayload).eq("user_id", userId);

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Veriff webhook failed.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
