import Link from "next/link";
import { normalizeLanguage } from "@/lib/i18n";

const sections = {
  es: [
    {
      title: "1. Disputas entre usuarios",
      paragraphs: [
        "Verifyzon no es parte de los acuerdos entre usuarios y no decide automaticamente disputas sobre productos, entregas, pagos, reembolsos, resultados comerciales, compensaciones, colaboraciones o incumplimientos negociados dentro o fuera de la plataforma.",
        "Si surge un conflicto, las partes deben intentar resolverlo directamente. Verifyzon puede ofrecer soporte operativo limitado, pero no actua como arbitro obligatorio, depositario, garante ni asegurador del resultado.",
      ],
    },
    {
      title: "2. Alcance del soporte de Verifyzon",
      paragraphs: [
        "Podemos revisar reportes internos, investigar abuso de plataforma, limitar cuentas, preservar registros y tomar decisiones de seguridad o moderacion. Sin embargo, ello no implica que asumamos responsabilidad por los acuerdos privados o por el comportamiento comercial de los usuarios fuera de Verifyzon.",
      ],
    },
    {
      title: "3. Limitacion de responsabilidad",
      paragraphs: [
        "En la maxima medida permitida por la ley aplicable, Verifyzon y sus propietarios, operadores, administradores, contratistas y proveedores no seran responsables por danos directos, indirectos, incidentales, especiales, consecuenciales, punitivos o ejemplares derivados de disputas entre usuarios, colaboraciones fallidas, incumplimientos, productos defectuosos, perdidas comerciales, sanciones de terceros o decisiones de marketplaces.",
      ],
    },
    {
      title: "4. Sin garantias",
      paragraphs: [
        "La plataforma se ofrece en base 'tal cual' y 'segun disponibilidad'. No garantizamos resultados comerciales, continuidad ininterrumpida, conversiones, acceso permanente, exito en colaboraciones ni compatibilidad constante con reglas de terceros.",
      ],
    },
  ],
  en: [
    {
      title: "1. User disputes",
      paragraphs: [
        "Verifyzon is not a party to agreements between users and does not automatically resolve disputes about products, deliveries, payments, refunds, commercial results, compensation, collaborations, or breaches negotiated on or off the platform.",
        "If a conflict arises, the parties should first try to resolve it directly. Verifyzon may provide limited operational support, but it does not act as a mandatory arbitrator, escrow agent, guarantor, or insurer of the outcome.",
      ],
    },
    {
      title: "2. Scope of Verifyzon support",
      paragraphs: [
        "We may review internal reports, investigate platform abuse, restrict accounts, preserve records, and take moderation or security action. That does not mean we assume responsibility for private agreements or for users' commercial conduct outside Verifyzon.",
      ],
    },
    {
      title: "3. Limitation of liability",
      paragraphs: [
        "To the maximum extent permitted by applicable law, Verifyzon and its owners, operators, administrators, contractors, and service providers shall not be liable for direct, indirect, incidental, special, consequential, punitive, or exemplary damages arising from user disputes, failed collaborations, breaches, defective products, commercial losses, third-party sanctions, or marketplace decisions.",
      ],
    },
    {
      title: "4. No warranties",
      paragraphs: [
        "The platform is provided on an 'as is' and 'as available' basis. We do not guarantee commercial results, uninterrupted availability, conversions, permanent access, successful collaborations, or continuing compatibility with third-party rules.",
      ],
    },
  ],
} as const;

export default async function DisputesPage({
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
          {isEnglish ? "Disputes and Limitation of Liability" : "Politica de disputas y limitacion de responsabilidad"}
        </h1>
        <div className="mt-8 space-y-8 text-sm leading-7 text-[#62564a]">
          {sections[language].map((section) => (
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
