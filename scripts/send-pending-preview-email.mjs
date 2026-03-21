import { createClient } from "@supabase/supabase-js";

function resolveSiteOrigin() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.SITE_URL ||
    "https://verifyzon.com"
  ).replace(/\/$/, "");
}

function renderEmailLayout({ title, intro, bodyHtml, ctaLabel, ctaUrl, eyebrow = "Verifyzon" }) {
  const siteOrigin = resolveSiteOrigin();
  const ctaHtml =
    ctaLabel && ctaUrl
      ? `<p style="margin:28px 0 0"><a href="${ctaUrl}" style="display:inline-block;background:#ff6c38;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:999px">${ctaLabel}</a></p>`
      : "";

  return `
    <div style="margin:0;padding:32px 16px;background:#f6f0e8;font-family:Inter,Segoe UI,Arial,sans-serif;color:#131316">
      <div style="max-width:620px;margin:0 auto;background:linear-gradient(180deg,#fffdfa 0%,#fff7f1 100%);border:1px solid #eadfd6;border-radius:28px;overflow:hidden;box-shadow:0 28px 90px rgba(19,19,22,.12)">
        <div style="padding:28px 30px;background:linear-gradient(135deg,#201915 0%,#2c221a 55%,#3f2a1d 100%)">
          <div style="font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.62);font-weight:700">${eyebrow}</div>
          <div style="margin-top:10px;font-size:32px;line-height:1.1;font-weight:800;color:#ffffff">Verifyzon</div>
        </div>
        <div style="padding:30px">
          <h1 style="margin:0;font-size:28px;line-height:1.2;color:#131316">${title}</h1>
          <p style="margin:16px 0 0;font-size:16px;line-height:1.7;color:#62564a">${intro}</p>
          <div style="margin-top:18px;font-size:15px;line-height:1.75;color:#62564a">${bodyHtml}</div>
          ${ctaHtml}
          <div style="margin-top:28px;padding-top:18px;border-top:1px solid #eadfd6;font-size:12px;line-height:1.7;color:#8f857b">Verifyzon · ${siteOrigin.replace(/^https?:\/\//, "")}</div>
        </div>
      </div>
    </div>
  `;
}

async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    throw new Error("Missing RESEND_API_KEY or RESEND_FROM_EMAIL.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject,
      html,
      text,
      reply_to: process.env.RESEND_REPLY_TO_EMAIL || undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend error for ${to}: ${await response.text()}`);
  }
}

function firstName(fullName) {
  return String(fullName || "").trim().split(/\s+/)[0] || "hola";
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: memberships, error: membershipError } = await admin
    .from("memberships")
    .select("user_id, status")
    .eq("status", "pending_payment");

  if (membershipError) {
    throw membershipError;
  }

  const userIds = [...new Set((memberships || []).map((item) => item.user_id).filter(Boolean))];
  if (!userIds.length) {
    console.log("No pending_payment users found.");
    return;
  }

  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("id, email, full_name, role, accepted_terms_at")
    .in("id", userIds)
    .in("role", ["reviewer", "tester"])
    .not("accepted_terms_at", "is", null);

  if (profileError) {
    throw profileError;
  }

  const siteOrigin = resolveSiteOrigin();
  const dashboardUrl = `${siteOrigin}/dashboard?section=contacts`;
  let sent = 0;
  let skipped = 0;

  for (const profile of profiles || []) {
    if (!profile.email) {
      skipped += 1;
      continue;
    }

    const recipient = firstName(profile.full_name);
    const subject = "Ya tienes 50 proveedores abiertos en Verifyzon";
    const text = `Hola ${recipient},\n\nSe te ha dado acceso a 50 proveedores para que disfrutes de los beneficios de esta web antes de pagar ni un solo centavo.\n\nTenemos cerca de 1000 proveedores y queremos compartirla contigo. No pierdas esta oportunidad.\n\nAbre tus proveedores aqui: ${dashboardUrl}\n\nAtentamente,\nValdy`;
    const html = renderEmailLayout({
      eyebrow: "Preview access",
      title: "Ya tienes 50 proveedores abiertos",
      intro: `Hola ${recipient}, se te ha dado acceso a 50 proveedores para que disfrutes de los beneficios de esta web antes de pagar ni un solo centavo.`,
      bodyHtml:
        "<p>Tenemos cerca de 1000 proveedores y queremos compartirla contigo. No pierdas esta oportunidad.</p><p style=\"margin-top:14px\"><strong>Atentamente,<br/>Valdy</strong></p>",
      ctaLabel: "Abrir mis proveedores",
      ctaUrl: dashboardUrl,
    });

    await sendEmail({
      to: profile.email,
      subject,
      html,
      text,
    });
    sent += 1;
  }

  console.log(`Pending payment preview email run complete. Sent: ${sent}. Skipped: ${skipped}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
