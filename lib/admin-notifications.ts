import { normalizeLanguage, type AppLanguage } from "@/lib/i18n";

export type AdminNotificationItem = {
  id: string;
  kind:
    | "audit"
    | "user_signup"
    | "support"
    | "report"
    | "billing"
    | "webhook";
  title: string;
  body: string;
  href: string;
  createdAt: string;
};

export type AdminNotificationSummary = {
  openSupport: number;
  openRemovalRequests: number;
  reviewReports: number;
  duplicateGroups: number;
  failedPayments: number;
  webhookErrors: number;
};

export type AdminSupportInboxItem = {
  id: number;
  subject: string;
  userLabel: string;
  status: string;
  priority: string;
  lastActivityAt: string;
  href: string;
};

const ADMIN_NOTIFICATION_COPY = {
  es: {
    unknownUser: "Usuario",
    provider: "Proveedor",
    reviewer: "Reseñador",
    tester: "Tester",
    admin: "Admin",
    importCompleted: "Importación completada",
    importCompletedBody: (actor: string, createdCount: number | string, skippedCount: number | string) =>
      `${actor} importó ${createdCount || 0} proveedores y omitió ${skippedCount || 0}.`,
    newSupportTicket: "Nuevo ticket de soporte",
    newSupportTicketBody: (target: string, subject: string) => `${target} abrió el caso "${subject}".`,
    newSupportReply: "Respuesta nueva en soporte",
    newSupportReplyBody: (target: string) => `${target} respondió en un ticket existente.`,
    newProviderReport: "Nuevo reporte de proveedor",
    newProviderReportBody: (reportType: string) => `Se marcó un contacto como ${reportType || "requiere revisión"}.`,
    removalRequest: "Solicitud de eliminación",
    removalRequestBody: (channel: string) => `Nuevo pedido para revisar ${channel || "contacto"} del directorio.`,
    providerAdded: "Proveedor agregado",
    providerAddedBody: (actor: string, title: string) => `${actor} creó ${title || "un proveedor"} en el directorio.`,
    providerUpdated: "Proveedor actualizado",
    providerUpdatedBody: (actor: string, contactId: string) => `${actor} actualizó el contacto #${contactId}.`,
    providerDeleted: "Proveedor eliminado",
    providerDeletedBody: (actor: string, contactId: string) => `${actor} eliminó el contacto #${contactId}.`,
    duplicateRemoved: "Duplicado eliminado",
    duplicateRemovedFallback: "Se eliminó un proveedor duplicado durante calidad.",
    userStatusUpdated: "Estado de usuario actualizado",
    userStatusUpdatedBody: (actor: string, target: string) => `${actor} cambió membresía o KYC de ${target}.`,
    newAdminAssigned: "Nuevo admin asignado",
    newAdminAssignedBody: (actor: string, target: string) => `${actor} promovió a ${target} como admin.`,
    emailUpdated: "Email actualizado",
    emailUpdatedBody: (actor: string, target: string) => `${actor} cambió el correo de ${target}.`,
    adminMarkedContact: "Admin marcó un contacto",
    adminMarkedContactBody: (actor: string, contactId: string, reportType: string) =>
      `${actor} marcó el contacto #${contactId} como ${reportType || "revisión"}.`,
    reportReviewed: "Reporte revisado",
    reportReviewedBody: (actor: string) => `${actor} actualizó la revisión de un contacto reportado.`,
    removalReviewed: "Solicitud de baja revisada",
    removalReviewedBody: (actor: string) => `${actor} actualizó una solicitud de eliminación del directorio.`,
    newUser: "Nuevo usuario registrado",
    newUserBody: (roleLabel: string, userLabel: string) => `${roleLabel}: ${userLabel}`,
    paymentFailed: "Cobro fallido",
    paymentFailedBody: (userLabel: string) => `${userLabel} tiene un fallo de cobro en membresía.`,
    webhookError: "Webhook con error",
    webhookErrorBody: (provider: string, statusCode: number, eventType?: string | null) =>
      `${provider} devolvió ${statusCode}${eventType ? ` en ${eventType}` : ""}.`,
  },
  en: {
    unknownUser: "User",
    provider: "Provider",
    reviewer: "Reviewer",
    tester: "Tester",
    admin: "Admin",
    importCompleted: "Import completed",
    importCompletedBody: (actor: string, createdCount: number | string, skippedCount: number | string) =>
      `${actor} imported ${createdCount || 0} providers and skipped ${skippedCount || 0}.`,
    newSupportTicket: "New support ticket",
    newSupportTicketBody: (target: string, subject: string) => `${target} opened the case "${subject}".`,
    newSupportReply: "New support reply",
    newSupportReplyBody: (target: string) => `${target} replied in an existing ticket.`,
    newProviderReport: "New provider report",
    newProviderReportBody: (reportType: string) => `A contact was flagged as ${reportType || "needs review"}.`,
    removalRequest: "Removal request",
    removalRequestBody: (channel: string) => `A new request was submitted to review ${channel || "a contact"} in the directory.`,
    providerAdded: "Provider added",
    providerAddedBody: (actor: string, title: string) => `${actor} created ${title || "a provider"} in the directory.`,
    providerUpdated: "Provider updated",
    providerUpdatedBody: (actor: string, contactId: string) => `${actor} updated contact #${contactId}.`,
    providerDeleted: "Provider deleted",
    providerDeletedBody: (actor: string, contactId: string) => `${actor} deleted contact #${contactId}.`,
    duplicateRemoved: "Duplicate removed",
    duplicateRemovedFallback: "A duplicate provider was removed during quality review.",
    userStatusUpdated: "User status updated",
    userStatusUpdatedBody: (actor: string, target: string) => `${actor} changed membership or KYC for ${target}.`,
    newAdminAssigned: "New admin assigned",
    newAdminAssignedBody: (actor: string, target: string) => `${actor} promoted ${target} to admin.`,
    emailUpdated: "Email updated",
    emailUpdatedBody: (actor: string, target: string) => `${actor} changed the email for ${target}.`,
    adminMarkedContact: "Admin flagged a contact",
    adminMarkedContactBody: (actor: string, contactId: string, reportType: string) =>
      `${actor} marked contact #${contactId} as ${reportType || "review"}.`,
    reportReviewed: "Report reviewed",
    reportReviewedBody: (actor: string) => `${actor} updated the review of a reported contact.`,
    removalReviewed: "Removal request reviewed",
    removalReviewedBody: (actor: string) => `${actor} updated a directory removal request.`,
    newUser: "New user registered",
    newUserBody: (roleLabel: string, userLabel: string) => `${roleLabel}: ${userLabel}`,
    paymentFailed: "Payment failed",
    paymentFailedBody: (userLabel: string) => `${userLabel} has a failed membership charge.`,
    webhookError: "Webhook error",
    webhookErrorBody: (provider: string, statusCode: number, eventType?: string | null) =>
      `${provider} returned ${statusCode}${eventType ? ` on ${eventType}` : ""}.`,
  },
} as const;

