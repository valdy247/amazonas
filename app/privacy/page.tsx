import Link from "next/link";
import { normalizeLanguage } from "@/lib/i18n";

export default async function PrivacyPage({
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
        <h1 className="mt-3 text-3xl font-bold text-[#131316]">{isEnglish ? "Privacy Policy" : "Politica de privacidad"}</h1>
        <div className="mt-5 space-y-4 text-sm leading-7 text-[#62564a]">
          <p>
            {isEnglish
              ? "We collect only the information necessary to create accounts, verify identity, process membership payments, enable messaging, and keep the platform safe."
              : "Recopilamos solo la informacion necesaria para crear cuentas, verificar identidad, procesar pagos de membresia, habilitar mensajeria y mantener la plataforma segura."}
          </p>
          <p>
            {isEnglish
              ? "Identity and payment checks may be processed by third-party providers such as Veriff and Square. Messaging can also use translation services to improve communication between users who speak different languages."
              : "Las verificaciones de identidad y pagos pueden ser procesadas por proveedores externos como Veriff y Square. La mensajeria tambien puede usar servicios de traduccion para mejorar la comunicacion entre usuarios que hablan idiomas distintos."}
          </p>
          <p>
            {isEnglish
              ? "We do not expose personal details publicly unless the user explicitly enables contact visibility in the platform."
              : "No exponemos datos personales publicamente a menos que el usuario habilite de forma explicita la visibilidad de contacto dentro de la plataforma."}
          </p>
        </div>
        <Link href={`/?lang=${language}`} className="btn-secondary mt-6 inline-flex">
          {isEnglish ? "Back to home" : "Volver al inicio"}
        </Link>
      </div>
    </main>
  );
}
