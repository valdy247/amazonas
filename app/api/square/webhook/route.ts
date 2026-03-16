import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

async function activateMembership(input: {
  admin: ReturnType<typeof createAdminClient>;
  userId: string;
  subscriptionId: string | null;
  customerId: string | null;
  status?: "pending_payment" | "active" | "suspended";
}) {
  const { error: membershipError } = await input.admin
    .from("memberships")
    .update({
      status: input.status || "active",
      paid_at: (input.status || "active") === "active" ? new Date().toISOString() : null,
      square_subscription_id: input.subscriptionId,
      square_customer_id: input.customerId,
    })
    .eq("user_id", input.userId);

  return membershipError;
}

function mapSquareSubscriptionStatus(status?: string) {
  switch (status) {
    case "ACTIVE":
      return "active" as const;
    case "PENDING":
      return "pending_payment" as const;
    case "PAUSED":
    case "CANCELED":
    case "DEACTIVATED":
    case "UNPAID":
      return "suspended" as const;
    default:
      return null;
  }
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

    if (payment?.status === "COMPLETED") {
      const orderId = payment.order_id || null;
      const userIdFromNote = extractUserIdFromNote(payment.note);

      let membershipUserId = userIdFromNote;

      if (!membershipUserId && orderId) {
        const { data: membershipRow } = await admin
          .from("memberships")
          .select("user_id, status")
          .eq("square_subscription_id", orderId)
          .maybeSingle();

        membershipUserId = membershipRow?.user_id || null;
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

      const membershipError = await activateMembership({
        admin,
        userId: membershipUserId,
        subscriptionId: subscriptionMatch?.id || orderId,
        customerId: payment.customer_id || null,
        status: subscriptionMatch ? mapSquareSubscriptionStatus(subscriptionMatch.status || undefined) || "active" : "active",
      });

      if (membershipError) {
        await logWebhookAudit({
          provider: "square",
          eventType: event.type,
          statusCode: 500,
          referenceId: orderId,
          payload: event,
          responseMessage: membershipError.message,
        });
        return NextResponse.json({ ok: false, message: membershipError.message }, { status: 500 });
      }

      await logWebhookAudit({
        provider: "square",
        eventType: event.type,
        statusCode: 200,
        referenceId: subscriptionMatch?.id || orderId,
        payload: event,
        responseMessage: "Membership activated from completed payment.",
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
        .select("user_id")
        .eq("square_subscription_id", orderId)
        .maybeSingle();

      if (!membershipRow?.user_id) {
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

      const membershipError = await activateMembership({
        admin,
        userId: membershipRow.user_id,
        subscriptionId: subscriptionMatch?.id || orderId,
        customerId: payment.customerId,
        status: subscriptionMatch ? mapSquareSubscriptionStatus(subscriptionMatch.status || undefined) || "active" : "active",
      });

      if (membershipError) {
        await logWebhookAudit({
          provider: "square",
          eventType: event.type,
          statusCode: 500,
          referenceId: orderId,
          payload: event,
          responseMessage: membershipError.message,
        });
        return NextResponse.json({ ok: false, message: membershipError.message }, { status: 500 });
      }

      await logWebhookAudit({
        provider: "square",
        eventType: event.type,
        statusCode: 200,
        referenceId: orderId,
        payload: event,
        responseMessage: "Membership activated from order.updated.",
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
        .select("user_id")
        .eq("square_customer_id", customerId)
        .maybeSingle();

      if (!membershipRow?.user_id) {
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

      const { error: membershipError } = await admin
        .from("memberships")
        .update({
          status: membershipStatus,
          square_subscription_id: subscriptionId,
          square_customer_id: customerId,
          paid_at: membershipStatus === "active" ? new Date().toISOString() : null,
        })
        .eq("user_id", membershipRow.user_id);

      if (membershipError) {
        await logWebhookAudit({
          provider: "square",
          eventType: event.type,
          statusCode: 500,
          referenceId: subscriptionId,
          payload: event,
          responseMessage: membershipError.message,
        });
        return NextResponse.json({ ok: false, message: membershipError.message }, { status: 500 });
      }

      await logWebhookAudit({
        provider: "square",
        eventType: event.type,
        statusCode: 200,
        referenceId: subscriptionId,
        payload: event,
        responseMessage: `Membership updated from subscription event: ${membershipStatus}.`,
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