function getAdminNotificationCopy(language: AppLanguage) {
  return ADMIN_NOTIFICATION_COPY[normalizeLanguage(language)];
}

function scalarValue(value: unknown, fallback = "") {
  return typeof value === "string" || typeof value === "number" ? value : fallback;
}

function displayName(language: AppLanguage, name?: string | null, email?: string | null) {
  return String(name || email || getAdminNotificationCopy(language).unknownUser).trim();
}

function roleLabel(language: AppLanguage, role?: string | null) {
  const copy = getAdminNotificationCopy(language);
  const normalized = String(role || "").trim().toLowerCase();
  if (normalized === "provider") return copy.provider;
  if (normalized === "reviewer") return copy.reviewer;
  if (normalized === "tester") return copy.tester;
  if (normalized === "admin") return copy.admin;
  return copy.unknownUser;
}

export function buildAuditNotification(
  input: {
    id: number;
    action: string;
    created_at: string;
    metadata?: Record<string, unknown> | null;
    actorName?: string | null;
    actorEmail?: string | null;
    targetName?: string | null;
    targetEmail?: string | null;
  },
  language: AppLanguage
): AdminNotificationItem | null {
  const copy = getAdminNotificationCopy(language);
  const actor = displayName(language, input.actorName, input.actorEmail);
  const target = displayName(language, input.targetName, input.targetEmail);
  const metadata = input.metadata || {};

  switch (input.action) {
    case "import_provider_contacts":
      return {
        id: `audit:${input.id}`,
        kind: "audit",
        title: copy.importCompleted,
        body: copy.importCompletedBody(actor, Number(scalarValue(metadata.createdCount, "0")), Number(scalarValue(metadata.skippedCount, "0"))),
        href: "/admin?section=imports",
        createdAt: input.created_at,
      };
    case "create_support_thread":
      return {
        id: `audit:${input.id}`,
        kind: "support",
        title: copy.newSupportTicket,
        body: copy.newSupportTicketBody(target, String(scalarValue(metadata.subject, language === "en" ? "Untitled" : "Sin asunto"))),
        href: "/admin?section=support",
        createdAt: input.created_at,
      };
    case "support_message_user":
      return {
        id: `audit:${input.id}`,
        kind: "support",
        title: copy.newSupportReply,
        body: copy.newSupportReplyBody(target),
        href: "/admin?section=support",
        createdAt: input.created_at,
      };
    case "provider_contact_report_submitted":
      return {
        id: `audit:${input.id}`,
        kind: "report",
        title: copy.newProviderReport,
        body: copy.newProviderReportBody(String(scalarValue(metadata.reportType))),
        href: "/admin?section=quality",
        createdAt: input.created_at,
      };
    case "directory_removal_request_submitted":
      return {
        id: `audit:${input.id}`,
        kind: "report",
        title: copy.removalRequest,
        body: copy.removalRequestBody(String(scalarValue(metadata.contactChannel))),
        href: "/admin?section=quality",
        createdAt: input.created_at,
      };
    case "create_provider_contact":
      return {
        id: `audit:${input.id}`,
        kind: "audit",
        title: copy.providerAdded,
        body: copy.providerAddedBody(actor, String(scalarValue(metadata.title))),
        href: "/admin?section=providers",
        createdAt: input.created_at,
      };
    case "update_provider_contact":
      return {
        id: `audit:${input.id}`,
        kind: "audit",
        title: copy.providerUpdated,
        body: copy.providerUpdatedBody(actor, String(scalarValue(metadata.contactId))),
        href: "/admin?section=providers",
        createdAt: input.created_at,
      };
    case "delete_provider_contact":
      return {
        id: `audit:${input.id}`,
        kind: "audit",
        title: copy.providerDeleted,
        body: copy.providerDeletedBody(actor, String(scalarValue(metadata.contactId))),
        href: "/admin?section=providers",
        createdAt: input.created_at,
      };
    case "delete_provider_contact_duplicate_after_repair":
      return {
        id: `audit:${input.id}`,
        kind: "audit",
        title: copy.duplicateRemoved,
        body: String(scalarValue(metadata.duplicateMessage, copy.duplicateRemovedFallback)),
        href: "/admin?section=quality",
        createdAt: input.created_at,
      };
    case "update_member_status":
      return {
        id: `audit:${input.id}`,
        kind: "billing",
        title: copy.userStatusUpdated,
        body: copy.userStatusUpdatedBody(actor, target),
        href: "/admin?section=users",
        createdAt: input.created_at,
      };
    case "create_admin_user":
      return {
        id: `audit:${input.id}`,
        kind: "audit",
        title: copy.newAdminAssigned,
        body: copy.newAdminAssignedBody(actor, String(scalarValue(metadata.email, target))),
        href: "/admin?section=users",
        createdAt: input.created_at,
      };
    case "update_user_email":
      return {
        id: `audit:${input.id}`,
        kind: "audit",
        title: copy.emailUpdated,
        body: copy.emailUpdatedBody(actor, target),
        href: "/admin?section=users",
        createdAt: input.created_at,
      };
    case "admin_provider_contact_report":
      return {
        id: `audit:${input.id}`,
        kind: "report",
        title: copy.adminMarkedContact,
        body: copy.adminMarkedContactBody(actor, String(scalarValue(metadata.contactId)), String(scalarValue(metadata.reportType))),
        href: "/admin?section=quality",
        createdAt: input.created_at,
      };
    case "review_provider_contact_report":
      return {
        id: `audit:${input.id}`,
        kind: "report",
        title: copy.reportReviewed,
        body: copy.reportReviewedBody(actor),
        href: "/admin?section=quality",
        createdAt: input.created_at,
      };
    case "update_directory_removal_request":
      return {
        id: `audit:${input.id}`,
        kind: "report",
        title: copy.removalReviewed,
        body: copy.removalReviewedBody(actor),
        href: "/admin?section=quality",
        createdAt: input.created_at,
      };
    default:
      return null;
  }
}

