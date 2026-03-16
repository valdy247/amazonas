import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeLanguage, type AppLanguage } from "@/lib/i18n";

type PushSubscriptionRecord = {
  id: number;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

const WEB_PUSH_PUBLIC_KEY = process.env.WEB_PUSH_PUBLIC_KEY;
const WEB_PUSH_PRIVATE_KEY = process.env.WEB_PUSH_PRIVATE_KEY;
const WEB_PUSH_SUBJECT = process.env.WEB_PUSH_SUBJECT || "mailto:support@verifyzon.com";

let pushConfigured = false;

if (WEB_PUSH_PUBLIC_KEY && WEB_PUSH_PRIVATE_KEY) {
  webpush.setVapidDetails(WEB_PUSH_SUBJECT, WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY);
  pushConfigured = true;
}

export function isWebPushConfigured() {
  return pushConfigured;
}

export function getWebPushPublicKey() {
  return WEB_PUSH_PUBLIC_KEY || "";
}

export function getLocalizedPushTitle(language: AppLanguage) {
  return language === "en" ? "New message on Verifyzon" : "Nuevo mensaje en Verifyzon";
}

export function getLocalizedPushBody(language: AppLanguage, senderName: string, preview: string) {
  if (language === "en") {
    return `${senderName}: ${preview}`;
  }

  return `${senderName}: ${preview}`;
}

export async function savePushSubscription(input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}) {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: input.userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.userAgent || null,
      updated_at: now,
      last_seen_at: now,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function sendPushNotificationToUser(userId: string, payload: PushPayload) {
  if (!pushConfigured) {
    return;
  }

  const admin = createAdminClient();
  const { data: subscriptions, error } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error || !(subscriptions || []).length) {
    return;
  }

  const serializedPayload = JSON.stringify(payload);

  await Promise.allSettled(
    (subscriptions as PushSubscriptionRecord[]).map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          serializedPayload
        );
      } catch (error) {
        const statusCode =
          typeof error === "object" && error && "statusCode" in error && typeof error.statusCode === "number"
            ? error.statusCode
            : 0;

        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", subscription.id);
        }
      }
    })
  );
}

export function normalizePushLanguage(value: unknown) {
  return normalizeLanguage(value);
}
