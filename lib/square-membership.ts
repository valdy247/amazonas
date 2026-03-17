import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeLanguage, type AppLanguage } from "@/lib/i18n";
import {
  getSquareCustomer,
  getSquarePaymentStatusFromOrder,
  searchSquareSubscriptionByCustomer,
} from "@/lib/square";
import {
  normalizeMembershipStatus,
  shouldTreatMembershipAsRenewal,
  type MembershipRow,
  type MembershipStatus,
} from "@/lib/membership";
import { sendMembershipLifecycleEmail } from "@/lib/membership-email";

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export type MembershipProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  preferred_language: AppLanguage | null;
};

export type SquareSubscriptionSnapshot = {
  id: string;
  customerId: string | null;
  status: string | null;
  currentPeriodEndAt: string | null;
  canceledAt: string | null;
};

export function mapSquareSubscriptionStatus(status?: string | null): MembershipStatus | null {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "PENDING":
      return "payment_processing";
    case "UNPAID":
      return "payment_failed";
    case "CANCELED":
    case "DEACTIVATED":
      return "canceled";
    case "PAUSED":
      return "suspended";
    default:
      return null;
  }
}

function getCurrentPeriodEndFromSquare(input: {
  paidUntilDate?: string | null;
  chargedThroughDate?: string | null;
}) {
  return input.paidUntilDate || input.chargedThroughDate || null;
}

export async function findMembershipUserIdBySquareCustomer(input: {
  admin: SupabaseAdmin;
  customerId: string | null;
}) {
  if (!input.customerId) {
    return null;
  }

  const customer = await getSquareCustomer(input.customerId);
  if (!customer.email) {
    return null;
  }

  const normalizedEmail = customer.email.trim().toLowerCase();
  const { data: profile } = await input.admin.from("profiles").select("id").eq("email", normalizedEmail).maybeSingle();
  return profile?.id || null;
}

async function sendMembershipTransitionEmail(input: {
  profile: MembershipProfile | null;
  previousMembership: MembershipRow | null;
  nextMembership: MembershipRow;
}) {
  const profile = input.profile;
  if (!profile?.email) {
    return null;
  }

  const previousStatus = normalizeMembershipStatus(input.previousMembership?.status);
  const nextStatus = normalizeMembershipStatus(input.nextMembership.status);
  const language = normalizeLanguage(profile.preferred_language);

  if (previousStatus !== "active" && nextStatus === "active") {
    return sendMembershipLifecycleEmail({
      to: profile.email,
      fullName: profile.full_name,
      language,
      kind: "payment_success",
      currentPeriodEndAt: input.nextMembership.current_period_end_at,
    });
  }

  if (
    shouldTreatMembershipAsRenewal({
      previousStatus,
      previousPeriodEndAt: input.previousMembership?.current_period_end_at,
      nextStatus,
      nextPeriodEndAt: input.nextMembership.current_period_end_at,
    })
  ) {
    return sendMembershipLifecycleEmail({
      to: profile.email,
      fullName: profile.full_name,
      language,
      kind: "renewal_success",
      currentPeriodEndAt: input.nextMembership.current_period_end_at,
    });
  }

  if (previousStatus !== "payment_failed" && nextStatus === "payment_failed") {
    return sendMembershipLifecycleEmail({
      to: profile.email,
      fullName: profile.full_name,
      language,
      kind: "payment_failed",
      currentPeriodEndAt: input.nextMembership.current_period_end_at,
    });
  }

  if (previousStatus !== "canceled" && nextStatus === "canceled") {
    return sendMembershipLifecycleEmail({
      to: profile.email,
      fullName: profile.full_name,
      language,
      kind: "membership_canceled",
      currentPeriodEndAt: input.nextMembership.current_period_end_at,
    });
  }

  return null;
}

