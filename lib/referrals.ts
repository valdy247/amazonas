import { createAdminClient } from "@/lib/supabase/admin";
import { membershipHasAccess } from "@/lib/membership";

export const REFERRAL_BASE_PROVIDER_LIMIT = 100;
export const REFERRAL_REWARD_PROVIDERS = 5;
export const REFERRAL_MONTHLY_CAP = 10;
export const REFERRAL_MAX_PROVIDER_LIMIT =
  REFERRAL_BASE_PROVIDER_LIMIT + REFERRAL_REWARD_PROVIDERS * REFERRAL_MONTHLY_CAP;

type ReferralProfile = {
  id: string;
  role?: string | null;
  referral_code?: string | null;
  referred_by_user_id?: string | null;
  email_confirmed_at?: string | null;
  referral_qualified_at?: string | null;
};

export function normalizeReferralCode(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function buildReferralCodeFromUserId(userId: string) {
  const compact = userId.replace(/-/g, "").toUpperCase();
  return `RT${compact.slice(0, 8)}`;
}

export async function ensureReferralCode(userId: string, currentCode?: string | null) {
  const normalizedCode = normalizeReferralCode(currentCode);
  if (normalizedCode) {
    return normalizedCode;
  }

  const admin = createAdminClient();
  const baseCode = buildReferralCodeFromUserId(userId);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = attempt === 0 ? "" : String(hashReferralSeed(`${userId}:${attempt}`)).slice(0, 2).padStart(2, "0");
    const nextCode = `${baseCode}${suffix}`;
    const { error } = await admin.from("profiles").update({ referral_code: nextCode }).eq("id", userId).is("referral_code", null);

    if (error) {
      if (error.code === "23505") {
        continue;
      }
      break;
    }

    const { data: savedProfile } = await admin.from("profiles").select("referral_code").eq("id", userId).maybeSingle();
    const savedCode = normalizeReferralCode(savedProfile?.referral_code);
    if (savedCode) {
      return savedCode;
    }
  }

  const { data: existingProfile } = await admin.from("profiles").select("referral_code").eq("id", userId).maybeSingle();
  const savedCode = normalizeReferralCode(existingProfile?.referral_code);
  return savedCode || baseCode;
}

export function getReferralMonthKey(referenceDate = new Date()) {
  const year = referenceDate.getUTCFullYear();
  const month = String(referenceDate.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function hashReferralSeed(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export function sortItemsForViewer<T extends { id: string }>(items: T[], viewerId: string, scope = getReferralMonthKey()) {
  return [...items].sort((left, right) => {
    const leftScore = hashReferralSeed(`${viewerId}:${scope}:${left.id}`);
    const rightScore = hashReferralSeed(`${viewerId}:${scope}:${right.id}`);
    return leftScore - rightScore || left.id.localeCompare(right.id);
  });
}

export function isVerifiedReviewerReferrer(input: {
  role?: string | null;
  membership?: { status?: string | null; current_period_end_at?: string | null; canceled_at?: string | null; last_payment_failed_at?: string | null } | null;
  kycStatus?: string | null;
  emailConfirmedAt?: string | null;
}) {
  return (
    (input.role === "reviewer" || input.role === "tester") &&
    Boolean(input.emailConfirmedAt) &&
    membershipHasAccess(input.membership || null) &&
    input.kycStatus === "approved"
  );
}

export async function syncReferralQualification(input: {
  userId: string;
  role?: string | null;
  emailConfirmedAt?: string | null;
  referredByUserId?: string | null;
  referralQualifiedAt?: string | null;
  membership?: { status?: string | null; current_period_end_at?: string | null; canceled_at?: string | null; last_payment_failed_at?: string | null } | null;
  kycStatus?: string | null;
}) {
  if (!input.referredByUserId || input.referralQualifiedAt) {
    return input.referralQualifiedAt || null;
  }

  const qualifies =
    (input.role === "reviewer" || input.role === "tester") &&
    Boolean(input.emailConfirmedAt) &&
    membershipHasAccess(input.membership || null) &&
    input.kycStatus === "approved";

  if (!qualifies) {
    return null;
  }

  const qualifiedAt = new Date().toISOString();
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ referral_qualified_at: qualifiedAt })
    .eq("id", input.userId)
    .is("referral_qualified_at", null);

  return qualifiedAt;
}

export function getMonthlyRewardedReferralCount(
  referredProfiles: Array<Pick<ReferralProfile, "referred_by_user_id" | "referral_qualified_at">>,
  referrerUserId: string,
  referenceDate = new Date()
) {
  const monthKey = getReferralMonthKey(referenceDate);
  return Math.min(
    referredProfiles.filter(
      (profile) =>
        profile.referred_by_user_id === referrerUserId &&
        profile.referral_qualified_at &&
        getReferralMonthKey(new Date(profile.referral_qualified_at)) === monthKey
    ).length,
    REFERRAL_MONTHLY_CAP
  );
}

export function getProviderAccessLimit(rewardedReferralCount: number) {
  return REFERRAL_BASE_PROVIDER_LIMIT + Math.min(Math.max(rewardedReferralCount, 0), REFERRAL_MONTHLY_CAP) * REFERRAL_REWARD_PROVIDERS;
}

export function buildReferralLink(origin: string, referralCode: string) {
  const url = new URL("/auth", origin);
  url.searchParams.set("mode", "signup");
  url.searchParams.set("role", "reviewer");
  url.searchParams.set("ref", referralCode);
  return url.toString();
}
