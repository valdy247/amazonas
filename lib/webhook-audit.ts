import { createAdminClient } from "@/lib/supabase/admin";

export async function logWebhookAudit(input: {
  provider: "square" | "veriff";
  eventType?: string | null;
  statusCode: number;
  referenceId?: string | null;
  payload?: unknown;
  responseMessage?: string | null;
}) {
  try {
    const admin = createAdminClient();
    await admin.from("webhook_audit_logs").insert({
      provider: input.provider,
      event_type: input.eventType || null,
      status_code: input.statusCode,
      reference_id: input.referenceId || null,
      payload: input.payload ?? null,
      response_message: input.responseMessage || null,
    });
  } catch {
    // Do not break webhooks because audit logging failed.
  }
}
