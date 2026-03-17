import { resolveSiteOrigin } from "@/lib/site-url";
import { formatMembershipDate } from "@/lib/membership";
import { type AppLanguage, normalizeLanguage } from "@/lib/i18n";

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
          html: `<p>Hola ${firstName},</p><p>Tu pago fue confirmado y tu membresia ya esta activa en <strong>Verifyzon</strong>.</p><p>Ahora puedes entrar a tu panel y continuar con tu verificacion de identidad.</p><p><a href="${dashboardUrl}">Ir al panel</a></p>`,
        };
      case "renewal_success":
        return {
          text: `Hola ${firstName},\n\nTu membresia se renovo correctamente.${periodEnd ? ` Tu nuevo periodo queda activo hasta ${periodEnd}.` : ""}\n\nPanel: ${dashboardUrl}\n`,
          html: `<p>Hola ${firstName},</p><p>Tu membresia se renovo correctamente.${periodEnd ? ` Tu nuevo periodo queda activo hasta <strong>${periodEnd}</strong>.` : ""}</p><p><a href="${dashboardUrl}">Ir al panel</a></p>`,
        };
      case "payment_failed":
        return {
          text: `Hola ${firstName},\n\nSquare reporto un problema con tu renovacion.${periodEnd ? ` Si ya tienes tiempo pagado, mantendras el acceso hasta ${periodEnd}.` : ""}\n\nTe recomendamos revisar tu metodo de pago y volver a entrar a tu panel.\n\nPanel: ${dashboardUrl}\n`,
          html: `<p>Hola ${firstName},</p><p>Square reporto un problema con tu renovacion.${periodEnd ? ` Si ya tienes tiempo pagado, mantendras el acceso hasta <strong>${periodEnd}</strong>.` : ""}</p><p>Te recomendamos revisar tu metodo de pago y volver a entrar a tu panel.</p><p><a href="${dashboardUrl}">Ir al panel</a></p>`,
        };
      case "membership_canceled":
        return {
          text: `Hola ${firstName},\n\nTu membresia fue cancelada.${periodEnd ? ` Si este periodo ya estaba pagado, conservaras el acceso hasta ${periodEnd}.` : ""}\n\nPanel: ${dashboardUrl}\n`,
          html: `<p>Hola ${firstName},</p><p>Tu membresia fue cancelada.${periodEnd ? ` Si este periodo ya estaba pagado, conservaras el acceso hasta <strong>${periodEnd}</strong>.` : ""}</p><p><a href="${dashboardUrl}">Ir al panel</a></p>`,
        };
    }
  }

  switch (input.kind) {
    case "payment_success":
      return {
        text: `Hi ${firstName},\n\nYour payment was confirmed and your Verifyzon membership is now active.\n\nYou can now enter your dashboard and continue with identity verification.\n\nDashboard: ${dashboardUrl}\n`,
        html: `<p>Hi ${firstName},</p><p>Your payment was confirmed and your <strong>Verifyzon</strong> membership is now active.</p><p>You can now enter your dashboard and continue with identity verification.</p><p><a href="${dashboardUrl}">Open dashboard</a></p>`,
      };
    case "renewal_success":
      return {
        text: `Hi ${firstName},\n\nYour membership was renewed successfully.${periodEnd ? ` Your new access period runs until ${periodEnd}.` : ""}\n\nDashboard: ${dashboardUrl}\n`,
        html: `<p>Hi ${firstName},</p><p>Your membership was renewed successfully.${periodEnd ? ` Your new access period runs until <strong>${periodEnd}</strong>.` : ""}</p><p><a href="${dashboardUrl}">Open dashboard</a></p>`,
      };
    case "payment_failed":
      return {
        text: `Hi ${firstName},\n\nSquare reported a problem with your renewal.${periodEnd ? ` If you still have paid time left, access will remain until ${periodEnd}.` : ""}\n\nPlease review your payment method and check your dashboard.\n\nDashboard: ${dashboardUrl}\n`,
        html: `<p>Hi ${firstName},</p><p>Square reported a problem with your renewal.${periodEnd ? ` If you still have paid time left, access will remain until <strong>${periodEnd}</strong>.` : ""}</p><p>Please review your payment method and check your dashboard.</p><p><a href="${dashboardUrl}">Open dashboard</a></p>`,
      };
    case "membership_canceled":
      return {
        text: `Hi ${firstName},\n\nYour membership was canceled.${periodEnd ? ` If this period was already paid, access remains until ${periodEnd}.` : ""}\n\nDashboard: ${dashboardUrl}\n`,
        html: `<p>Hi ${firstName},</p><p>Your membership was canceled.${periodEnd ? ` If this period was already paid, access remains until <strong>${periodEnd}</strong>.` : ""}</p><p><a href="${dashboardUrl}">Open dashboard</a></p>`,
      };
  }
}

export async function sendMembershipLifecycleEmail(input: MembershipEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    return {
      sent: false,
      reason: "Membership email skipped because RESEND_API_KEY or RESEND_FROM_EMAIL is missing.",
    };
  }

  const language = normalizeLanguage(input.language);
  const body = getBody({ ...input, language });
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [input.to],
      subject: getSubject(input.kind, language),
      text: body.text,
      html: body.html,
      reply_to: process.env.RESEND_REPLY_TO_EMAIL || undefined,
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Membership email failed: ${payload}`);
  }

  return {
    sent: true,
    reason: null,
  };
}
