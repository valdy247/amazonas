import { resolveSiteOrigin } from "@/lib/site-url";
import { normalizeLanguage, type AppLanguage } from "@/lib/i18n";
import { renderEmailLayout, sendAppEmail } from "@/lib/email";

type ProfileEmailTarget = {
  email: string | null;
  full_name?: string | null;
  preferred_language?: string | null;
};

function firstName(value?: string | null, language: AppLanguage = "en") {
  return String(value || "").trim().split(/\s+/)[0] || (language === "en" ? "there" : "hola");
}

export async function sendSupportReplyEmail(input: {
  toProfile: ProfileEmailTarget;
  subject: string;
  messagePreview: string;
  threadId: number;
}) {
  if (!input.toProfile.email) {
    return { sent: false, reason: "Support reply email skipped because target email is missing." };
  }

  const language = normalizeLanguage(input.toProfile.preferred_language);
  const recipient = firstName(input.toProfile.full_name, language);
  const siteOrigin = resolveSiteOrigin();
  const supportUrl = `${siteOrigin}/dashboard?section=support&thread=${input.threadId}`;

  const copy =
    language === "en"
      ? {
          subject: "New reply from Verifyzon support",
          title: "Support replied to your case",
          intro: `Hi ${recipient}, our support team just replied to your case: ${input.subject}`,
          body: `<p>Latest reply:</p><p style="margin-top:12px;padding:16px 18px;border-radius:20px;background:#fcfaf7;border:1px solid #eadfd6"><strong>${input.messagePreview}</strong></p>`,
          cta: "Open support",
          text: `Hi ${recipient}, our support team just replied to your case: ${input.subject}\n\nLatest reply:\n${input.messagePreview}\n\nOpen support: ${supportUrl}\n`,
        }
      : {
          subject: "Nueva respuesta de soporte en Verifyzon",
          title: "Soporte respondio tu caso",
          intro: `Hola ${recipient}, nuestro equipo de soporte acaba de responder tu caso: ${input.subject}`,
          body: `<p>Ultima respuesta:</p><p style="margin-top:12px;padding:16px 18px;border-radius:20px;background:#fcfaf7;border:1px solid #eadfd6"><strong>${input.messagePreview}</strong></p>`,
          cta: "Abrir soporte",
          text: `Hola ${recipient}, nuestro equipo de soporte acaba de responder tu caso: ${input.subject}\n\nUltima respuesta:\n${input.messagePreview}\n\nAbrir soporte: ${supportUrl}\n`,
        };

  return sendAppEmail({
    to: input.toProfile.email,
    subject: copy.subject,
    text: copy.text,
    html: renderEmailLayout({
      eyebrow: "Support",
      title: copy.title,
      intro: copy.intro,
      bodyHtml: copy.body,
      ctaLabel: copy.cta,
      ctaUrl: supportUrl,
    }),
  });
}

