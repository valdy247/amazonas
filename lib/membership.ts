import { type AppLanguage } from "@/lib/i18n";

export const MEMBERSHIP_STATUSES = [
  "pending_payment",
  "payment_processing",
  "active",
  "payment_failed",
  "canceled",
  "suspended",
] as const;

export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export type MembershipRow = {
  status?: string | null;
  paid_at?: string | null;
  current_period_end_at?: string | null;
  canceled_at?: string | null;
  last_payment_failed_at?: string | null;
  square_customer_id?: string | null;
  square_order_id?: string | null;
  square_subscription_id?: string | null;
  last_square_event_type?: string | null;
  last_square_event_at?: string | null;
};

type MembershipCopy = {
  label: string;
  detail: string;
};

const MEMBERSHIP_COPY: Record<AppLanguage, Record<MembershipStatus, MembershipCopy>> = {
  es: {
    pending_payment: {
      label: "Pago pendiente",
      detail: "Todavia no se ha completado el cobro inicial de la membresia.",
    },
    payment_processing: {
      label: "Validando pago",
      detail: "Estamos esperando la confirmacion final de Square. Si tarda demasiado, el sistema volvera a comprobarlo.",
    },
    active: {
      label: "Activa",
      detail: "Tu acceso esta habilitado y la membresia esta al dia.",
    },
    payment_failed: {
      label: "Cobro fallido",
      detail: "Square reporto un problema con la renovacion. Si aun tienes dias pagados, se respetaran hasta el fin del periodo actual.",
    },
    canceled: {
      label: "Cancelada",
      detail: "La suscripcion fue cancelada. Si ya pagaste este periodo, el acceso se mantiene hasta su fecha de fin.",
    },
    suspended: {
      label: "Suspendida",
      detail: "La membresia fue pausada o bloqueada manualmente.",
    },
  },
  en: {
    pending_payment: {
      label: "Payment pending",
      detail: "The first membership charge has not been completed yet.",
    },
    payment_processing: {
      label: "Confirming payment",
      detail: "We are waiting for Square's final confirmation. If it takes too long, the system will check again.",
    },
    active: {
      label: "Active",
      detail: "Your access is enabled and the membership is in good standing.",
    },
    payment_failed: {
      label: "Payment issue",
      detail: "Square reported a renewal problem. If you still have paid time left, access will remain until the current period ends.",
    },
    canceled: {
      label: "Canceled",
      detail: "The subscription was canceled. If this period was already paid, access remains until its end date.",
    },
    suspended: {
      label: "Suspended",
      detail: "The membership was paused or blocked manually.",
    },
  },
};

export function normalizeMembershipStatus(status: string | null | undefined): MembershipStatus {
  switch (status) {
    case "payment_processing":
    case "active":
    case "payment_failed":
    case "canceled":
    case "suspended":
      return status;
    default:
      return "pending_payment";
  }
}

export function membershipHasAccess(membership: MembershipRow | null | undefined, referenceDate = new Date()) {
  const status = normalizeMembershipStatus(membership?.status);
  if (status === "active") {
    return true;
  }

  if (status === "payment_failed" || status === "canceled") {
    const periodEnd = membership?.current_period_end_at ? new Date(membership.current_period_end_at) : null;
    return Boolean(periodEnd && Number.isFinite(periodEnd.getTime()) && periodEnd.getTime() > referenceDate.getTime());
  }

  return false;
}

export function getMembershipMeta(status: string | null | undefined, language: AppLanguage) {
  const normalizedStatus = normalizeMembershipStatus(status);
  return {
    status: normalizedStatus,
    ...MEMBERSHIP_COPY[language][normalizedStatus],
  };
}

export function formatMembershipDate(
  value: string | null | undefined,
  language: AppLanguage,
  options?: Intl.DateTimeFormatOptions
) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  }).format(date);
}

export function shouldTreatMembershipAsRenewal(input: {
  previousStatus: string | null | undefined;
  previousPeriodEndAt: string | null | undefined;
  nextStatus: string | null | undefined;
  nextPeriodEndAt: string | null | undefined;
}) {
  if (normalizeMembershipStatus(input.previousStatus) !== "active" || normalizeMembershipStatus(input.nextStatus) !== "active") {
    return false;
  }

  const previousTime = input.previousPeriodEndAt ? Date.parse(input.previousPeriodEndAt) : 0;
  const nextTime = input.nextPeriodEndAt ? Date.parse(input.nextPeriodEndAt) : 0;
  return nextTime > previousTime;
}
