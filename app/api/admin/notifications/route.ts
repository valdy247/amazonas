import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasAdminAccess } from "@/lib/admin";
import {
  buildAuditNotification,
  buildFailedPaymentNotification,
  buildSignupNotification,
  buildWebhookErrorNotification,
} from "@/lib/admin-notifications";
import { buildDuplicateContactGroups } from "@/lib/provider-quality";
import type { AdminNotificationItem, AdminSupportInboxItem } from "@/lib/admin-notifications";

type AuditRow = {
  id: number;
  admin_id: string | null;
  action: string;
  target_user_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  created_at: string;
};

type MembershipRow = {
  user_id: string;
  status: string;
  updated_at: string | null;
  last_payment_failed_at: string | null;
};

type WebhookAuditRow = {
  provider: string;
  event_type: string | null;
  status_code: number;
  reference_id: string | null;
  created_at: string;
};

type ContactRow = {
  id: number;
  email?: string | null;
  network: string | null;
  url: string;
  contact_methods?: string | null;
};

type SupportThreadRow = {
  id: number;
  user_id: string;
  subject: string;
  status: string;
  priority: string;
  last_activity_at: string;
};

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const { data: profile } = await supabase.from("profiles").select("role, email").eq("id", user.id).single();
    if (!hasAdminAccess(profile?.role, profile?.email || user.email)) {
      return NextResponse.json({ error: "Solo admin." }, { status: 403 });
    }

    const admin = createAdminClient();
    const [
      auditResult,
      profileResult,
      failedMembershipsResult,
      webhookErrorsResult,
      supportCountResult,
      supportThreadsResult,
      removalCountResult,
      reportsCountResult,
      contactsResult,
    ] = await Promise.all([
      admin.from("admin_audit_logs").select("id, admin_id, action, target_user_id, metadata, created_at").order("created_at", { ascending: false }).limit(40),
      admin.from("profiles").select("id, full_name, email, role, created_at").order("created_at", { ascending: false }).limit(16),
      admin
        .from("memberships")
        .select("user_id, status, updated_at, last_payment_failed_at")
        .eq("status", "payment_failed")
        .order("updated_at", { ascending: false })
        .limit(10),
      admin
        .from("webhook_audit_logs")
        .select("provider, event_type, status_code, reference_id, created_at")
        .gte("status_code", 400)
        .order("created_at", { ascending: false })
        .limit(10),
      admin.from("support_threads").select("*", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
      admin
        .from("support_threads")
        .select("id, user_id, subject, status, priority, last_activity_at")
        .order("last_activity_at", { ascending: false })
        .limit(25),
      admin.from("directory_removal_requests").select("*", { count: "exact", head: true }).in("status", ["open", "in_review"]),
      admin.from("provider_contact_reports").select("*", { count: "exact", head: true }).in("status", ["open", "in_review"]),
      admin.from("provider_contacts").select("id, email, network, url, contact_methods"),
    ]);

    const auditRows = (auditResult.data || []) as AuditRow[];
    const recentProfiles = (profileResult.data || []) as ProfileRow[];
    const failedMemberships = (failedMembershipsResult.data || []) as MembershipRow[];
    const webhookErrors = (webhookErrorsResult.data || []) as WebhookAuditRow[];
    const contacts = (contactsResult.data || []) as ContactRow[];
    const supportThreads = (supportThreadsResult.data || []) as SupportThreadRow[];

    const profileIds = Array.from(
      new Set([
        ...recentProfiles.map((item) => item.id),
        ...auditRows.flatMap((item) => [item.admin_id, item.target_user_id]).filter(Boolean) as string[],
        ...failedMemberships.map((item) => item.user_id),
        ...supportThreads.map((item) => item.user_id),
      ])
    );

    const actorProfiles = profileIds.length
      ? (
          await admin
            .from("profiles")
            .select("id, full_name, email")
            .in("id", profileIds)
        ).data || []
      : [];
    const profileMap = new Map(
      actorProfiles.map((item) => [
        item.id,
        { full_name: item.full_name as string | null, email: item.email as string | null },
      ])
    );

    const notifications: AdminNotificationItem[] = [
      ...auditRows
        .map((row) =>
          buildAuditNotification({
            ...row,
            actorName: row.admin_id ? profileMap.get(row.admin_id)?.full_name : null,
            actorEmail: row.admin_id ? profileMap.get(row.admin_id)?.email : null,
            targetName: row.target_user_id ? profileMap.get(row.target_user_id)?.full_name : null,
            targetEmail: row.target_user_id ? profileMap.get(row.target_user_id)?.email : null,
          })
        )
        .filter(Boolean),
      ...recentProfiles
        .filter((item) => item.role !== "admin")
        .map((item) => buildSignupNotification(item)),
      ...failedMemberships.map((item) =>
        buildFailedPaymentNotification({
          userId: item.user_id,
          userName: profileMap.get(item.user_id)?.full_name,
          userEmail: profileMap.get(item.user_id)?.email,
          createdAt: item.last_payment_failed_at || item.updated_at || new Date().toISOString(),
        })
      ),
      ...webhookErrors.map((item) =>
        buildWebhookErrorNotification({
          provider: item.provider,
          eventType: item.event_type,
          statusCode: item.status_code,
          referenceId: item.reference_id,
          createdAt: item.created_at,
        })
      ),
    ]
      .filter((item): item is AdminNotificationItem => Boolean(item))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 40);

    const duplicateGroups = buildDuplicateContactGroups(contacts);
    const supportItems: AdminSupportInboxItem[] = supportThreads.map((thread) => ({
      id: thread.id,
      subject: thread.subject,
      userLabel: String(profileMap.get(thread.user_id)?.full_name || profileMap.get(thread.user_id)?.email || "Usuario"),
      status: thread.status,
      priority: thread.priority,
      lastActivityAt: thread.last_activity_at,
      href: "/admin?section=support",
    }));

    return NextResponse.json({
      items: notifications,
      supportItems,
      summary: {
        openSupport: supportCountResult.count || 0,
        openRemovalRequests: removalCountResult.count || 0,
        reviewReports: reportsCountResult.count || 0,
        duplicateGroups: duplicateGroups.length,
        failedPayments: failedMemberships.length,
        webhookErrors: webhookErrors.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudieron cargar las notificaciones.",
      },
      { status: 500 }
    );
  }
}
