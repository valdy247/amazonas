import { redirect } from "next/navigation";
import { AdminProviderCreateForm } from "@/components/admin-provider-create-form";
import { AdminExportButton } from "@/components/admin-export-button";
import { AdminOptionsPanel } from "@/components/admin-options-panel";
import { AdminProviderImportStudio } from "@/components/admin-provider-import-studio";
import { AdminProviderManager } from "@/components/admin-provider-manager";
import { AdminSectionNav } from "@/components/admin-section-nav";
import { AdminUserManager } from "@/components/admin-user-manager";
import { SupportCenter } from "@/components/support-center";
import { SiteHeader } from "@/components/site-header";
import { getComparableContactMethods } from "@/lib/provider-contact";
import { hasAdminAccess } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { WHATSAPP_PREFIX_OPTIONS } from "@/lib/whatsapp-prefix-options";

type ProfileRow = { id: string; full_name: string | null; email: string | null; role: string | null };
type MembershipRow = {
  user_id: string;
  status: string;
  current_period_end_at?: string | null;
  canceled_at?: string | null;
  last_payment_failed_at?: string | null;
  square_customer_id?: string | null;
  square_order_id?: string | null;
  square_subscription_id?: string | null;
  paid_at?: string | null;
  updated_at?: string | null;
};
type KycRow = {
  user_id: string;
  status: string;
  reference_id?: string | null;
  verified_full_name?: string | null;
  review_note?: string | null;
  reviewed_at?: string | null;
};
type ContactRow = {
  id: number;
  title: string;
  email?: string | null;
  network: string | null;
  url: string;
  notes?: string | null;
  is_active: boolean;
  is_verified: boolean;
  contact_methods?: string | null;
};
type SupportThreadRow = {
  id: number;
  user_id: string;
  category: string;
  subject: string;
  status: string;
  priority: string;
  last_activity_at: string;
  assigned_admin_id?: string | null;
  created_at?: string | null;
};
type SupportMessageRow = { id: number; thread_id: number; sender_id: string; body: string; created_at: string };
type WebhookAuditRow = {
  provider: string;
  event_type: string | null;
  status_code: number;
  reference_id: string | null;
  response_message: string | null;
  created_at: string;
};
type RequestRow = {
  id: number;
  provider_id: string | null;
  reviewer_id: string | null;
  status: string;
  message: string | null;
  last_activity_at: string | null;
  created_at: string;
};
type RequestMessageRow = { id: number; request_id: number; sender_id: string; body: string; created_at: string };
type AdminAuditRow = {
  id: number;
  admin_id: string | null;
  action: string;
  target_user_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};
type DuplicateGroup = { key: string; reason: string; contactIds: number[]; labels: string[] };

const ADMIN_SECTIONS = [
  { id: "providers", label: "Proveedores" },
  { id: "users", label: "Usuarios" },
  { id: "options", label: "Opciones" },
] as const;
const ADMIN_EXTRA_SECTIONS = [
  { id: "metrics", label: "Metricas" },
  { id: "support", label: "Soporte" },
] as const;

type AdminPageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

