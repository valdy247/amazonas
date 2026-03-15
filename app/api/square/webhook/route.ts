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
      return NextResponse.json({ ok: false, message: "Invalid Square signature." }, { status: 401 });
    }

    const event = JSON.parse(body) as {
      type?: string;
      data?: { object?: { payment?: SquarePaymentObject } };
    };
    const payment = event.data?.object?.payment;

    if (!payment || payment.status !== "COMPLETED") {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const admin = createAdminClient();
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

    const { error: membershipError } = await admin
      .from("memberships")
      .update({
        status: "active",
        paid_at: new Date().toISOString(),
        square_subscription_id: orderId,
        square_customer_id: paymentId || payment.customer_id || null,
      })
      .eq("user_id", membershipUserId);

    if (membershipError) {
      return NextResponse.json({ ok: false, message: membershipError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Square webhook failed.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
