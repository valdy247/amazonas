import Link from "next/link";
import { normalizeLanguage } from "@/lib/i18n";

const acceptableUseSections = {
  es: [
    {
      title: "1. Objeto de esta politica",
      paragraphs: [
        "Esta Politica de uso aceptable describe las reglas minimas de conducta dentro de Verifyzon. Su finalidad es proteger a la comunidad, reducir abuso, prevenir fraude y dejar claro que el acceso a la plataforma depende del cumplimiento de estas reglas.",
        "El uso de Verifyzon es un privilegio condicionado. Podemos limitar o terminar el acceso de cualquier cuenta que use la plataforma de forma riesgosa, abusiva, enganosa o contraria a esta politica.",
      ],
    },
    {
      title: "2. Usos permitidos",
      paragraphs: [
        "Puedes usar Verifyzon para crear un perfil real, descubrir contactos compatibles, iniciar conversaciones, gestionar colaboraciones permitidas, verificar identidad, administrar tu membresia y comunicarte con soporte.",
        "Todo uso permitido exige honestidad, respeto, cumplimiento legal y respeto por la independencia editorial de terceros.",
      ],
    },
    {
      title: "3. Usos prohibidos",
      paragraphs: [
        "No puedes usar Verifyzon para fraude, suplantacion, spam, hostigamiento, amenazas, captacion enganosa, scraping no autorizado, malware, phishing, automatizacion abusiva, creacion masiva de cuentas, evasion de bloqueos, documentos falsos o cualquier actividad ilegal o insegura.",
        "Tambien queda prohibido usar la plataforma para exigir reseñas positivas, coordinar calificaciones, esconder relaciones materiales, manipular divulgaciones, lavar reputacion, inventar experiencias, acosar a reseñadores, presionar a proveedores o encubrir incentivos prohibidos.",
      ],
    },
    {
      title: "4. Integridad de la comunidad",
      paragraphs: [
        "Debes mantener informacion real, actual y suficiente sobre tu identidad, perfil y metodos de contacto. No puedes representar a otra persona, empresa o marca sin autorizacion valida.",
        "No puedes compartir contenido ofensivo, difamatorio, discriminatorio, sexualmente explicito, violento o que exponga datos personales de terceros sin base legal.",
      ],
    },
    {
      title: "5. Seguridad y sistemas",
      paragraphs: [
        "No puedes interferir con la seguridad, integridad o disponibilidad de Verifyzon. Esto incluye pruebas de intrusión no autorizadas, abuso de formularios, intentos de extraer bases de datos, manipular pagos, abusar de imports o degradar la experiencia de otros usuarios.",
        "Podemos aplicar limites tecnicos, bloqueos, moderacion automatica y revisiones manuales para contener abuso o riesgo operativo.",
      ],
    },
    {
      title: "6. Consecuencias",
      paragraphs: [
        "El incumplimiento puede dar lugar a advertencias, bloqueo de funciones, eliminacion de contenido, retencion de acceso, suspension, cancelacion permanente de la cuenta o colaboracion con proveedores y autoridades cuando resulte razonablemente necesario.",
      ],
    },
  ],
  en: [
    {
      title: "1. Purpose of this policy",
      paragraphs: [
        "This Acceptable Use Policy describes the minimum conduct rules inside Verifyzon. Its purpose is to protect the community, reduce abuse, prevent fraud, and make clear that platform access depends on compliance with these rules.",
        "Using Verifyzon is a conditional privilege. We may limit or terminate access for any account that uses the platform in a risky, abusive, deceptive, or policy-violating manner.",
      ],
    },
    {
      title: "2. Permitted use",
      paragraphs: [
        "You may use Verifyzon to create a real profile, discover compatible contacts, start conversations, manage permitted collaborations, verify identity, manage your membership, and communicate with support.",
        "All permitted use requires honesty, respect, legal compliance, and respect for the independent judgment of others.",
      ],
    },
    {
      title: "3. Prohibited use",
      paragraphs: [
        "You may not use Verifyzon for fraud, impersonation, spam, harassment, threats, deceptive outreach, unauthorized scraping, malware, phishing, abusive automation, mass account creation, ban evasion, forged documents, or any unlawful or unsafe activity.",
        "You are also prohibited from using the platform to demand positive reviews, coordinate ratings, hide material relationships, manipulate disclosures, launder reputation, invent experiences, pressure reviewers, pressure providers, or conceal prohibited incentives.",
      ],
    },
    {
      title: "4. Community integrity",
      paragraphs: [
        "You must keep your identity, profile, and contact methods real, current, and sufficiently accurate. You may not represent another person, business, or brand without valid authorization.",
        "You may not share offensive, defamatory, discriminatory, sexually explicit, violent, or unlawfully invasive content, including personal data of third parties without a valid legal basis.",
      ],
    },
    {
      title: "5. Security and systems",
      paragraphs: [
        "You may not interfere with the security, integrity, or availability of Verifyzon. This includes unauthorized intrusion testing, form abuse, attempts to extract databases, payment manipulation, import abuse, or degrading the experience of other users.",
        "We may apply technical limits, blocks, automated moderation, and manual review to contain abuse or operational risk.",
      ],
    },
    {
      title: "6. Consequences",
      paragraphs: [
        "Violations may result in warnings, feature restrictions, content removal, access holds, suspension, permanent account termination, or cooperation with service providers and authorities when reasonably necessary.",
      ],
    },
  ],
} as const;

export default async function AcceptableUsePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const language = normalizeLanguage(typeof resolvedSearchParams.lang === "string" ? resolvedSearchParams.lang : undefined);
  const isEnglish = language === "en";

  return (
    <main className="container-x py-8">
      <div className="rounded-[2rem] border border-[#eadfd6] bg-white p-6 shadow-[0_18px_36px_rgba(22,18,14,0.04)]">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#dc4f1f]">Legal</p>
        <h1 className="mt-3 text-3xl font-bold text-[#131316]">
          {isEnglish ? "Acceptable Use Policy" : "Politica de uso aceptable"}
        </h1>
        <div className="mt-8 space-y-8 text-sm leading-7 text-[#62564a]">
          {acceptableUseSections[language].map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-bold text-[#131316]">{section.title}</h2>
              <div className="mt-3 space-y-4">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
        <Link href={`/?lang=${language}`} className="btn-secondary mt-8 inline-flex">
          {isEnglish ? "Back to home" : "Volver al inicio"}
        </Link>
      </div>
    </main>
  );
}