function normalizeText(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function resolveSearchValue(raw: string | string[] | undefined) {
  return Array.isArray(raw) ? raw[0] || "" : raw || "";
}

function buildDuplicateGroups(contacts: ContactRow[]): DuplicateGroup[] {
  const buckets = new Map<string, DuplicateGroup>();
  for (const contact of contacts) {
    const email = normalizeText(contact.email);
    const methods = getComparableContactMethods(contact.contact_methods, contact.url, contact.network);
    if (email) {
      const key = `email:${email}`;
      const current = buckets.get(key) || { key, reason: `Duplicado por email: ${email}`, contactIds: [], labels: [] };
      current.contactIds.push(contact.id);
      current.labels.push(`${contact.title} (#${contact.id})`);
      buckets.set(key, current);
    }
    methods.forEach((method) => {
      const key = `method:${method}`;
      const current = buckets.get(key) || { key, reason: `Duplicado por contacto: ${method}`, contactIds: [], labels: [] };
      current.contactIds.push(contact.id);
      current.labels.push(`${contact.title} (#${contact.id})`);
      buckets.set(key, current);
    });
  }
  return Array.from(buckets.values())
    .map((group) => ({ ...group, contactIds: Array.from(new Set(group.contactIds)), labels: Array.from(new Set(group.labels)) }))
    .filter((group) => group.contactIds.length > 1)
    .sort((left, right) => right.contactIds.length - left.contactIds.length);
}

function getLatestAt(...values: Array<string | null | undefined>) {
  const times = values
    .filter(Boolean)
    .map((value) => new Date(String(value)).getTime())
    .filter((value) => Number.isFinite(value));
  return times.length ? new Date(Math.max(...times)).toISOString() : "";
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: profile } = await supabase.from("profiles").select("role, email").eq("id", user.id).single();
  if (!hasAdminAccess(profile?.role, profile?.email || user.email)) redirect("/dashboard");

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const requestedSection = resolveSearchValue(resolvedSearchParams.section);
  const userSearchQuery = resolveSearchValue(resolvedSearchParams.user_q).trim();
  const activeSection = [...ADMIN_SECTIONS, ...ADMIN_EXTRA_SECTIONS].some((section) => section.id === requestedSection)
    ? requestedSection
    : "providers";

  const [
    recentMembersResult,
    allMembershipsResult,
    allKycResult,
    { count: activeMembersCount },
    { count: approvedKycCount },
    { count: kycInReviewCount },
    { count: pendingPaymentCount },
    { count: processingPaymentCount },
    { count: failedPaymentCount },
    { count: canceledMembershipCount },
    { count: chatThreadsCount },
    allMessageThreadsResult,
    { count: supportOpenCount },
    { count: supportResolvedCount },
    webhookLogResult,
  ] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, role").order("created_at", { ascending: false }).limit(150),
    supabase
      .from("memberships")
      .select("user_id, status, current_period_end_at, canceled_at, last_payment_failed_at, square_customer_id, square_order_id, square_subscription_id, paid_at, updated_at"),
    supabase.from("kyc_checks").select("user_id, status, reference_id, verified_full_name, review_note, reviewed_at"),
    supabase.from("memberships").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("kyc_checks").select("*", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("kyc_checks").select("*", { count: "exact", head: true }).eq("status", "in_review"),
    supabase.from("memberships").select("*", { count: "exact", head: true }).eq("status", "pending_payment"),
    supabase.from("memberships").select("*", { count: "exact", head: true }).eq("status", "payment_processing"),
    supabase.from("memberships").select("*", { count: "exact", head: true }).eq("status", "payment_failed"),
    supabase.from("memberships").select("*", { count: "exact", head: true }).eq("status", "canceled"),
    supabase.from("reviewer_contact_requests").select("*", { count: "exact", head: true }),
    supabase.from("request_messages").select("request_id"),
    supabase.from("support_threads").select("*", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
    supabase.from("support_threads").select("*", { count: "exact", head: true }).eq("status", "resolved"),
    supabase
      .from("webhook_audit_logs")
      .select("provider, event_type, status_code, reference_id, response_message, created_at")
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const allMemberships = (allMembershipsResult.data as MembershipRow[] | null) || [];
  const allKycRows = (allKycResult.data as KycRow[] | null) || [];
  const recentMembers = (recentMembersResult.data as ProfileRow[] | null) || [];
  const membershipByUser = new Map(allMemberships.map((item) => [item.user_id, item]));
  const kycByUser = new Map(allKycRows.map((item) => [item.user_id, item]));

  const normalizedSearch = normalizeText(userSearchQuery);
  const matchingMemberIds = new Set<string>();
  if (normalizedSearch) {
    recentMembers.forEach((member) => {
      const membership = membershipByUser.get(member.id);
      const kyc = kycByUser.get(member.id);
      const haystack = [
        member.id,
        member.full_name,
        member.email,
        membership?.square_customer_id,
        membership?.square_order_id,
        membership?.square_subscription_id,
        kyc?.reference_id,
        kyc?.verified_full_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (haystack.includes(normalizedSearch)) matchingMemberIds.add(member.id);
    });
    allMemberships.forEach((membership) => {
      if ([membership.square_customer_id, membership.square_order_id, membership.square_subscription_id].filter(Boolean).join(" ").toLowerCase().includes(normalizedSearch)) {
        matchingMemberIds.add(membership.user_id);
      }
    });
    allKycRows.forEach((kyc) => {
      if ([kyc.reference_id, kyc.verified_full_name].filter(Boolean).join(" ").toLowerCase().includes(normalizedSearch)) {
        matchingMemberIds.add(kyc.user_id);
      }
    });
  }

  let members = normalizedSearch ? recentMembers.filter((member) => matchingMemberIds.has(member.id)) : recentMembers;
  const missingIds = Array.from(matchingMemberIds).filter((id) => !recentMembers.some((member) => member.id === id));
  if (missingIds.length) {
    const { data: extraMembers } = await supabase.from("profiles").select("id, full_name, email, role").in("id", missingIds);
    members = [...members, ...(((extraMembers as ProfileRow[] | null) || []))];
  }
  members = Array.from(new Map(members.map((member) => [member.id, member])).values());
  const memberIds = members.map((member) => member.id);

  const [supportThreadRowsResult, requestRowsResult, adminAuditRowsResult] = memberIds.length
    ? await Promise.all([
        supabase
          .from("support_threads")
          .select("id, user_id, category, subject, status, priority, last_activity_at, assigned_admin_id, created_at")
          .in("user_id", memberIds)
          .order("last_activity_at", { ascending: false })
          .limit(200),
        supabase
          .from("reviewer_contact_requests")
          .select("id, provider_id, reviewer_id, status, message, last_activity_at, created_at")
          .or(`provider_id.in.(${memberIds.join(",")}),reviewer_id.in.(${memberIds.join(",")})`)
          .order("last_activity_at", { ascending: false })
          .limit(300),
        supabase
          .from("admin_audit_logs")
          .select("id, admin_id, action, target_user_id, metadata, created_at")
          .or(`target_user_id.in.(${memberIds.join(",")}),admin_id.in.(${memberIds.join(",")})`)
          .order("created_at", { ascending: false })
          .limit(300),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const supportThreadRows = (supportThreadRowsResult.data as SupportThreadRow[] | null) || [];
  const requestRows = (requestRowsResult.data as RequestRow[] | null) || [];
  const adminAuditRows = (adminAuditRowsResult.data as AdminAuditRow[] | null) || [];

  const supportThreadIds = supportThreadRows.map((row) => row.id);
  const requestIds = requestRows.map((row) => row.id);
  const [supportMessageRowsResult, requestMessageRowsResult] =
    supportThreadIds.length || requestIds.length
      ? await Promise.all([
          supportThreadIds.length
            ? supabase
                .from("support_messages")
                .select("id, thread_id, sender_id, body, created_at")
                .in("thread_id", supportThreadIds)
                .order("created_at", { ascending: true })
            : Promise.resolve({ data: [] as SupportMessageRow[] }),
          requestIds.length
            ? supabase
                .from("request_messages")
                .select("id, request_id, sender_id, body, created_at")
                .in("request_id", requestIds)
                .order("created_at", { ascending: true })
            : Promise.resolve({ data: [] as RequestMessageRow[] }),
        ])
      : [{ data: [] as SupportMessageRow[] }, { data: [] as RequestMessageRow[] }];

  const supportMessageRows = (supportMessageRowsResult.data as SupportMessageRow[] | null) || [];
  const requestMessageRows = (requestMessageRowsResult.data as RequestMessageRow[] | null) || [];
  const supportUserIds = Array.from(new Set(supportThreadRows.flatMap((row) => [row.user_id, row.assigned_admin_id].filter(Boolean) as string[])));
  const supportProfilesResult = supportUserIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", supportUserIds)
    : { data: [] };
  const supportProfiles =
    (supportProfilesResult.data as Array<{ id: string; full_name: string | null; email: string | null }> | null) || [];
  const supportProfileMap = new Map(supportProfiles.map((item) => [item.id, item]));

  const reviewerCount = members.filter((member) => member.role === "reviewer" || member.role === "tester").length;
  const providerCount = members.filter((member) => member.role === "provider").length;
  const chatsStartedCount = new Set(((allMessageThreadsResult.data as Array<{ request_id: number }> | null) || []).map((item) => item.request_id)).size;
  const kycApprovalRate = Math.round(((approvedKycCount || 0) / Math.max((approvedKycCount || 0) + (kycInReviewCount || 0), 1)) * 100);
  const supportResolutionRate = Math.round(((supportResolvedCount || 0) / Math.max((supportResolvedCount || 0) + (supportOpenCount || 0), 1)) * 100);
  const webhookRows = ((webhookLogResult.data as WebhookAuditRow[] | null) || []);
  const webhookFailureCount = webhookRows.filter((row) => row.status_code >= 400).length;

  const supportThreadCountByUser = new Map<string, number>();
  const requestCountByUser = new Map<string, number>();
  const adminActionCountByUser = new Map<string, number>();
  const historyByUser = new Map<
    string,
    Array<{ id: string; type: "payment" | "kyc" | "support" | "chat" | "admin"; title: string; body: string; at: string }>
  >();

  const pushHistory = (
    userId: string,
    entry: { id: string; type: "payment" | "kyc" | "support" | "chat" | "admin"; title: string; body: string; at: string }
  ) => {
    const current = historyByUser.get(userId) || [];
    current.push(entry);
    historyByUser.set(userId, current);
  };

  members.forEach((member) => {
    const membership = membershipByUser.get(member.id);
    if (membership) {
      pushHistory(member.id, {
        id: `membership-${member.id}`,
        type: "payment",
        title: `Membresia ${membership.status}`,
        body:
          [
            membership.square_customer_id ? `Customer ${membership.square_customer_id}` : null,
            membership.square_order_id ? `Order ${membership.square_order_id}` : null,
            membership.square_subscription_id ? `Subscription ${membership.square_subscription_id}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Estado actualizado en Square o por admin.",
        at: getLatestAt(membership.updated_at, membership.paid_at, membership.current_period_end_at, membership.canceled_at, membership.last_payment_failed_at),
      });
    }
    const kyc = kycByUser.get(member.id);
    if (kyc) {
      pushHistory(member.id, {
        id: `kyc-${member.id}`,
        type: "kyc",
        title: `KYC ${kyc.status}`,
        body: [kyc.reference_id ? `Ref ${kyc.reference_id}` : null, kyc.verified_full_name || null, kyc.review_note || null]
          .filter(Boolean)
          .join(" · ") || "Estado de verificacion actualizado.",
        at: getLatestAt(kyc.reviewed_at),
      });
    }
  });

  supportThreadRows.forEach((thread) => {
    supportThreadCountByUser.set(thread.user_id, (supportThreadCountByUser.get(thread.user_id) || 0) + 1);
    const threadMessages = supportMessageRows.filter((message) => message.thread_id === thread.id);
    pushHistory(thread.user_id, {
      id: `support-${thread.id}`,
      type: "support",
      title: `Soporte: ${thread.subject}`,
      body: [`Estado ${thread.status}`, `Prioridad ${thread.priority}`, threadMessages.length ? `${threadMessages.length} mensajes` : null]
        .filter(Boolean)
        .join(" · "),
      at: getLatestAt(thread.last_activity_at, thread.created_at, threadMessages.at(-1)?.created_at),
    });
  });

  requestRows.forEach((request) => {
    const requestMessages = requestMessageRows.filter((message) => message.request_id === request.id);
    const body = [`Estado ${request.status}`, request.message ? `Mensaje inicial: ${request.message}` : null, requestMessages.length ? `${requestMessages.length} mensajes` : null]
      .filter(Boolean)
      .join(" · ");
    if (request.provider_id) {
      requestCountByUser.set(request.provider_id, (requestCountByUser.get(request.provider_id) || 0) + 1);
      pushHistory(request.provider_id, {
        id: `request-provider-${request.id}`,
        type: "chat",
        title: "Chat con reseñador",
        body,
        at: getLatestAt(request.last_activity_at, request.created_at, requestMessages.at(-1)?.created_at),
      });
    }
    if (request.reviewer_id) {
      requestCountByUser.set(request.reviewer_id, (requestCountByUser.get(request.reviewer_id) || 0) + 1);
      pushHistory(request.reviewer_id, {
        id: `request-reviewer-${request.id}`,
        type: "chat",
        title: "Chat con proveedor",
        body,
        at: getLatestAt(request.last_activity_at, request.created_at, requestMessages.at(-1)?.created_at),
      });
    }
  });

  adminAuditRows.forEach((log) => {
    if (log.target_user_id) {
      adminActionCountByUser.set(log.target_user_id, (adminActionCountByUser.get(log.target_user_id) || 0) + 1);
      pushHistory(log.target_user_id, {
        id: `audit-target-${log.id}`,
        type: "admin",
        title: `Admin: ${log.action}`,
        body: JSON.stringify(log.metadata || {}),
        at: log.created_at,
      });
    }
    if (log.admin_id && memberIds.includes(log.admin_id)) {
      adminActionCountByUser.set(log.admin_id, (adminActionCountByUser.get(log.admin_id) || 0) + 1);
      pushHistory(log.admin_id, {
        id: `audit-admin-${log.id}`,
        type: "admin",
        title: `Accion ejecutada: ${log.action}`,
        body: log.target_user_id ? `Sobre ${log.target_user_id}` : JSON.stringify(log.metadata || {}),
        at: log.created_at,
      });
    }
  });

  const userExportRows = members.map((member) => ({
    user_id: member.id,
    full_name: member.full_name || "",
    email: member.email || "",
    role: member.role || "",
    membership_status: membershipByUser.get(member.id)?.status || "pending_payment",
    membership_period_end_at: membershipByUser.get(member.id)?.current_period_end_at || "",
    membership_canceled_at: membershipByUser.get(member.id)?.canceled_at || "",
    membership_last_payment_failed_at: membershipByUser.get(member.id)?.last_payment_failed_at || "",
    square_customer_id: membershipByUser.get(member.id)?.square_customer_id || "",
    square_order_id: membershipByUser.get(member.id)?.square_order_id || "",
    square_subscription_id: membershipByUser.get(member.id)?.square_subscription_id || "",
    kyc_status: kycByUser.get(member.id)?.status || "pending",
    kyc_reference_id: kycByUser.get(member.id)?.reference_id || "",
    verified_full_name: kycByUser.get(member.id)?.verified_full_name || "",
    kyc_review_note: kycByUser.get(member.id)?.review_note || "",
    support_threads: supportThreadCountByUser.get(member.id) || 0,
    chat_threads: requestCountByUser.get(member.id) || 0,
    admin_actions: adminActionCountByUser.get(member.id) || 0,
  }));

  const webhookExportRows = webhookRows.map((row) => ({
    provider: row.provider,
    event_type: row.event_type || "",
    status_code: row.status_code,
    reference_id: row.reference_id || "",
    response_message: row.response_message || "",
    created_at: row.created_at,
  }));

  const supportExportRows = supportThreadRows.map((thread) => {
    const profileForThread = supportProfileMap.get(thread.user_id);
    return {
      thread_id: thread.id,
      user_name: profileForThread?.full_name || "Usuario",
      user_email: profileForThread?.email || "",
      subject: thread.subject,
      category: thread.category,
      status: thread.status,
      priority: thread.priority || "normal",
      assigned_admin: thread.assigned_admin_id ? supportProfileMap.get(thread.assigned_admin_id)?.full_name || "Soporte" : "",
      last_activity_at: thread.last_activity_at,
    };
  });

  let contacts: ContactRow[] = [];
  const withMethods = await supabase
    .from("provider_contacts")
    .select("id, title, email, network, url, notes, is_active, is_verified, contact_methods")
    .order("created_at", { ascending: false });

  if (withMethods.error) {
    const withVerification = await supabase.from("provider_contacts").select("id, title, network, url, notes, is_active, is_verified").order("created_at", { ascending: false });
    if (withVerification.error) {
      const withNotes = await supabase.from("provider_contacts").select("id, title, network, url, notes, is_active").order("created_at", { ascending: false });
      if (withNotes.error) {
        const fallback = await supabase.from("provider_contacts").select("id, title, network, url, is_active").order("created_at", { ascending: false });
        contacts = (fallback.data || []).map((contact) => ({ ...contact, email: null, notes: null, is_verified: false, contact_methods: null })) as ContactRow[];
      } else {
        contacts = (withNotes.data || []).map((contact) => ({ ...contact, email: null, is_verified: false, contact_methods: null })) as ContactRow[];
      }
    } else {
      contacts = (withVerification.data || []).map((contact) => ({ ...contact, email: null, contact_methods: null })) as ContactRow[];
    }
  } else {
    contacts = (withMethods.data || []) as ContactRow[];
  }

  const duplicateGroups = buildDuplicateGroups(contacts);
  const providerExportRows = contacts.map((contact) => ({
    contact_id: contact.id,
    alias: contact.title,
    email: contact.email || "",
    network: contact.network || "",
    url: contact.url,
    notes: contact.notes || "",
    is_active: contact.is_active,
    is_verified: contact.is_verified,
    contact_methods: contact.contact_methods || "",
    duplicate_group_count: duplicateGroups.filter((group) => group.contactIds.includes(contact.id)).length,
  }));

  return (
    <div className="min-h-screen">
      <SiteHeader
        menuItems={[
          { href: "/dashboard", label: "Inicio" },
          { href: "/admin?section=metrics", label: "Metricas" },
          { href: "/admin?section=support", label: "Soporte" },
          { href: "/profile", label: "Editar perfil" },
        ]}
      />
      <main className="container-x space-y-7 pt-8 pb-6">
        <section className="pt-3">
          <AdminSectionNav sections={[...ADMIN_SECTIONS, ...ADMIN_EXTRA_SECTIONS]} activeSection={activeSection} />
        </section>

        <section className="rounded-[1.8rem] border border-[#1f1b17] bg-[linear-gradient(135deg,#201915_0%,#2c221a_55%,#3f2a1d_100%)] px-5 pb-5 pt-10 text-white shadow-[0_26px_80px_rgba(35,22,13,0.22)]">
          <p className="text-xs uppercase tracking-[0.24em] text-white/55">Control Center</p>
          <h1 className="mt-2 text-3xl font-bold">Panel admin</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/70">
            Vista operativa para historiales, soporte, pagos, verificacion, proveedores y salud general del sistema.
          </p>
        </section>

        <section className="grid gap-4">
          {activeSection === "providers" ? (
            <>
              <div className="card p-4">
                <AdminProviderImportStudio />
              </div>
              <div className="card p-4">
                <AdminProviderCreateForm whatsappPrefixOptions={WHATSAPP_PREFIX_OPTIONS} />
              </div>
              <div className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-bold">Lista de proveedores</h2>
                    <p className="mt-1 text-sm text-[#62626d]">Buscador, exportacion y deduplicacion visible por contacto o email.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#fff2eb] px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#dc4f1f]">{contacts.length} contactos</span>
                    <AdminExportButton filename="admin-provider-contacts.csv" rows={providerExportRows} label="Exportar proveedores" />
                  </div>
                </div>
                {contacts.length ? (
                  <AdminProviderManager contacts={contacts} whatsappPrefixOptions={WHATSAPP_PREFIX_OPTIONS} duplicateGroups={duplicateGroups} />
                ) : (
                  <div className="mt-4 rounded-[1.2rem] border border-dashed border-[#e2d8cc] bg-[#fffaf5] p-5 text-sm text-[#62626d]">No hay contactos de proveedores cargados todavia.</div>
                )}
              </div>
            </>
          ) : null}

          {activeSection === "users" ? (
            <div className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold">Usuarios</h2>
                  <p className="mt-1 text-sm text-[#62626d]">Historial consolidado por usuario con pago, KYC, soporte, chats y cambios admin.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#fff2eb] px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#dc4f1f]">{members.length} visibles</span>
                  <AdminExportButton filename="admin-users.csv" rows={userExportRows} label="Exportar usuarios" />
                </div>
              </div>
              <form className="mt-4 rounded-[1.2rem] border border-[#eadfd6] bg-[#fcfaf7] p-3" action="/admin">
                <input type="hidden" name="section" value="users" />
                <label className="text-sm font-semibold text-[#131316]" htmlFor="user-q">Buscador rapido del panel</label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input id="user-q" name="user_q" className="input flex-1" defaultValue={userSearchQuery} placeholder="Email, user id, referencia KYC o Square id" />
                  <button className="btn-secondary" type="submit">Buscar</button>
                </div>
              </form>
              <AdminUserManager
                initialQuery={userSearchQuery}
                members={members.map((member) => ({
                  id: member.id,
                  full_name: member.full_name,
                  email: member.email,
                  role: member.role,
                  membershipStatus: membershipByUser.get(member.id)?.status || "pending_payment",
                  membershipCurrentPeriodEndAt: membershipByUser.get(member.id)?.current_period_end_at || null,
                  membershipCanceledAt: membershipByUser.get(member.id)?.canceled_at || null,
                  membershipLastPaymentFailedAt: membershipByUser.get(member.id)?.last_payment_failed_at || null,
                  membershipSquareCustomerId: membershipByUser.get(member.id)?.square_customer_id || null,
                  membershipSquareOrderId: membershipByUser.get(member.id)?.square_order_id || null,
                  membershipSquareSubscriptionId: membershipByUser.get(member.id)?.square_subscription_id || null,
                  kycStatus: kycByUser.get(member.id)?.status || "pending",
                  kycReferenceId: kycByUser.get(member.id)?.reference_id || null,
                  kycVerifiedFullName: kycByUser.get(member.id)?.verified_full_name || null,
                  kycReviewNote: kycByUser.get(member.id)?.review_note || null,
                  kycReviewedAt: kycByUser.get(member.id)?.reviewed_at || null,
                  history: (historyByUser.get(member.id) || []).filter((entry) => entry.at).sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime()).slice(0, 12),
                  supportCount: supportThreadCountByUser.get(member.id) || 0,
                  chatCount: requestCountByUser.get(member.id) || 0,
                  adminActionCount: adminActionCountByUser.get(member.id) || 0,
                }))}
              />
            </div>
          ) : null}
          {activeSection === "options" ? <AdminOptionsPanel /> : null}

          {activeSection === "metrics" ? (
            <div className="card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold">Metricas</h2>
                  <p className="mt-1 text-sm text-[#62626d]">Una vista operativa de conversion, soporte, mensajeria y salud tecnica.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#fff2eb] px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#dc4f1f]">Vista interna</span>
                  <AdminExportButton filename="webhook-audit.csv" rows={webhookExportRows} label="Exportar webhooks" />
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <MetricCard title="Proveedores" value={contacts.length} body="Contactos cargados en el sistema." />
                <MetricCard title="Reseñadores" value={reviewerCount} body="Perfiles visibles de reseñadores en la lista actual." />
                <MetricCard title="Providers" value={providerCount} body="Perfiles visibles de providers en la lista actual." />
                <MetricCard title="Membresias activas" value={activeMembersCount || 0} body="Usuarios con acceso completo por pago." />
                <MetricCard title="Pago pendiente" value={pendingPaymentCount || 0} body="Usuarios que aun no inician o completan el primer pago." />
                <MetricCard title="Validando pago" value={processingPaymentCount || 0} body="Usuarios esperando confirmacion final de Square." />
                <MetricCard title="Cobro fallido" value={failedPaymentCount || 0} body="Renovaciones o pagos con problema reciente." />
                <MetricCard title="Canceladas" value={canceledMembershipCount || 0} body="Suscripciones canceladas desde Square." />
                <MetricCard title="KYC aprobados" value={approvedKycCount || 0} body="Identidades validadas correctamente." />
                <MetricCard title="KYC en revision" value={kycInReviewCount || 0} body="Casos que requieren mirada manual." />
                <MetricCard title="Aprobacion KYC" value={`${kycApprovalRate}%`} body="Conversion entre aprobados y casos en revision." />
                <MetricCard title="Hilos iniciados" value={chatThreadsCount || 0} body="Contactos entre providers y reseñadores." />
                <MetricCard title="Chats activos" value={chatsStartedCount} body="Conversaciones con al menos un mensaje." />
                <MetricCard title="Soporte abierto" value={supportOpenCount || 0} body="Casos que siguen pendientes o en proceso." />
                <MetricCard title="Resolucion soporte" value={`${supportResolutionRate}%`} body="Casos resueltos frente a abiertos." />
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="rounded-[1.4rem] border border-[#eadfd6] bg-[#fffaf7] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-bold text-[#131316]">Webhook health</h3>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${webhookFailureCount ? "bg-[#fff1f1] text-[#c24d3a]" : "bg-[#eef9f0] text-[#177a52]"}`}>
                      {webhookFailureCount ? `${webhookFailureCount} fallos recientes` : "Sin fallos recientes"}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {webhookRows.slice(0, 10).map((row, index) => (
                      <div key={`${row.provider}-${row.reference_id || index}`} className="rounded-[1rem] bg-white px-3 py-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-[#131316]">{row.provider}{row.event_type ? ` · ${row.event_type}` : ""}</p>
                            <p className="mt-1 text-xs text-[#8f857b]">{new Date(row.created_at).toLocaleString()}{row.reference_id ? ` · ${row.reference_id}` : ""}</p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${row.status_code >= 400 ? "bg-[#fff1f1] text-[#c24d3a]" : "bg-[#eef9f0] text-[#177a52]"}`}>{row.status_code}</span>
                        </div>
                        {row.response_message ? <p className="mt-2 text-xs text-[#62564a]">{row.response_message}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-[1.4rem] border border-[#eadfd6] bg-[#fffaf7] p-4">
                  <h3 className="font-bold text-[#131316]">Lectura operativa</h3>
                  <div className="mt-3 space-y-3 text-sm text-[#62564a]">
                    <div className="rounded-[1rem] bg-white px-3 py-3"><p className="font-semibold text-[#131316]">Atencion inmediata</p><p className="mt-1">Tienes {kycInReviewCount || 0} casos KYC en revision y {supportOpenCount || 0} tickets de soporte activos.</p></div>
                    <div className="rounded-[1rem] bg-white px-3 py-3"><p className="font-semibold text-[#131316]">Embudo de ingresos</p><p className="mt-1">{pendingPaymentCount || 0} usuarios siguen sin pagar y {activeMembersCount || 0} ya tienen acceso activo.</p></div>
                    <div className="rounded-[1rem] bg-white px-3 py-3"><p className="font-semibold text-[#131316]">Mensajeria</p><p className="mt-1">{chatsStartedCount} conversaciones ya tienen mensajes reales y {chatThreadsCount || 0} hilos fueron iniciados.</p></div>
                    <div className="rounded-[1rem] bg-white px-3 py-3"><p className="font-semibold text-[#131316]">Duplicados</p><p className="mt-1">{duplicateGroups.length} grupos necesitan revision para no contaminar el directorio.</p></div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeSection === "support" ? (
            <div className="space-y-4">
              <div className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-bold">Exportacion de soporte</h2>
                    <p className="mt-1 text-sm text-[#62626d]">Descarga el estado actual de tickets para analisis externo o seguimiento.</p>
                  </div>
                  <AdminExportButton filename="support-threads.csv" rows={supportExportRows} label="Exportar soporte" />
                </div>
              </div>
              <SupportCenter
                currentUserId={user.id}
                language="es"
                isAdmin
                threads={supportThreadRows.map((thread) => {
                  const profileForThread = supportProfileMap.get(thread.user_id);
                  return {
                    id: thread.id,
                    userId: thread.user_id,
                    userName: profileForThread?.full_name || "Usuario",
                    userEmail: profileForThread?.email || "",
                    subject: thread.subject,
                    category: thread.category,
                    status: thread.status,
                    priority: thread.priority || "normal",
                    lastActivityAt: thread.last_activity_at,
                    assignedAdminId: thread.assigned_admin_id || null,
                    assignedAdminName: thread.assigned_admin_id ? supportProfileMap.get(thread.assigned_admin_id)?.full_name || "Soporte" : null,
                    messages: supportMessageRows.filter((message) => message.thread_id === thread.id).map((message) => ({
                      id: message.id,
                      senderId: message.sender_id,
                      senderName: message.sender_id === user.id ? "Soporte" : profileForThread?.full_name || "Usuario",
                      body: message.body,
                      createdAt: message.created_at,
                    })),
                  };
                })}
              />
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function MetricCard({ title, value, body }: { title: string; value: string | number; body: string }) {
  return (
    <div className="rounded-[1.4rem] border border-[#eadfd6] bg-[#fffaf7] p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-[#8f857b]">{title}</p>
      <p className="mt-2 text-3xl font-bold text-[#131316]">{value}</p>
      <p className="mt-1 text-sm text-[#62626d]">{body}</p>
    </div>
  );
}
