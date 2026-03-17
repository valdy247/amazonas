import { createAdminClient } from "@/lib/supabase/admin";

type AuditInput = {
  actorId?: string | null;
  action: string;
  targetUserId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logActionAudit(input: AuditInput) {
  try {
    const admin = createAdminClient();
    await admin.from("admin_audit_logs").insert({
      admin_id: input.actorId || null,
      action: input.action,
      target_user_id: input.targetUserId || null,
      metadata: input.metadata || {},
    });
  } catch {
    // Do not break the main flow if audit logging fails.
  }
}
