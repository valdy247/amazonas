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

function normalizeName(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getVerifiedFullName(payload: ReturnType<typeof parseVeriffDecisionPayload>) {
  const person = payload.verification?.person;
  const fullName = person?.fullName?.trim();

  if (fullName) {
    return fullName;
  }

  return [person?.firstName, person?.lastName].filter(Boolean).join(" ").trim();
}

function namesReasonablyMatch(input: { profileName: string | null | undefined; verifiedName: string | null | undefined }) {
  const profileName = normalizeName(input.profileName);
  const verifiedName = normalizeName(input.verifiedName);

  if (!profileName || !verifiedName) {
    return true;
  }

  if (profileName === verifiedName) {
    return true;
  }

  const profileTokens = Array.from(new Set(profileName.split(" ").filter(Boolean)));
  const verifiedTokens = Array.from(new Set(verifiedName.split(" ").filter(Boolean)));

  if (!profileTokens.length || !verifiedTokens.length) {
    return true;
  }

  const sharedTokens = profileTokens.filter((token) => verifiedTokens.includes(token));
  const overlapOnProfile = sharedTokens.length / profileTokens.length;
  const overlapOnVerified = sharedTokens.length / verifiedTokens.length;

  return overlapOnProfile >= 0.6 && overlapOnVerified >= 0.6;
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
    const verifiedFullName = getVerifiedFullName(payload);

    if (!verification?.id || !userId) {
      return NextResponse.json({ ok: false, message: "Webhook does not include a valid Veriff session or user." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
    const baseStatus = mapVeriffDecisionStatus(verification.status);
    const hasReasonableNameMatch = namesReasonablyMatch({
      profileName: profile?.full_name,
      verifiedName: verifiedFullName,
    });
    const status = baseStatus === "approved" && !hasReasonableNameMatch ? "in_review" : baseStatus;
    const updatePayload = {
      status,
      provider_name: "veriff",
      reference_id: verification.id,
      reviewed_at: status === "approved" || status === "rejected" ? verification.decisionTime || new Date().toISOString() : null,
      verified_full_name: verifiedFullName || null,
      review_note:
        baseStatus === "approved" && !hasReasonableNameMatch
          ? "El nombre verificado no coincide razonablemente con el nombre del perfil."
          : verification.reason || null,
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
