import { resolveSiteOrigin } from "@/lib/site-url";
import { formatMembershipDate } from "@/lib/membership";
import { type AppLanguage, normalizeLanguage } from "@/lib/i18n";
import { renderEmailLayout, sendAppEmail } from "@/lib/email";

type MembershipEmailKind = "payment_success" | "renewal_success" | "payment_failed" | "membership_canceled";

type MembershipEmailInput = {
  to: string;
  fullName?: string | null;
  language?: AppLanguage | null;
  kind: MembershipEmailKind;
  currentPeriodEndAt?: string | null;
};

function getSubject(kind: MembershipEmailKind, language: AppLanguage) {
  const subjects = {
    es: {
      payment_success: "Tu membresia en Verifyzon ya esta activa",
      renewal_success: "Tu membresia en Verifyzon se renovo correctamente",
      payment_failed: "No pudimos renovar tu membresia en Verifyzon",
      membership_canceled: "Tu membresia en Verifyzon fue cancelada",
    },
    en: {
      payment_success: "Your Verifyzon membership is now active",
      renewal_success: "Your Verifyzon membership was renewed successfully",
      payment_failed: "We could not renew your Verifyzon membership",
      membership_canceled: "Your Verifyzon membership was canceled",
    },
  } as const;

  return subjects[language][kind];
}

