import { resolveSiteOrigin } from "@/lib/site-url";

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

type EmailLayoutInput = {
  eyebrow?: string;
  title: string;
  intro?: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footnote?: string;
};

export function renderEmailLayout(input: EmailLayoutInput) {
  const siteOrigin = resolveSiteOrigin();
  const footer = input.footnote || `Verifyzon · ${siteOrigin.replace(/^https?:\/\//, "")}`;
  const ctaHtml =
    input.ctaLabel && input.ctaUrl
      ? `<p style="margin:28px 0 0"><a href="${input.ctaUrl}" style="display:inline-block;background:#ff6c38;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:999px">${input.ctaLabel}</a></p>`
      : "";

  return `
    <div style="margin:0;padding:32px 16px;background:#f6f0e8;font-family:Inter,Segoe UI,Arial,sans-serif;color:#131316">
      <div style="max-width:620px;margin:0 auto;background:linear-gradient(180deg,#fffdfa 0%,#fff7f1 100%);border:1px solid #eadfd6;border-radius:28px;overflow:hidden;box-shadow:0 28px 90px rgba(19,19,22,.12)">
        <div style="padding:28px 30px;background:linear-gradient(135deg,#201915 0%,#2c221a 55%,#3f2a1d 100%)">
          <div style="font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.62);font-weight:700">${input.eyebrow || "Verifyzon"}</div>
          <div style="margin-top:10px;font-size:32px;line-height:1.1;font-weight:800;color:#ffffff">Verifyzon</div>
        </div>
        <div style="padding:30px">
          <h1 style="margin:0;font-size:28px;line-height:1.2;color:#131316">${input.title}</h1>
          ${input.intro ? `<p style="margin:16px 0 0;font-size:16px;line-height:1.7;color:#62564a">${input.intro}</p>` : ""}
          <div style="margin-top:18px;font-size:15px;line-height:1.75;color:#62564a">${input.bodyHtml}</div>
          ${ctaHtml}
          <div style="margin-top:28px;padding-top:18px;border-top:1px solid #eadfd6;font-size:12px;line-height:1.7;color:#8f857b">${footer}</div>
        </div>
      </div>
    </div>
  `;
}

export async function sendAppEmail(input: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    return {
      sent: false,
      reason: "Email skipped because RESEND_API_KEY or RESEND_FROM_EMAIL is missing.",
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      reply_to: process.env.RESEND_REPLY_TO_EMAIL || undefined,
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Email failed: ${payload}`);
  }

  return {
    sent: true,
    reason: null,
  };
}
