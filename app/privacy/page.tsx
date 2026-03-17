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
        <div className="mt-8 space-y-8 text-sm leading-7 text-[#62564a]">
          <section>
            <h2 className="text-lg font-bold text-[#131316]">{isEnglish ? "1. What we collect" : "1. Que recopilamos"}</h2>
            <div className="mt-3 space-y-4">
              <p>
                {isEnglish
                  ? "We collect account details, profile information, identity-verification records, membership and payment references, support messages, moderation logs, and the minimum technical information needed to operate and secure the service."
                  : "Recopilamos datos de cuenta, informacion de perfil, registros de verificacion de identidad, referencias de pago y membresia, mensajes de soporte, registros de moderacion y la informacion tecnica minima necesaria para operar y proteger el servicio."}
              </p>
            </div>
          </section>
          <section>
            <h2 className="text-lg font-bold text-[#131316]">{isEnglish ? "2. Why we use it" : "2. Para que lo usamos"}</h2>
            <div className="mt-3 space-y-4">
              <p>
                {isEnglish
                  ? "We use personal data to create accounts, authenticate users, verify identity, process membership payments, enable messaging, prevent abuse, investigate incidents, provide support, and comply with legal obligations."
                  : "Usamos los datos personales para crear cuentas, autenticar usuarios, verificar identidad, procesar pagos de membresia, habilitar mensajeria, prevenir abuso, investigar incidentes, brindar soporte y cumplir obligaciones legales."}
              </p>
            </div>
          </section>
          <section>
            <h2 className="text-lg font-bold text-[#131316]">{isEnglish ? "3. Third-party processors" : "3. Proveedores externos"}</h2>
            <div className="mt-3 space-y-4">
              <p>
                {isEnglish
                  ? "Identity checks and payment processing may be handled by specialized providers such as Veriff and Square. Messaging features may also use translation or notification services when needed to operate the platform."
                  : "Las verificaciones de identidad y el procesamiento de pagos pueden ser gestionados por proveedores especializados como Veriff y Square. Las funciones de mensajeria tambien pueden usar servicios de traduccion o notificacion cuando sea necesario para operar la plataforma."}
              </p>
            </div>
          </section>
          <section>
            <h2 className="text-lg font-bold text-[#131316]">{isEnglish ? "4. Visibility and sharing" : "4. Visibilidad y comparticion"}</h2>
            <div className="mt-3 space-y-4">
              <p>
                {isEnglish
                  ? "We do not intentionally expose personal details publicly unless the user enables profile visibility or direct contact settings. Even when direct contact is enabled, users remain responsible for what they share with third parties."
                  : "No exponemos intencionalmente datos personales de forma publica a menos que el usuario habilite la visibilidad del perfil o el contacto directo. Incluso cuando el contacto directo esta activado, el usuario sigue siendo responsable de lo que comparte con terceros."}
              </p>
            </div>
          </section>
          <section>
            <h2 className="text-lg font-bold text-[#131316]">{isEnglish ? "5. Retention and security" : "5. Conservacion y seguridad"}</h2>
            <div className="mt-3 space-y-4">
              <p>
                {isEnglish
                  ? "We retain information for operational, support, security, and legal reasons for as long as reasonably necessary. We use administrative controls, role-based access restrictions, and service providers to reduce unauthorized access risk, but no system can promise absolute security."
                  : "Conservamos informacion por razones operativas, de soporte, seguridad y legales durante el tiempo razonablemente necesario. Usamos controles administrativos, restricciones por roles y proveedores de servicio para reducir el riesgo de acceso no autorizado, pero ningun sistema puede prometer seguridad absoluta."}
              </p>
            </div>
          </section>
          <section>
            <h2 className="text-lg font-bold text-[#131316]">{isEnglish ? "6. User choices" : "6. Opciones del usuario"}</h2>
            <div className="mt-3 space-y-4">
              <p>
                {isEnglish
                  ? "Users can update profile details, manage contact visibility, and request operational support from inside the platform. Some records may need to be retained even after account access changes for fraud prevention, dispute handling, or legal compliance."
                  : "Los usuarios pueden actualizar datos del perfil, gestionar la visibilidad de contacto y solicitar soporte operativo desde dentro de la plataforma. Algunos registros pueden conservarse incluso despues de cambios en el acceso por motivos de prevencion de fraude, gestion de disputas o cumplimiento legal."}
              </p>
            </div>
          </section>
        </div>
        <Link href={`/?lang=${language}`} className="btn-secondary mt-6 inline-flex">
          {isEnglish ? "Back to home" : "Volver al inicio"}
        </Link>
      </div>
    </main>
  );
}
