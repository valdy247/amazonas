import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSquareWebhookNotificationUrl, verifySquareWebhookSignature } from "@/lib/square";

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
      return NextResponse.json({ ok: false, message: "Invalid Square signature." }, { status: 401 });
    }

    const event = JSON.parse(body) as {
      type?: string;
      data?: { object?: { payment?: SquarePaymentObject; order?: SquareOrderObject } };
    };
    const payment = event.data?.object?.payment;
    const order = event.data?.object?.order;
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
        return NextResponse.json({ ok: false, message: "No membership matched this Square payment." }, { status: 404 });
      }

      const membershipError = await activateMembership({
        admin,
        userId: membershipUserId,
        orderId,
        paymentReference: paymentId || payment.customer_id || null,
      });

      if (membershipError) {
        return NextResponse.json({ ok: false, message: membershipError.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    if (event.type === "order.updated" && order?.id && order.state === "COMPLETED") {
      const { data: membershipRow } = await admin
        .from("memberships")
        .select("user_id")
        .eq("square_subscription_id", order.id)
        .maybeSingle();

      if (!membershipRow?.user_id) {
        return NextResponse.json({ ok: false, message: "No membership matched this Square order." }, { status: 404 });
      }

      const membershipError = await activateMembership({
        admin,
        userId: membershipRow.user_id,
        orderId: order.id,
        paymentReference: order.id,
      });

      if (membershipError) {
        return NextResponse.json({ ok: false, message: membershipError.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, source: "order.updated" });
    }

    return NextResponse.json({ ok: true, ignored: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Square webhook failed.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
