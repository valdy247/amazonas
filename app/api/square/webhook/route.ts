import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logWebhookAudit } from "@/lib/webhook-audit";
import { getSquarePaymentStatusFromOrder, getSquareWebhookNotificationUrl, verifySquareWebhookSignature } from "@/lib/square";

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

function extractUserIdFromNote(note?: string) {
  if (!note) return null;
  const match = note.match(/^reviewer_access:([a-f0-9-]{36})$/i);
  return match?.[1] || null;
}

async function activateMembership(input: {
  admin: ReturnType<typeof createAdminClient>;
  userId: string;
  orderId: string | null;
  paymentReference: string | null;
}) {
  const { error: membershipError } = await input.admin
    .from("memberships")
    .update({
      status: "active",
      paid_at: new Date().toISOString(),
      square_subscription_id: input.orderId,
      square_customer_id: input.paymentReference,
    })
    .eq("user_id", input.userId);

  return membershipError;
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
        };
      };
    };
    const payment = event.data?.object?.payment;
    const order = event.data?.object?.order || event.data?.object?.order_updated;
    const admin = createAdminClient();

    if (payment?.status === "COMPLETED") {
      const paymentId = payment.id || null;
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

      const membershipError = await activateMembership({
        admin,
        userId: membershipUserId,
        orderId,
        paymentReference: paymentId || payment.customer_id || null,
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

      const membershipError = await activateMembership({
        admin,
        userId: membershipRow.user_id,
        orderId,
        paymentReference: payment.paymentId,
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