export async function sendFirstConversationMessageEmail(input: {
  toProfile: ProfileEmailTarget;
  senderName: string;
  messagePreview: string;
  requestId: number;
}) {
  if (!input.toProfile.email) {
    return { sent: false, reason: "Conversation email skipped because target email is missing." };
  }

  const language = normalizeLanguage(input.toProfile.preferred_language);
  const recipient = firstName(input.toProfile.full_name, language);
  const siteOrigin = resolveSiteOrigin();
  const messageUrl = `${siteOrigin}/dashboard?section=messages&thread=${input.requestId}`;

  const copy =
    language === "en"
      ? {
          subject: `New message from ${input.senderName} on Verifyzon`,
          title: "You have a new conversation",
          intro: `Hi ${recipient}, ${input.senderName} just started a conversation with you on Verifyzon.`,
          body: `<p>First message:</p><p style="margin-top:12px;padding:16px 18px;border-radius:20px;background:#fcfaf7;border:1px solid #eadfd6"><strong>${input.messagePreview}</strong></p>`,
          cta: "Open messages",
          text: `Hi ${recipient}, ${input.senderName} just started a conversation with you on Verifyzon.\n\nFirst message:\n${input.messagePreview}\n\nOpen messages: ${messageUrl}\n`,
        }
      : {
          subject: `Nuevo mensaje de ${input.senderName} en Verifyzon`,
          title: "Tienes una conversacion nueva",
          intro: `Hola ${recipient}, ${input.senderName} acaba de iniciar una conversacion contigo en Verifyzon.`,
          body: `<p>Primer mensaje:</p><p style="margin-top:12px;padding:16px 18px;border-radius:20px;background:#fcfaf7;border:1px solid #eadfd6"><strong>${input.messagePreview}</strong></p>`,
          cta: "Abrir mensajes",
          text: `Hola ${recipient}, ${input.senderName} acaba de iniciar una conversacion contigo en Verifyzon.\n\nPrimer mensaje:\n${input.messagePreview}\n\nAbrir mensajes: ${messageUrl}\n`,
        };

  return sendAppEmail({
    to: input.toProfile.email,
    subject: copy.subject,
    text: copy.text,
    html: renderEmailLayout({
      eyebrow: "Messages",
      title: copy.title,
      intro: copy.intro,
      bodyHtml: copy.body,
      ctaLabel: copy.cta,
      ctaUrl: messageUrl,
    }),
  });
}

export async function sendPasswordRecoveryEmail(input: {
  toProfile: ProfileEmailTarget;
  recoveryUrl: string;
}) {
  if (!input.toProfile.email) {
    return { sent: false, reason: "Recovery email skipped because target email is missing." };
  }

  const language = normalizeLanguage(input.toProfile.preferred_language);
  const recipient = firstName(input.toProfile.full_name, language);

  const copy =
    language === "en"
      ? {
          subject: "Reset your Verifyzon password",
          title: "Create a new password",
          intro: `Hi ${recipient}, we received a request to reset your Verifyzon password.`,
          body: `<p>Use the button below to create a new password.</p><p style="margin-top:16px">If the button does not open correctly, copy and paste this link into your browser:</p><p style="margin-top:12px;padding:14px 16px;border-radius:18px;background:#fcfaf7;border:1px solid #eadfd6;word-break:break-word"><a href="${input.recoveryUrl}" style="color:#dc4f1f;text-decoration:underline">${input.recoveryUrl}</a></p>`,
          cta: "Reset password",
          text: `Hi ${recipient}, we received a request to reset your Verifyzon password.\n\nOpen this link to create a new password:\n${input.recoveryUrl}\n`,
        }
      : {
          subject: "Restablece tu contrasena de Verifyzon",
          title: "Crear nueva contrasena",
          intro: `Hola ${recipient}, recibimos una solicitud para restablecer tu contrasena de Verifyzon.`,
          body: `<p>Usa el boton de abajo para crear una nueva contrasena.</p><p style="margin-top:16px">Si el boton no abre correctamente, copia y pega este enlace en tu navegador:</p><p style="margin-top:12px;padding:14px 16px;border-radius:18px;background:#fcfaf7;border:1px solid #eadfd6;word-break:break-word"><a href="${input.recoveryUrl}" style="color:#dc4f1f;text-decoration:underline">${input.recoveryUrl}</a></p>`,
          cta: "Restablecer contrasena",
          text: `Hola ${recipient}, recibimos una solicitud para restablecer tu contrasena de Verifyzon.\n\nAbre este enlace para crear una nueva contrasena:\n${input.recoveryUrl}\n`,
        };

  return sendAppEmail({
    to: input.toProfile.email,
    subject: copy.subject,
    text: copy.text,
    html: renderEmailLayout({
      eyebrow: "Security",
      title: copy.title,
      intro: copy.intro,
      bodyHtml: copy.body,
      ctaLabel: copy.cta,
      ctaUrl: input.recoveryUrl,
    }),
  });
}
