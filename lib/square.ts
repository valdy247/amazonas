export type SquareEnvironment = "sandbox" | "production";

export function getSquareEnvironment(): SquareEnvironment {
  return process.env.SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox";
}

export function getSquareApiBaseUrl() {
  return getSquareEnvironment() === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
}

export function getSquareAccessToken() {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error("Missing SQUARE_ACCESS_TOKEN.");
  }

  return accessToken;
}

export function getSquareMembershipAmount() {
  const rawAmount = process.env.SQUARE_MEMBERSHIP_AMOUNT;

  if (!rawAmount) {
    if (getSquareEnvironment() === "sandbox") {
      return 100;
    }

    throw new Error("Missing SQUARE_MEMBERSHIP_AMOUNT.");
  }

  const amount = Number(rawAmount);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("SQUARE_MEMBERSHIP_AMOUNT must be a positive integer in the smallest currency unit.");
  }

  return amount;
}

export function getSquareCurrency() {
  return process.env.SQUARE_CURRENCY || "USD";
}

export function getSquareWebhookSignatureKey() {
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;

  if (!signatureKey) {
    throw new Error("Missing SQUARE_WEBHOOK_SIGNATURE_KEY.");
  }

  return signatureKey;
}

function toBase64(buffer: ArrayBuffer) {
  return Buffer.from(buffer).toString("base64");
}

export async function verifySquareWebhookSignature(input: {
  body: string;
  signature: string | null;
  notificationUrl: string;
}) {
  if (!input.signature) {
    return false;
  }

  const signatureKey = getSquareWebhookSignatureKey();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signatureKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const payload = `${input.notificationUrl}${input.body}`;
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));

  return toBase64(digest) === input.signature;
}

export async function createSquarePaymentLink(input: {
  userId: string;
  email: string;
  fullName: string;
  redirectUrl: string;
}) {
  const accessToken = getSquareAccessToken();
  const amount = getSquareMembershipAmount();
  const currency = getSquareCurrency();
  const response = await fetch(`${getSquareApiBaseUrl()}/v2/online-checkout/payment-links`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": "2025-10-16",
    },
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      description: `Membresia reviewer para ${input.email}`,
      quick_pay: {
        name: "Membresia Amazona Review",
        price_money: {
          amount,
          currency,
        },
        location_id: process.env.SQUARE_LOCATION_ID || undefined,
      },
      checkout_options: {
        redirect_url: input.redirectUrl,
      },
      payment_note: `reviewer_access:${input.userId}`,
      pre_populated_data: {
        buyer_email: input.email,
      },
    }),
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(JSON.stringify(payload));
  }

  const paymentLink = payload.payment_link as Record<string, unknown> | undefined;
  const orderId = typeof paymentLink?.order_id === "string" ? paymentLink.order_id : null;
  const url = typeof paymentLink?.url === "string" ? paymentLink.url : null;

  if (!orderId || !url) {
    throw new Error("Square did not return a valid payment link.");
  }

  return { orderId, url };
}

export function getSquareWebhookNotificationUrl(headers: Headers) {
  const forwardedProto = headers.get("x-forwarded-proto") || "https";
  const forwardedHost = headers.get("x-forwarded-host") || headers.get("host");

  if (!forwardedHost) {
    throw new Error("Missing host headers for webhook verification.");
  }

  return `${forwardedProto}://${forwardedHost}/api/square/webhook`;
}