export function buildSignupNotification(
  input: {
    id: string;
    full_name?: string | null;
    email?: string | null;
    role?: string | null;
    created_at: string;
  },
  language: AppLanguage
): AdminNotificationItem {
  const copy = getAdminNotificationCopy(language);
  return {
    id: `signup:${input.id}`,
    kind: "user_signup",
    title: copy.newUser,
    body: copy.newUserBody(roleLabel(language, input.role), displayName(language, input.full_name, input.email)),
    href: `/admin?section=users&user_q=${encodeURIComponent(String(input.email || input.id))}`,
    createdAt: input.created_at,
  };
}

export function buildFailedPaymentNotification(
  input: {
    userId: string;
    userName?: string | null;
    userEmail?: string | null;
    createdAt: string;
  },
  language: AppLanguage
): AdminNotificationItem {
  const copy = getAdminNotificationCopy(language);
  return {
    id: `payment-failed:${input.userId}:${input.createdAt}`,
    kind: "billing",
    title: copy.paymentFailed,
    body: copy.paymentFailedBody(displayName(language, input.userName, input.userEmail)),
    href: `/admin?section=users&user_q=${encodeURIComponent(String(input.userEmail || input.userId))}`,
    createdAt: input.createdAt,
  };
}

export function buildWebhookErrorNotification(
  input: {
    provider: string;
    eventType?: string | null;
    statusCode: number;
    referenceId?: string | null;
    createdAt: string;
  },
  language: AppLanguage
): AdminNotificationItem {
  const copy = getAdminNotificationCopy(language);
  return {
    id: `webhook:${input.provider}:${input.referenceId || input.createdAt}`,
    kind: "webhook",
    title: copy.webhookError,
    body: copy.webhookErrorBody(input.provider, input.statusCode, input.eventType),
    href: "/admin?section=summary",
    createdAt: input.createdAt,
  };
}
