import Link from "next/link";
import { normalizeLanguage } from "@/lib/i18n";

const sections = {
  es: [
    {
      title: "1. Principio central",
      paragraphs: [
        "Verifyzon existe para facilitar conexiones y colaboraciones mas transparentes, no para fabricar opiniones ni manipular reseñas. Ningun usuario puede usar la plataforma para imponer, comprar, vender, condicionar o encubrir reseñas o recomendaciones.",
      ],
    },
    {
      title: "2. Prohibiciones expresas",
      paragraphs: [
        "Queda prohibido exigir una reseña positiva, una puntuacion especifica, una reseña obligatoria, la eliminacion de una critica, una publicacion encubierta o cualquier opinion predeterminada a cambio de dinero, productos, reembolsos, descuentos, muestras, regalos, acceso, promesas futuras o cualquier forma de valor.",
        "Tambien queda prohibido ocultar incentivos, coordinar reseñas falsas, simular experiencias reales inexistentes, publicar contenido que no refleje una experiencia autentica o suprimir informacion material relevante para el consumidor.",
      ],
    },
    {
      title: "3. Independencia editorial y divulgacion",
      paragraphs: [
        "Los reseñadores conservan criterio editorial independiente. Si existe una relacion material, incentivo, muestra, descuento, reembolso o beneficio, corresponde al usuario cumplir con las obligaciones legales y de divulgacion aplicables.",
        "Verifyzon no valida ni aprueba previamente cada pieza de contenido ni asume la responsabilidad por la forma en que los usuarios revelan o no sus relaciones materiales.",
      ],
    },
    {
      title: "4. Consecuencias y cooperacion",
      paragraphs: [
        "Si detectamos senales de manipulacion, coordinacion de calificaciones, incentivos prohibidos, reseñas fabricadas o intentos de eludir reglas de integridad, podremos limitar cuentas, congelar acceso, borrar contactos, suspender colaboraciones y conservar registros para investigacion o cooperacion con terceros competentes.",
      ],
    },
  ],
  en: [
    {
      title: "1. Core principle",
      paragraphs: [
        "Verifyzon exists to support more transparent connections and collaborations, not to manufacture opinions or manipulate reviews. No user may use the platform to impose, buy, sell, condition, or conceal reviews or recommendations.",
      ],
    },
    {
      title: "2. Express prohibitions",
      paragraphs: [
        "It is prohibited to require a positive review, a specific rating, a mandatory review, removal of criticism, hidden sponsored content, or any predetermined opinion in exchange for money, products, reimbursements, discounts, samples, gifts, access, future promises, or any form of value.",
        "It is also prohibited to hide incentives, coordinate fake reviews, simulate experiences that did not happen, publish content that does not reflect an authentic experience, or suppress material information relevant to consumers.",
      ],
    },
    {
      title: "3. Editorial independence and disclosure",
      paragraphs: [
        "Reviewers keep independent editorial judgment. If there is a material relationship, incentive, sample, discount, reimbursement, or benefit, the user is responsible for complying with applicable legal and disclosure obligations.",
        "Verifyzon does not pre-approve every piece of content and does not assume responsibility for how users disclose or fail to disclose material relationships.",
      ],
    },
    {
      title: "4. Consequences and cooperation",
      paragraphs: [
        "If we detect signs of manipulation, rating coordination, prohibited incentives, fabricated reviews, or attempts to evade integrity rules, we may restrict accounts, freeze access, delete contacts, suspend collaborations, and preserve records for investigation or cooperation with competent third parties.",
      ],
    },
  ],
} as const;

export default async function ReviewIntegrityPage({
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
          {isEnglish ? "Review Integrity Policy" : "Politica de integridad de resenas"}
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
