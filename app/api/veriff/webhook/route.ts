import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapVeriffDecisionStatus, parseVeriffDecisionPayload, verifyVeriffWebhookSignature } from "@/lib/veriff";

type VeriffWebhookPayload = ReturnType<typeof parseVeriffDecisionPayload>;

function isUuid(value: unknown) {
  return typeof value === "string" && /^[a-f0-9-]{36}$/i.test(value);
}

function getObjectValue(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const nestedValue = (value as { value?: unknown }).value;
  return typeof nestedValue === "string" ? nestedValue : null;
}

function resolveVerificationId(payload: VeriffWebhookPayload) {
  const candidates = [
    payload.verification?.id,
    payload.sessionId,
    payload.id,
  ];

  for (const candidate of candidates) {
    if (isUuid(candidate)) {
      return candidate;
    }
  }

  return null;
}

function resolveUserId(payload: VeriffWebhookPayload) {
  const candidates = [
    payload.verification?.endUserId,
    payload.verification?.vendorData,
    payload.endUserId,
    payload.vendorData,
  ];

  for (const candidate of candidates) {
    if (isUuid(candidate)) {
      return candidate;
    }
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

function tokenReasonablyMatches(left: string, right: string) {
  if (!left || !right) {
    return false;
  }

  if (left === right) {
    return true;
  }

  const minLength = Math.min(left.length, right.length);

  if (minLength >= 4 && (left.startsWith(right) || right.startsWith(left))) {
    return true;
  }

  if (minLength >= 5 && (left.includes(right) || right.includes(left))) {
    return true;
  }

  return false;
}

function getVerifiedFullName(payload: VeriffWebhookPayload) {
  const person = payload.verification?.person;
  const fullName = person?.fullName?.trim();

  if (fullName) {
    return fullName;
  }

  const directName = [person?.firstName, person?.lastName].filter(Boolean).join(" ").trim();
  if (directName) {
    return directName;
  }

  const fullAutoPerson = payload.data?.verification?.person;
  const extractedName = [
    getObjectValue(fullAutoPerson?.firstName),
    getObjectValue(fullAutoPerson?.lastName),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return extractedName || null;
}

function resolveDecisionStatus(payload: VeriffWebhookPayload) {
  const decision = payload.verification?.status || payload.data?.verification?.decision || null;
  return typeof decision === "string" ? decision : null;
}

function resolveDecisionReason(payload: VeriffWebhookPayload) {
  const reason = payload.verification?.reason;
  return typeof reason === "string" ? reason : null;
}

function resolveDecisionTime(payload: VeriffWebhookPayload) {
  const candidates = [
    payload.verification?.decisionTime,
    payload.time,
    payload.acceptanceTime,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && !Number.isNaN(new Date(candidate).getTime())) {
      return candidate;
    }
  }

  return new Date().toISOString();
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

  if (profileName.includes(verifiedName) || verifiedName.includes(profileName)) {
    return true;
  }

  const profileTokens = Array.from(new Set(profileName.split(" ").filter(Boolean)));
  const verifiedTokens = Array.from(new Set(verifiedName.split(" ").filter(Boolean)));

  if (!profileTokens.length || !verifiedTokens.length) {
    return true;
  }

  const matchedProfileTokens = profileTokens.filter((profileToken) =>
    verifiedTokens.some((verifiedToken) => tokenReasonablyMatches(profileToken, verifiedToken))
  );
  const matchedVerifiedTokens = verifiedTokens.filter((verifiedToken) =>
    profileTokens.some((profileToken) => tokenReasonablyMatches(profileToken, verifiedToken))
  );
  const overlapOnProfile = matchedProfileTokens.length / profileTokens.length;
  const overlapOnVerified = matchedVerifiedTokens.length / verifiedTokens.length;

  if (overlapOnProfile >= 1 && overlapOnVerified >= 0.5) {
    return true;
  }

  if (overlapOnProfile >= 0.5 && overlapOnVerified >= 1) {
    return true;
  }

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
    const userId = resolveUserId(payload);
    const verificationId = resolveVerificationId(payload);
    const decisionStatus = resolveDecisionStatus(payload);
    const verifiedFullName = getVerifiedFullName(payload);

    if (!decisionStatus) {
      return NextResponse.json({ ok: true, ignored: true, message: "Event webhook received without final decision." });
    }

    if (!verificationId || !userId) {
      return NextResponse.json({ ok: false, message: "Webhook does not include a valid Veriff session or user." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
    const { data: existingKyc } = await admin
      .from("kyc_checks")
      .select("status, reviewed_at, reference_id")
      .eq("user_id", userId)
      .maybeSingle();
    const baseStatus = mapVeriffDecisionStatus(decisionStatus);
    const hasReasonableNameMatch = namesReasonablyMatch({
      profileName: profile?.full_name,
      verifiedName: verifiedFullName,
    });
    const status = baseStatus === "approved" && !hasReasonableNameMatch ? "in_review" : baseStatus;
    const processedAt = resolveDecisionTime(payload);
    const currentReviewedAt =
      typeof existingKyc?.reviewed_at === "string" && !Number.isNaN(new Date(existingKyc.reviewed_at).getTime())
        ? new Date(existingKyc.reviewed_at).getTime()
        : null;
    const incomingReviewedAt = !Number.isNaN(new Date(processedAt).getTime()) ? new Date(processedAt).getTime() : Date.now();

    if (
      currentReviewedAt !== null &&
      incomingReviewedAt < currentReviewedAt &&
      existingKyc?.reference_id &&
      existingKyc.reference_id !== verificationId
    ) {
      return NextResponse.json({
        ok: true,
        ignored: true,
        message: "Ignored an older Veriff decision because a newer one was already processed.",
      });
    }

    const updatePayload = {
      status,
      provider_name: "veriff",
      reference_id: verificationId,
      reviewed_at: processedAt,
      verified_full_name: verifiedFullName || null,
      review_note:
        baseStatus === "approved" && !hasReasonableNameMatch
          ? "El nombre verificado no coincide razonablemente con el nombre del perfil."
          : resolveDecisionReason(payload),
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
