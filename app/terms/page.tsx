import Link from "next/link";
import { normalizeLanguage } from "@/lib/i18n";

export default async function TermsPage({
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
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#dc4f1f]">{isEnglish ? "Legal" : "Legal"}</p>
        <h1 className="mt-3 text-3xl font-bold text-[#131316]">{isEnglish ? "Terms and Conditions" : "Terminos y condiciones"}</h1>
        <div className="mt-5 space-y-4 text-sm leading-7 text-[#62564a]">
          <p>
            {isEnglish
              ? "Amazona Review connects providers and reviewers in a verified environment. Users must provide truthful information and respect platform rules."
              : "Amazona Review conecta providers y resenadores en un entorno verificado. Los usuarios deben proporcionar informacion real y respetar las reglas de la plataforma."}
          </p>
          <p>
            {isEnglish
              ? "Membership access, identity verification, and messaging privileges can be suspended if misuse, fraud, abuse, or policy violations are detected."
              : "El acceso por membresia, la verificacion de identidad y los privilegios de mensajeria pueden suspenderse si se detecta mal uso, fraude, abuso o incumplimiento de politicas."}
          </p>
          <p>
            {isEnglish
              ? "Providers and reviewers are responsible for their own collaborations, but the platform may intervene to protect users and investigate incidents."
              : "Providers y resenadores son responsables de sus propias colaboraciones, pero la plataforma puede intervenir para proteger usuarios e investigar incidencias."}
          </p>
        </div>
        <Link href={`/?lang=${language}`} className="btn-secondary mt-6 inline-flex">
          {isEnglish ? "Back to home" : "Volver al inicio"}
        </Link>
      </div>
    </main>
  );
}