function getBody(input: MembershipEmailInput & { language: AppLanguage }) {
  const siteOrigin = resolveSiteOrigin();
  const dashboardUrl = `${siteOrigin}/dashboard`;
  const firstName = String(input.fullName || "").trim().split(/\s+/)[0] || (input.language === "en" ? "there" : "hola");
  const periodEnd = formatMembershipDate(input.currentPeriodEndAt, input.language);

  if (input.language === "es") {
    switch (input.kind) {
      case "payment_success":
        return {
          text: `Hola ${firstName},\n\nTu pago fue confirmado y tu membresia ya esta activa en Verifyzon.\n\nAhora puedes entrar a tu panel y continuar con tu verificacion de identidad.\n\nPanel: ${dashboardUrl}\n`,
          html: renderEmailLayout({
            eyebrow: "Membership",
            title: "Tu membresia ya esta activa",
            intro: `Hola ${firstName}, tu pago fue confirmado y tu membresia ya esta activa en Verifyzon.`,
            bodyHtml: "<p>Ya puedes entrar a tu panel y continuar con tu verificacion de identidad.</p>",
            ctaLabel: "Ir al panel",
            ctaUrl: dashboardUrl,
          }),
        };
      case "renewal_success":
        return {
          text: `Hola ${firstName},\n\nTu membresia se renovo correctamente.${periodEnd ? ` Tu nuevo periodo queda activo hasta ${periodEnd}.` : ""}\n\nPanel: ${dashboardUrl}\n`,
          html: renderEmailLayout({
            eyebrow: "Membership",
            title: "Renovacion confirmada",
            intro: `Hola ${firstName}, tu membresia se renovo correctamente.${periodEnd ? ` Tu nuevo periodo queda activo hasta ${periodEnd}.` : ""}`,
            bodyHtml: "<p>Tu acceso sigue activo y no necesitas hacer nada mas por ahora.</p>",
            ctaLabel: "Ir al panel",
            ctaUrl: dashboardUrl,
          }),
        };
      case "payment_failed":
        return {
          text: `Hola ${firstName},\n\nSquare reporto un problema con tu renovacion.${periodEnd ? ` Si ya tienes tiempo pagado, mantendras el acceso hasta ${periodEnd}.` : ""}\n\nTe recomendamos revisar tu metodo de pago y volver a entrar a tu panel.\n\nPanel: ${dashboardUrl}\n`,
          html: renderEmailLayout({
            eyebrow: "Membership",
            title: "Hubo un problema con tu pago",
            intro: `Hola ${firstName}, Square reporto un problema con tu renovacion.${periodEnd ? ` Si ya tienes tiempo pagado, mantendras el acceso hasta ${periodEnd}.` : ""}`,
            bodyHtml: "<p>Te recomendamos revisar tu metodo de pago y volver a entrar a tu panel.</p>",
            ctaLabel: "Revisar panel",
            ctaUrl: dashboardUrl,
          }),
        };
      case "membership_canceled":
        return {
          text: `Hola ${firstName},\n\nTu membresia fue cancelada.${periodEnd ? ` Si este periodo ya estaba pagado, conservaras el acceso hasta ${periodEnd}.` : ""}\n\nPanel: ${dashboardUrl}\n`,
          html: renderEmailLayout({
            eyebrow: "Membership",
            title: "Tu membresia fue cancelada",
            intro: `Hola ${firstName}, tu membresia fue cancelada.${periodEnd ? ` Si este periodo ya estaba pagado, conservaras el acceso hasta ${periodEnd}.` : ""}`,
            bodyHtml: "<p>Si quieres volver, puedes reactivar tu acceso desde tu panel.</p>",
            ctaLabel: "Abrir panel",
            ctaUrl: dashboardUrl,
          }),
        };
    }
  }

  switch (input.kind) {
    case "payment_success":
      return {
        text: `Hi ${firstName},\n\nYour payment was confirmed and your Verifyzon membership is now active.\n\nYou can now enter your dashboard and continue with identity verification.\n\nDashboard: ${dashboardUrl}\n`,
        html: renderEmailLayout({
          eyebrow: "Membership",
          title: "Your membership is now active",
          intro: `Hi ${firstName}, your payment was confirmed and your Verifyzon membership is now active.`,
          bodyHtml: "<p>You can now enter your dashboard and continue with identity verification.</p>",
          ctaLabel: "Open dashboard",
          ctaUrl: dashboardUrl,
        }),
      };
    case "renewal_success":
      return {
        text: `Hi ${firstName},\n\nYour membership was renewed successfully.${periodEnd ? ` Your new access period runs until ${periodEnd}.` : ""}\n\nDashboard: ${dashboardUrl}\n`,
        html: renderEmailLayout({
          eyebrow: "Membership",
          title: "Renewal confirmed",
          intro: `Hi ${firstName}, your membership was renewed successfully.${periodEnd ? ` Your new access period runs until ${periodEnd}.` : ""}`,
          bodyHtml: "<p>Your access remains active and everything is in good standing.</p>",
          ctaLabel: "Open dashboard",
          ctaUrl: dashboardUrl,
        }),
      };
    case "payment_failed":
      return {
        text: `Hi ${firstName},\n\nSquare reported a problem with your renewal.${periodEnd ? ` If you still have paid time left, access will remain until ${periodEnd}.` : ""}\n\nPlease review your payment method and check your dashboard.\n\nDashboard: ${dashboardUrl}\n`,
        html: renderEmailLayout({
          eyebrow: "Membership",
          title: "There was a problem with your payment",
          intro: `Hi ${firstName}, Square reported a problem with your renewal.${periodEnd ? ` If you still have paid time left, access will remain until ${periodEnd}.` : ""}`,
          bodyHtml: "<p>Please review your payment method and check your dashboard.</p>",
          ctaLabel: "Open dashboard",
          ctaUrl: dashboardUrl,
        }),
      };
    case "membership_canceled":
      return {
        text: `Hi ${firstName},\n\nYour membership was canceled.${periodEnd ? ` If this period was already paid, access remains until ${periodEnd}.` : ""}\n\nDashboard: ${dashboardUrl}\n`,
        html: renderEmailLayout({
          eyebrow: "Membership",
          title: "Your membership was canceled",
          intro: `Hi ${firstName}, your membership was canceled.${periodEnd ? ` If this period was already paid, access remains until ${periodEnd}.` : ""}`,
          bodyHtml: "<p>You can always return and reactivate your access from your dashboard.</p>",
          ctaLabel: "Open dashboard",
          ctaUrl: dashboardUrl,
        }),
      };
  }
}

export async function sendMembershipLifecycleEmail(input: MembershipEmailInput) {
  const language = normalizeLanguage(input.language);
  const body = getBody({ ...input, language });
  return sendAppEmail({
    to: input.to,
    subject: getSubject(input.kind, language),
    text: body.text,
    html: body.html,
  });
}