export async function updateMembershipFromSquare(input: {
  admin: SupabaseAdmin;
  userId: string;
  previousMembership?: MembershipRow | null;
  previousProfile?: MembershipProfile | null;
  status: MembershipStatus;
  customerId?: string | null;
  orderId?: string | null;
  subscriptionId?: string | null;
  currentPeriodEndAt?: string | null;
  canceledAt?: string | null;
  eventType?: string | null;
  eventOccurredAt?: string | null;
}) {
  let previousMembership = input.previousMembership || null;
  if (!previousMembership) {
    const { data } = await input.admin
      .from("memberships")
      .select("status, paid_at, current_period_end_at, canceled_at, last_payment_failed_at, square_customer_id, square_order_id, square_subscription_id, last_square_event_type, last_square_event_at")
      .eq("user_id", input.userId)
      .maybeSingle();
    previousMembership = (data as MembershipRow | null) || null;
  }

  let previousProfile = input.previousProfile || null;
  if (!previousProfile) {
    const { data } = await input.admin
      .from("profiles")
      .select("id, email, full_name, preferred_language")
      .eq("id", input.userId)
      .maybeSingle();
    previousProfile = (data as MembershipProfile | null) || null;
  }

  const nextMembership: MembershipRow = {
    status: input.status,
    paid_at:
      input.status === "active"
        ? previousMembership?.paid_at || new Date().toISOString()
        : normalizeMembershipStatus(previousMembership?.status) === "active"
          ? previousMembership?.paid_at || new Date().toISOString()
          : null,
    current_period_end_at: input.currentPeriodEndAt || previousMembership?.current_period_end_at || null,
    canceled_at: input.status === "canceled" ? input.canceledAt || new Date().toISOString() : null,
    last_payment_failed_at: input.status === "payment_failed" ? new Date().toISOString() : previousMembership?.last_payment_failed_at || null,
    square_customer_id: input.customerId || previousMembership?.square_customer_id || null,
    square_order_id: input.orderId || previousMembership?.square_order_id || null,
    square_subscription_id: input.subscriptionId || previousMembership?.square_subscription_id || null,
    last_square_event_type: input.eventType || null,
    last_square_event_at: input.eventOccurredAt || new Date().toISOString(),
  };

  if (input.status === "active") {
    nextMembership.canceled_at = null;
    nextMembership.last_payment_failed_at = null;
  }

  const { error } = await input.admin
    .from("memberships")
    .update({
      status: nextMembership.status,
      paid_at: nextMembership.paid_at || null,
      current_period_end_at: nextMembership.current_period_end_at || null,
      canceled_at: nextMembership.canceled_at || null,
      last_payment_failed_at: nextMembership.last_payment_failed_at || null,
      square_customer_id: nextMembership.square_customer_id || null,
      square_order_id: nextMembership.square_order_id || null,
      square_subscription_id: nextMembership.square_subscription_id || null,
      last_square_event_type: nextMembership.last_square_event_type || null,
      last_square_event_at: nextMembership.last_square_event_at || null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", input.userId);

  if (error) {
    throw new Error(error.message);
  }

  const emailResult = await sendMembershipTransitionEmail({
    profile: previousProfile,
    previousMembership,
    nextMembership,
  });

  return {
    previousMembership,
    nextMembership,
    emailResult,
  };
}

export async function reconcileMembershipFromSquare(input: {
  admin: SupabaseAdmin;
  userId: string;
  membership: MembershipRow;
}) {
  const customerId = input.membership.square_customer_id || null;
  const orderId = input.membership.square_order_id || null;

  if (!customerId && !orderId) {
    return { updated: false, reason: "missing-square-identifiers" as const };
  }

  let resolvedCustomerId = customerId;
  if (!resolvedCustomerId && orderId) {
    const payment = await getSquarePaymentStatusFromOrder({ orderId });
    resolvedCustomerId = payment?.customerId || null;
  }

  if (!resolvedCustomerId) {
    return { updated: false, reason: "missing-customer" as const };
  }

  const subscription = await searchSquareSubscriptionByCustomer(resolvedCustomerId);
  if (!subscription) {
    return { updated: false, reason: "missing-subscription" as const };
  }

  const mappedStatus = mapSquareSubscriptionStatus(subscription.status);
  if (!mappedStatus) {
    return { updated: false, reason: "unsupported-status" as const };
  }

  const currentStatus = normalizeMembershipStatus(input.membership.status);
  if (
    currentStatus === mappedStatus &&
    (input.membership.square_subscription_id || null) === subscription.id &&
    (input.membership.current_period_end_at || null) === (subscription.paidUntilDate || subscription.chargedThroughDate || null)
  ) {
    return { updated: false, reason: "already-current" as const };
  }

  const updateResult = await updateMembershipFromSquare({
    admin: input.admin,
    userId: input.userId,
    previousMembership: input.membership,
    status: mappedStatus,
    customerId: subscription.customerId,
    orderId,
    subscriptionId: subscription.id,
    currentPeriodEndAt: getCurrentPeriodEndFromSquare(subscription),
    canceledAt: subscription.canceledDate,
    eventType: "reconcile",
  });

  return {
    updated: true,
    reason: "synced" as const,
    nextMembership: updateResult.nextMembership,
    emailResult: updateResult.emailResult,
  };
}

export function buildSquareSubscriptionSnapshot(
  subscription: {
    id?: string;
    customer_id?: string;
    status?: string;
    charged_through_date?: string;
    canceled_date?: string;
  } | null | undefined
): SquareSubscriptionSnapshot | null {
  if (!subscription?.id) {
    return null;
  }

  return {
    id: subscription.id,
    customerId: subscription.customer_id || null,
    status: subscription.status || null,
    currentPeriodEndAt: subscription.charged_through_date || null,
    canceledAt: subscription.canceled_date || null,
  };
}
