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

function displayName(name?: string | null, email?: string | null) {
  return String(name || email || "Usuario").trim();
}

function roleLabel(role?: string | null) {
  const normalized = String(role || "").trim().toLowerCase();
  if (normalized === "provider") return "Proveedor";
  if (normalized === "reviewer") return "Reseñador";
  if (normalized === "tester") return "Tester";
  if (normalized === "admin") return "Admin";
  return "Usuario";
}

export function buildAuditNotification(input: {
  id: number;
  action: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
  actorName?: string | null;
  actorEmail?: string | null;
  targetName?: string | null;
  targetEmail?: string | null;
}): AdminNotificationItem | null {
  const actor = displayName(input.actorName, input.actorEmail);
  const target = displayName(input.targetName, input.targetEmail);
  const metadata = input.metadata || {};

  switch (input.action) {
    case "import_provider_contacts":
      return {
        id: `audit:${input.id}`,
        kind: "audit",
        title: "Importacion completada",
        body: `${actor} importo ${metadata.createdCount || 0} proveedores y omitio ${metadata.skippedCount || 0}.`,
        href: "/admin?section=imports",
        createdAt: input.created_at,
      };
    case "create_support_thread":
      return {
        id: `audit:${input.id}`,
        kind: "support",
        title: "Nuevo ticket de soporte",
        body: `${target} abrio el caso "${String(metadata.subject || "Sin asunto")}".`,
        href: "/admin?section=support",
        createdAt: input.created_at,
      };
    case "support_message_user":
      return {
        id: `audit:${input.id}`,
        kind: "support",
        title: "Respuesta nueva en soporte",
        body: `${target} respondio en un ticket existente.`,
        href: "/admin?section=support",
        createdAt: input.created_at,
      };
    case "provider_contact_report_submitted":
      return {
        id: `audit:${input.id}`,
        kind: "report",
        title: "Nuevo reporte de proveedor",
        body: `Se marco un contacto como ${String(metadata.reportType || "requiere revision")}.`,
        href: "/admin?section=quality",
        createdAt: input.created_at,
      };
    case "directory_removal_request_submitted":
      return {
        id: `audit:${input.id}`,
        kind: "report",
        title: "Solicitud de eliminacion",
        body: `Nuevo pedido para revisar ${String(metadata.contactChannel || "contacto")} del directorio.`,
        href: "/admin?section=quality",
        createdAt: input.created_at,
      };
    case "create_provider_contact":
      return {
        id: `audit:${input.id}`,
        kind: "audit",
        title: "Proveedor agregado",
        body: `${actor} creo ${String(metadata.title || "un proveedor")} en el directorio.`,
        href: "/admin?section=providers",
        createdAt: input.created_at,
      };
    case "update_provider_contact":
      return {
        id: `audit:${input.id}`,
        kind: "audit",
        title: "Proveedor actualizado",
        body: `${actor} actualizo el contacto #${String(metadata.contactId || "")}.`,
        href: "/admin?section=providers",
        createdAt: input.created_at,
      };
    case "delete_provider_contact":
      return {
        id: `audit:${input.id}`,
        kind: "audit",
        title: "Proveedor eliminado",
        body: `${actor} elimino el contacto #${String(metadata.contactId || "")}.`,
        href: "/admin?section=providers",
        createdAt: input.created_at,
      };
    case "delete_provider_contact_duplicate_after_repair":
      return {
        id: `audit:${input.id}`,
        kind: "audit",
        title: "Duplicado eliminado",
        body: String(metadata.duplicateMessage || "Se elimino un proveedor duplicado durante calidad."),
        href: "/admin?section=quality",
        createdAt: input.created_at,
      };
    case "update_member_status":
      return {
        id: `audit:${input.id}`,
        kind: "billing",
        title: "Estado de usuario actualizado",
        body: `${actor} cambio membresia o KYC de ${target}.`,
        href: "/admin?section=users",
        createdAt: input.created_at,
      };
    case "create_admin_user":
      return {
        id: `audit:${input.id}`,
        kind: "audit",
        title: "Nuevo admin asignado",
        body: `${actor} promovio a ${String(metadata.email || target)} como admin.`,
        href: "/admin?section=users",
        createdAt: input.created_at,
      };
    case "update_user_email":
      return {
        id: `audit:${input.id}`,
        kind: "audit",
        title: "Email actualizado",
        body: `${actor} cambio el correo de ${target}.`,
        href: "/admin?section=users",
        createdAt: input.created_at,
      };
    case "admin_provider_contact_report":
      return {
        id: `audit:${input.id}`,
        kind: "report",
        title: "Admin marco un contacto",
        body: `${actor} marco el contacto #${String(metadata.contactId || "")} como ${String(metadata.reportType || "revision")}.`,
        href: "/admin?section=quality",
        createdAt: input.created_at,
      };
    case "review_provider_contact_report":
      return {
        id: `audit:${input.id}`,
        kind: "report",
        title: "Reporte revisado",
        body: `${actor} actualizo la revision de un contacto reportado.`,
        href: "/admin?section=quality",
        createdAt: input.created_at,
      };
    case "update_directory_removal_request":
      return {
        id: `audit:${input.id}`,
        kind: "report",
        title: "Solicitud de baja revisada",
        body: `${actor} actualizo una solicitud de eliminacion del directorio.`,
        href: "/admin?section=quality",
        createdAt: input.created_at,
      };
    default:
      return null;
  }
}

export function buildSignupNotification(input: {
  id: string;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  created_at: string;
}): AdminNotificationItem {
  return {
    id: `signup:${input.id}`,
    kind: "user_signup",
    title: "Nuevo usuario registrado",
    body: `${roleLabel(input.role)}: ${displayName(input.full_name, input.email)}`,
    href: `/admin?section=users&user_q=${encodeURIComponent(String(input.email || input.id))}`,
    createdAt: input.created_at,
  };
}

export function buildFailedPaymentNotification(input: {
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
  createdAt: string;
}): AdminNotificationItem {
  return {
    id: `payment-failed:${input.userId}:${input.createdAt}`,
    kind: "billing",
    title: "Cobro fallido",
    body: `${displayName(input.userName, input.userEmail)} tiene un fallo de cobro en membresia.`,
    href: `/admin?section=users&user_q=${encodeURIComponent(String(input.userEmail || input.userId))}`,
    createdAt: input.createdAt,
  };
}

export function buildWebhookErrorNotification(input: {
  provider: string;
  eventType?: string | null;
  statusCode: number;
  referenceId?: string | null;
  createdAt: string;
}): AdminNotificationItem {
  return {
    id: `webhook:${input.provider}:${input.referenceId || input.createdAt}`,
    kind: "webhook",
    title: "Webhook con error",
    body: `${input.provider} devolvio ${input.statusCode}${input.eventType ? ` en ${input.eventType}` : ""}.`,
    href: "/admin?section=summary",
    createdAt: input.createdAt,
  };
}
