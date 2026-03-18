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
