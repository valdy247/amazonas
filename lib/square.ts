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

export function getSquareSubscriptionPlanVariationId() {
  const planVariationId = process.env.SQUARE_SUBSCRIPTION_PLAN_VARIATION_ID;

  if (!planVariationId) {
    throw new Error("Missing SQUARE_SUBSCRIPTION_PLAN_VARIATION_ID.");
  }

  return planVariationId;
}

export function getSquareWebhookSignatureKey() {
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;

  if (!signatureKey) {
    throw new Error("Missing SQUARE_WEBHOOK_SIGNATURE_KEY.");
  }

  return signatureKey;
}

async function getSquareLocationId() {
  const configuredLocationId = process.env.SQUARE_LOCATION_ID;
  if (configuredLocationId) {
    return configuredLocationId;
  }

  const accessToken = getSquareAccessToken();
  const response = await fetch(`${getSquareApiBaseUrl()}/v2/locations`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": "2025-10-16",
    },
    cache: "no-store",
  });
  const payload = (await response.json()) as { locations?: Array<{ id?: string; status?: string }> };

  if (!response.ok) {
    throw new Error(`Square locations lookup failed: ${JSON.stringify(payload)}`);
  }

  const activeLocation = payload.locations?.find((location) => location.status === "ACTIVE" && typeof location.id === "string");
  if (!activeLocation?.id) {
    throw new Error("Square did not return an active location. Set SQUARE_LOCATION_ID manually.");
  }

  return activeLocation.id;
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
  const locationId = await getSquareLocationId();
  const planVariationId = getSquareSubscriptionPlanVariationId();
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
        name: "Verifyzon Membership",
        price_money: {
          amount,
          currency,
        },
        location_id: locationId,
      },
      checkout_options: {
        redirect_url: input.redirectUrl,
        subscription_plan_id: planVariationId,
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

type SquareSubscriptionStatus =
  | "PENDING"
  | "ACTIVE"
  | "CANCELED"
  | "PAUSED"
  | "DEACTIVATED"
  | "UNPAID";

export async function searchSquareSubscriptionByCustomer(customerId: string) {
  const accessToken = getSquareAccessToken();
  const locationId = await getSquareLocationId();
  const planVariationId = getSquareSubscriptionPlanVariationId();
  const response = await fetch(`${getSquareApiBaseUrl()}/v2/subscriptions/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": "2025-10-16",
    },
    body: JSON.stringify({
      query: {
        filter: {
          location_ids: [locationId],
          customer_ids: [customerId],
        },
      },
    }),
    cache: "no-store",
  });

  const payload = (await response.json()) as {
    subscriptions?: Array<{
      id?: string;
      customer_id?: string;
      plan_variation_id?: string;
      status?: SquareSubscriptionStatus;
      created_at?: string;
      paid_until_date?: string;
      charged_through_date?: string;
      canceled_date?: string;
    }>;
  };

  if (!response.ok) {
    throw new Error(`Square subscriptions search failed: ${JSON.stringify(payload)}`);
  }

  const subscriptions = (payload.subscriptions || [])
    .filter((subscription) => subscription.plan_variation_id === planVariationId)
    .sort((a, b) => {
      const aTime = a.created_at ? Date.parse(a.created_at) : 0;
      const bTime = b.created_at ? Date.parse(b.created_at) : 0;
      return bTime - aTime;
    });

  const subscription = subscriptions[0];

  if (!subscription?.id) {
    return null;
  }

  return {
    id: subscription.id,
    customerId: subscription.customer_id || customerId,
    status: subscription.status || null,
    paidUntilDate: subscription.paid_until_date || null,
    chargedThroughDate: subscription.charged_through_date || null,
    canceledDate: subscription.canceled_date || null,
  };
}

export async function getSquareCustomer(customerId: string) {
  const accessToken = getSquareAccessToken();
  const response = await fetch(`${getSquareApiBaseUrl()}/v2/customers/${customerId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": "2025-10-16",
    },
    cache: "no-store",
  });

  const payload = (await response.json()) as {
    customer?: {
      id?: string;
      email_address?: string;
      phone_number?: string;
      given_name?: string;
      family_name?: string;
    };
  };

  if (!response.ok) {
    throw new Error(`Square customer lookup failed: ${JSON.stringify(payload)}`);
  }

  return {
    id: payload.customer?.id || customerId,
    email: payload.customer?.email_address || null,
    phone: payload.customer?.phone_number || null,
    givenName: payload.customer?.given_name || null,
    familyName: payload.customer?.family_name || null,
  };
}

export async function getSquarePaymentStatusFromOrder(input: {
  orderId: string;
  locationId?: string | null;
}) {
  const accessToken = getSquareAccessToken();
  const locationId = input.locationId || (await getSquareLocationId());
  const orderResponse = await fetch(`${getSquareApiBaseUrl()}/v2/orders/${input.orderId}?location_id=${encodeURIComponent(locationId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": "2025-10-16",
    },
    cache: "no-store",
  });
  const orderPayload = (await orderResponse.json()) as {
    order?: {
      tenders?: Array<{
        id?: string;
        payment_id?: string;
      }>;
    };
  };

  if (!orderResponse.ok) {
    throw new Error(`Square order lookup failed: ${JSON.stringify(orderPayload)}`);
  }

  const paymentId = orderPayload.order?.tenders?.find((tender) => typeof tender.payment_id === "string")?.payment_id;
  if (!paymentId) {
    return null;
  }

  const paymentResponse = await fetch(`${getSquareApiBaseUrl()}/v2/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": "2025-10-16",
    },
    cache: "no-store",
  });
  const paymentPayload = (await paymentResponse.json()) as {
    payment?: {
      id?: string;
      status?: string;
      customer_id?: string;
    };
  };

  if (!paymentResponse.ok) {
    throw new Error(`Square payment lookup failed: ${JSON.stringify(paymentPayload)}`);
  }

  return {
    paymentId: paymentPayload.payment?.id || paymentId,
    status: paymentPayload.payment?.status || null,
    customerId: paymentPayload.payment?.customer_id || null,
  };
}

export function getSquareWebhookNotificationUrl(headers: Headers) {
  const forwardedProto = headers.get("x-forwarded-proto") || "https";
  const forwardedHost = headers.get("x-forwarded-host") || headers.get("host");

  if (!forwardedHost) {
    throw new Error("Missing host headers for webhook verification.");
  }

  return `${forwardedProto}://${forwardedHost}/api/square/webhook`;
}
