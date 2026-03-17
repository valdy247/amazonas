import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeMembershipStatus } from "@/lib/membership";
import {
  findMembershipUserIdBySquareCustomer,
  mapSquareSubscriptionStatus,
  updateMembershipFromSquare,
} from "@/lib/square-membership";
import { logWebhookAudit } from "@/lib/webhook-audit";
import {
  getSquarePaymentStatusFromOrder,
  getSquareWebhookNotificationUrl,
  searchSquareSubscriptionByCustomer,
  verifySquareWebhookSignature,
} from "@/lib/square";

type SquarePaymentObject = {
  id?: string;
  status?: string;
  order_id?: string;
  customer_id?: string;
  note?: string;
};

type SquareOrderObject = {
  id?: string;
  state?: string;
  order_id?: string;
  location_id?: string;
};

type SquareSubscriptionObject = {
  id?: string;
  customer_id?: string;
  plan_variation_id?: string;
  status?: string;
  charged_through_date?: string;
  canceled_date?: string;
};

function extractUserIdFromNote(note?: string) {
  if (!note) return null;
  const match = note.match(/^reviewer_access:([a-f0-9-]{36})$/i);
  return match?.[1] || null;
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature");

  try {
    const notificationUrl = getSquareWebhookNotificationUrl(request.headers);
    const isValid = await verifySquareWebhookSignature({
      body,
      signature,
      notificationUrl,
    });

    if (!isValid) {
      await logWebhookAudit({
        provider: "square",
        eventType: "signature",
        statusCode: 401,
        payload: body,
        responseMessage: "Invalid Square signature.",
      });
      return NextResponse.json({ ok: false, message: "Invalid Square signature." }, { status: 401 });
    }

    const event = JSON.parse(body) as {
      type?: string;
      data?: {
        object?: {
          payment?: SquarePaymentObject;
          order?: SquareOrderObject;
          order_updated?: SquareOrderObject;
          subscription?: SquareSubscriptionObject;
        };
      };
    };
    const payment = event.data?.object?.payment;
    const order = event.data?.object?.order || event.data?.object?.order_updated;
    const subscription = event.data?.object?.subscription;
    const admin = createAdminClient();
    const eventOccurredAt = new Date().toISOString();

    if (payment?.status === "COMPLETED") {
      const orderId = payment.order_id || null;
      const userIdFromNote = extractUserIdFromNote(payment.note);

      let membershipUserId = userIdFromNote;
      let existingMembership:
        | {
            user_id: string;
            status: string | null;
            paid_at: string | null;
            current_period_end_at: string | null;
            canceled_at: string | null;
            last_payment_failed_at: string | null;
            square_customer_id: string | null;
            square_order_id: string | null;
            square_subscription_id: string | null;
            last_square_event_type: string | null;
            last_square_event_at: string | null;
          }
        | null = null;

      if (!membershipUserId && orderId) {
        const { data: membershipRow } = await admin
          .from("memberships")
          .select("user_id, status, paid_at, current_period_end_at, canceled_at, last_payment_failed_at, square_customer_id, square_order_id, square_subscription_id, last_square_event_type, last_square_event_at")
          .eq("square_order_id", orderId)
          .maybeSingle();

        existingMembership = membershipRow || null;
        membershipUserId = membershipRow?.user_id || null;
      }

      if (!membershipUserId) {
        membershipUserId = await findMembershipUserIdBySquareCustomer({
          admin,
          customerId: payment.customer_id || null,
        });
      }

      if (!membershipUserId) {
        await logWebhookAudit({
          provider: "square",
          eventType: event.type,
          statusCode: 404,
          referenceId: orderId,
          payload: event,
          responseMessage: "No membership matched this Square payment.",
        });
        return NextResponse.json({ ok: false, message: "No membership matched this Square payment." }, { status: 404 });
      }

      const subscriptionMatch =
        payment.customer_id ? await searchSquareSubscriptionByCustomer(payment.customer_id) : null;

      const membershipUpdate = await updateMembershipFromSquare({
        admin,
        userId: membershipUserId,
        previousMembership: existingMembership,
        status: subscriptionMatch ? mapSquareSubscriptionStatus(subscriptionMatch.status || undefined) || "active" : "active",
        subscriptionId: subscriptionMatch?.id || null,
        orderId,
        customerId: payment.customer_id || null,
        currentPeriodEndAt: subscriptionMatch?.paidUntilDate || subscriptionMatch?.chargedThroughDate || null,
        canceledAt: subscriptionMatch?.canceledDate || null,
        eventType: event.type || "payment.updated",
        eventOccurredAt,
      });

      await logWebhookAudit({
        provider: "square",
        eventType: event.type,
        statusCode: 200,
        referenceId: subscriptionMatch?.id || orderId,
        payload: event,
        responseMessage:
          membershipUpdate.emailResult?.sent
            ? `Membership updated from completed payment: ${normalizeMembershipStatus(membershipUpdate.nextMembership.status)}. Email sent.`
            : `Membership updated from completed payment: ${normalizeMembershipStatus(membershipUpdate.nextMembership.status)}.${membershipUpdate.emailResult?.reason ? ` ${membershipUpdate.emailResult.reason}` : ""}`,
      });
      return NextResponse.json({ ok: true });
    }

    if (event.type === "order.updated") {
      const orderId = order?.id || order?.order_id || null;

      if (!orderId) {
        await logWebhookAudit({
          provider: "square",
          eventType: event.type,
          statusCode: 200,
          payload: event,
          responseMessage: "Ignored order.updated without order id.",
        });
        return NextResponse.json({ ok: true, ignored: true, source: "order.updated-without-id" });
      }

      const payment = await getSquarePaymentStatusFromOrder({
        orderId,
        locationId: order?.location_id || null,
      });

      if (!payment || payment.status !== "COMPLETED") {
        await logWebhookAudit({
          provider: "square",
          eventType: event.type,
          statusCode: 200,
          referenceId: orderId,
          payload: event,
          responseMessage: "Ignored order.updated because payment is not completed.",
        });
        return NextResponse.json({ ok: true, ignored: true, source: "order.updated-payment-not-completed" });
      }

      const { data: membershipRow } = await admin
        .from("memberships")
        .select("user_id, status, paid_at, current_period_end_at, canceled_at, last_payment_failed_at, square_customer_id, square_order_id, square_subscription_id, last_square_event_type, last_square_event_at")
        .eq("square_order_id", orderId)
        .maybeSingle();

      const membershipUserId =
        membershipRow?.user_id ||
        (await findMembershipUserIdBySquareCustomer({
          admin,
          customerId: payment.customerId,
        }));

      if (!membershipUserId) {
        await logWebhookAudit({
          provider: "square",
          eventType: event.type,
          statusCode: 404,
          referenceId: orderId,
          payload: event,
          responseMessage: "No membership matched this Square order.",
        });
        return NextResponse.json({ ok: false, message: "No membership matched this Square order." }, { status: 404 });
      }

      const subscriptionMatch = payment.customerId
        ? await searchSquareSubscriptionByCustomer(payment.customerId)
        : null;

      const membershipUpdate = await updateMembershipFromSquare({
        admin,
        userId: membershipUserId,
        previousMembership: membershipRow || null,
        subscriptionId: subscriptionMatch?.id || null,
        orderId,
        customerId: payment.customerId,
        status: subscriptionMatch ? mapSquareSubscriptionStatus(subscriptionMatch.status || undefined) || "active" : "active",
        currentPeriodEndAt: subscriptionMatch?.paidUntilDate || subscriptionMatch?.chargedThroughDate || null,
        canceledAt: subscriptionMatch?.canceledDate || null,
        eventType: event.type || "order.updated",
        eventOccurredAt,
      });

      await logWebhookAudit({
        provider: "square",
        eventType: event.type,
        statusCode: 200,
        referenceId: orderId,
        payload: event,
        responseMessage:
          membershipUpdate.emailResult?.sent
            ? `Membership updated from order.updated: ${normalizeMembershipStatus(membershipUpdate.nextMembership.status)}. Email sent.`
            : `Membership updated from order.updated: ${normalizeMembershipStatus(membershipUpdate.nextMembership.status)}.${membershipUpdate.emailResult?.reason ? ` ${membershipUpdate.emailResult.reason}` : ""}`,
      });
      return NextResponse.json({ ok: true, source: "order.updated" });
    }

    if (subscription?.id || event.type === "subscription.created" || event.type === "subscription.updated") {
      const customerId = subscription?.customer_id || null;
      const subscriptionId = subscription?.id || null;
      const membershipStatus = mapSquareSubscriptionStatus(subscription?.status);

      if (!customerId || !subscriptionId || !membershipStatus) {
        await logWebhookAudit({
          provider: "square",
          eventType: event.type,
          statusCode: 200,
          referenceId: subscriptionId,
          payload: event,
          responseMessage: "Ignored subscription event without usable subscription data.",
        });
        return NextResponse.json({ ok: true, ignored: true, source: "subscription-incomplete" });
      }

      const { data: membershipRow } = await admin
        .from("memberships")
        .select("user_id, status, paid_at, current_period_end_at, canceled_at, last_payment_failed_at, square_customer_id, square_order_id, square_subscription_id, last_square_event_type, last_square_event_at")
        .eq("square_customer_id", customerId)
        .maybeSingle();

      const membershipUserId =
        membershipRow?.user_id ||
        (await findMembershipUserIdBySquareCustomer({
          admin,
          customerId,
        }));

      if (!membershipUserId) {
        await logWebhookAudit({
          provider: "square",
          eventType: event.type,
          statusCode: 404,
          referenceId: subscriptionId,
          payload: event,
          responseMessage: "No membership matched this Square subscription.",
        });
        return NextResponse.json({ ok: false, message: "No membership matched this Square subscription." }, { status: 404 });
      }

      const membershipUpdate = await updateMembershipFromSquare({
        admin,
        userId: membershipUserId,
        previousMembership: membershipRow || null,
        status: membershipStatus,
        subscriptionId,
        customerId,
        currentPeriodEndAt: subscription?.charged_through_date || null,
        canceledAt: subscription?.canceled_date || null,
        eventType: event.type || "subscription.updated",
        eventOccurredAt,
      });

      await logWebhookAudit({
        provider: "square",
        eventType: event.type,
        statusCode: 200,
        referenceId: subscriptionId,
        payload: event,
        responseMessage:
          membershipUpdate.emailResult?.sent
            ? `Membership updated from subscription event: ${membershipStatus}. Email sent.`
            : `Membership updated from subscription event: ${membershipStatus}.${membershipUpdate.emailResult?.reason ? ` ${membershipUpdate.emailResult.reason}` : ""}`,
      });
      return NextResponse.json({ ok: true, source: "subscription" });
    }

    await logWebhookAudit({
      provider: "square",
      eventType: event.type,
      statusCode: 200,
      payload: event,
      responseMessage: "Ignored Square event.",
    });
    return NextResponse.json({ ok: true, ignored: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Square webhook failed.";
    await logWebhookAudit({
      provider: "square",
      statusCode: 500,
      payload: body,
      responseMessage: message,
    });
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
