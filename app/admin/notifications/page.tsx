import { redirect } from "next/navigation";
import { AdminNotificationInbox } from "@/components/admin-notification-inbox";
import { SiteHeader } from "@/components/site-header";
import { hasAdminAccess } from "@/lib/admin";
import {
  buildAuditNotification,
  buildFailedPaymentNotification,
  buildSignupNotification,
  buildWebhookErrorNotification,
  type AdminNotificationItem,
  type AdminSupportInboxItem,
} from "@/lib/admin-notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

type SupportThreadRow = {
  id: number;
  user_id: string;
  subject: string;
  status: string;
  priority: string;
  last_activity_at: string;
};

export default async function AdminNotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: profile } = await supabase.from("profiles").select("role, email").eq("id", user.id).single();
  if (!hasAdminAccess(profile?.role, profile?.email || user.email)) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();
  const [auditResult, profileResult, failedMembershipsResult, webhookErrorsResult, supportThreadsResult] = await Promise.all([
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
    admin
      .from("support_threads")
      .select("id, user_id, subject, status, priority, last_activity_at")
      .order("last_activity_at", { ascending: false })
      .limit(25),
  ]);

  const auditRows = (auditResult.data || []) as AuditRow[];
  const recentProfiles = (profileResult.data || []) as ProfileRow[];
  const failedMemberships = (failedMembershipsResult.data || []) as MembershipRow[];
  const webhookErrors = (webhookErrorsResult.data || []) as WebhookAuditRow[];
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

  const items: AdminNotificationItem[] = [
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
      .filter((item): item is AdminNotificationItem => Boolean(item)),
    ...recentProfiles.filter((item) => item.role !== "admin").map((item) => buildSignupNotification(item)),
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
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 40);

  const supportItems: AdminSupportInboxItem[] = supportThreads.map((thread) => ({
    id: thread.id,
    subject: thread.subject,
    userLabel: String(profileMap.get(thread.user_id)?.full_name || profileMap.get(thread.user_id)?.email || "Usuario"),
    status: thread.status,
    priority: thread.priority,
    lastActivityAt: thread.last_activity_at,
    href: "/admin?section=support",
  }));

  return (
    <div className="min-h-screen bg-[#0f0f10]">
      <SiteHeader
        showAdminNotifications
        menuItems={[
          { href: "/dashboard", label: "Inicio" },
          { href: "/admin?section=summary", label: "Resumen" },
          { href: "/admin/notifications", label: "Inbox admin" },
          { href: "/admin?section=support", label: "Soporte" },
          { href: "/profile", label: "Editar perfil" },
        ]}
      />

      <main className="container-x py-8">
        <AdminNotificationInbox items={items} supportItems={supportItems} />
      </main>
    </div>
  );
}
