import Link from "next/link";
import { normalizeLanguage } from "@/lib/i18n";

const termsSections = {
  es: [
    {
      title: "1. Naturaleza de la plataforma",
      paragraphs: [
        "Verifyzon es una plataforma privada de conexion entre proveedores, marcas, vendedores y resenadores independientes. Verifyzon facilita herramientas de directorio, mensajeria, verificacion de identidad, soporte y administracion de acceso, pero no actua como vendedor, revendedor, distribuidor, agente comercial, empleador, representante, broker, intermediario financiero ni representante legal de ninguno de sus usuarios.",
        "Verifyzon no compra, no vende, no revende, no almacena ni distribuye productos anunciados, promocionados o negociados por sus usuarios. Verifyzon tampoco participa como parte contractual en acuerdos, colaboraciones, entregas de producto, pagos, reembolsos, compensaciones, comisiones, canjes, descuentos, muestras, reembolsos parciales o cualquier otro arreglo negociado entre usuarios dentro o fuera de la plataforma.",
      ],
    },
    {
      title: "2. Independencia frente a terceros",
      paragraphs: [
        "Verifyzon es un proyecto independiente. No esta afiliado, asociado, patrocinado, aprobado ni respaldado por Amazon.com, Inc., por sus afiliadas, ni por ninguna otra tienda, marketplace, plataforma de comercio electronico, programa de vendedores o programa de resenas de terceros, salvo que se indique expresamente por escrito en un acuerdo oficial y verificable.",
        "El uso de la plataforma no implica autorizacion, representacion ni cumplimiento automatico de las reglas de terceros. Cada usuario es responsable de revisar y cumplir los terminos, politicas, reglas de integridad, reglas de divulgacion, estandares de publicidad, reglas de marketplaces y cualquier otra obligacion aplicable a su actividad.",
      ],
    },
    {
      title: "3. No compra, venta o manipulacion de resenas",
      paragraphs: [
        "Verifyzon no promueve, no organiza, no garantiza, no tolera y no autoriza la compra, venta o manipulacion de resenas. Tambien queda prohibido utilizar la plataforma para exigir, solicitar, incentivar o condicionar una resena positiva, una calificacion especifica, la eliminacion de una critica, una resena obligatoria o una opinion favorable a cambio de dinero, productos, descuentos, reembolsos, beneficios, comisiones, acceso futuro o cualquier otra ventaja.",
        "Ningun usuario puede utilizar Verifyzon para imponer a otro usuario una obligacion de emitir opiniones falsas, sesgadas, ocultas, no divulgadas o contrarias a la ley, a las reglas de proteccion al consumidor o a las politicas de integridad de terceros. Cualquier colaboracion debe respetar la independencia editorial del resenador, las obligaciones de divulgacion y el marco legal aplicable.",
        "Si un proveedor envia muestras, productos, descuentos, reembolsos o cualquier forma de valor, ello no puede usarse para exigir una resena positiva, una puntuacion determinada, una publicacion obligatoria o una omision de informacion material. Los usuarios asumen toda la responsabilidad por sus acuerdos, divulgaciones y cumplimiento.",
      ],
    },
    {
      title: "4. Responsabilidad exclusiva de los usuarios",
      paragraphs: [
        "Los usuarios son unica y exclusivamente responsables por: (i) la veracidad de la informacion que cargan, (ii) las ofertas, mensajes y negociaciones que realizan, (iii) los productos o servicios que entregan o reciben, (iv) el cumplimiento de normas fiscales, publicitarias, de consumo, de propiedad intelectual, de privacidad y de plataformas de terceros, y (v) cualquier dano, reclamo, disputa, multa o investigacion derivada de su conducta.",
        "Verifyzon no controla en tiempo real, no supervisa previamente y no puede garantizar el contenido, calidad, legalidad, seguridad, autenticidad, oportunidad o cumplimiento de lo que los usuarios negocien, prometan, publiquen, envien o ejecuten dentro o fuera de la plataforma. En consecuencia, cualquier colaboracion, trato o acuerdo se realiza bajo responsabilidad exclusiva de sus participantes.",
      ],
    },
    {
      title: "5. Verificacion, acceso y confianza",
      paragraphs: [
        "La verificacion de identidad, el pago de membresia, la activacion de cuenta o cualquier distintivo de confianza no constituyen una garantia absoluta de conducta, legalidad, cumplimiento, solvencia, calidad, autenticidad de producto ni resultado comercial. Esos mecanismos existen para reducir friccion y elevar el estandar de confianza, pero no eliminan el riesgo inherente a tratar con terceros.",
        "Los usuarios deben realizar su propia evaluacion, diligencia y criterio antes de compartir datos, aceptar colaboraciones, enviar productos, efectuar pagos o asumir obligaciones externas.",
      ],
    },
    {
      title: "6. Conductas prohibidas",
      paragraphs: [
        "Queda prohibido usar Verifyzon para fraude, suplantacion, spam, acoso, lavado de reputacion, manipulacion de opiniones, resenas no divulgadas, incentivos engañosos, coordinacion de calificaciones, reseñas fabricadas, solicitudes de puntuacion especifica, encubrimiento de relaciones materiales, uso de identidades falsas, uso de documentos falsos, apropiacion de cuentas, scraping no autorizado, ingenieria social, enlaces maliciosos, malware o actividades ilegales.",
        "Tambien queda prohibido utilizar la plataforma para evadir politicas de marketplaces, ocultar compensaciones, coordinar contenido engañoso, simular experiencias reales inexistentes o presionar a resenadores para modificar, suavizar o eliminar opiniones autenticas.",
      ],
    },
    {
      title: "7. Moderacion, suspensiones y cooperacion",
      paragraphs: [
        "Verifyzon puede, a su sola discrecion y sin obligacion de previo aviso, limitar, suspender, bloquear, revisar, retener, archivar o cancelar cuentas, mensajes, contactos, verificaciones, accesos, contenidos o funcionalidades cuando detecte riesgo, fraude, conducta abusiva, indicios de manipulacion de resenas, incumplimiento legal o violacion de estos terminos.",
        "Verifyzon puede conservar registros, colaborar con proveedores de verificacion, pagos, hosting, autoridades, asesores o terceros competentes cuando sea razonablemente necesario para investigar incidentes, responder requerimientos legales, proteger a la comunidad o hacer cumplir estos terminos.",
      ],
    },
    {
      title: "8. Limitacion de responsabilidad",
      paragraphs: [
        "En la maxima medida permitida por la ley aplicable, Verifyzon y sus propietarios, operadores, administradores, contratistas y proveedores no seran responsables por danos directos, indirectos, incidentales, especiales, ejemplares, punitivos o consecuenciales derivados de negociaciones, acuerdos, incumplimientos, envios, pagos, reembolsos, productos defectuosos, perdida de oportunidades, perdida de reputacion, sanciones de terceros, cierres de cuenta en otras plataformas, reclamos de consumidores, reseñas publicadas por usuarios o disputas entre usuarios.",
        "La plataforma se ofrece en base 'tal cual' y 'segun disponibilidad'. Verifyzon no garantiza resultados comerciales, conversiones, ventas, reseñas, cumplimiento regulatorio, continuidad operativa ininterrumpida, ausencia total de errores ni compatibilidad con politicas cambiantes de terceros.",
      ],
    },
    {
      title: "9. Indemnizacion",
      paragraphs: [
        "Cada usuario acepta defender, indemnizar y mantener indemne a Verifyzon, sus propietarios, administradores, operadores, empleados, contratistas y afiliados frente a cualquier reclamo, investigacion, sancion, multa, perdida, dano, costo, honorario o gasto derivado de: (i) su uso de la plataforma, (ii) sus acuerdos o comunicaciones con otros usuarios, (iii) sus productos, publicaciones, promociones o reseñas, (iv) el incumplimiento de leyes, reglas de terceros o estos terminos, o (v) la infraccion de derechos de terceros.",
      ],
    },
    {
      title: "10. Propiedad intelectual y uso del nombre",
      paragraphs: [
        "Los usuarios no adquieren derechos sobre la marca Verifyzon, su software, contenido, base de datos, diseno, flujos, materiales ni documentacion, salvo el uso limitado de la plataforma conforme a estos terminos.",
        "Los usuarios tampoco pueden presentar a Verifyzon como aliado oficial, representante o socio de marketplaces, programas de vendedores o marcas de terceros sin autorizacion expresa y por escrito.",
      ],
    },
    {
      title: "11. Cambios y vigencia",
      paragraphs: [
        "Verifyzon puede actualizar estos terminos en cualquier momento para reflejar cambios regulatorios, operativos, tecnicos o de riesgo. El uso continuado de la plataforma despues de cualquier actualizacion implica aceptacion de la version vigente.",
        "Si alguna clausula resulta invalida o inaplicable, el resto de los terminos seguira en pleno vigor.",
      ],
    },
    {
      title: "12. Contacto y advertencia final",
      paragraphs: [
        "Si no estas de acuerdo con estos terminos, no debes usar la plataforma. Si tienes dudas sobre cumplimiento legal, publicidad, divulgaciones, marketplaces o colaboraciones comerciales, debes obtener asesoria profesional independiente antes de actuar.",
        "Para soporte operativo puedes usar el centro de soporte disponible dentro de tu cuenta.",
      ],
    },
  ],
  en: [
    {
      title: "1. Nature of the platform",
      paragraphs: [
        "Verifyzon is a private platform designed to connect providers, brands, sellers, and independent reviewers. Verifyzon offers directory, messaging, identity verification, support, and access-management tools, but it does not act as a seller, reseller, distributor, commercial agent, employer, broker, financial intermediary, or legal representative of any user.",
        "Verifyzon does not buy, sell, resell, warehouse, distribute, or fulfill any products advertised, promoted, or negotiated by its users. Verifyzon is not a contractual party to any collaboration, shipment, payment, refund, commission, sample arrangement, reimbursement, discount, exchange, or other arrangement negotiated between users on or off the platform.",
      ],
    },
    {
      title: "2. Independence from third parties",
      paragraphs: [
        "Verifyzon is an independent project. It is not affiliated with, associated with, endorsed by, sponsored by, or approved by Amazon.com, Inc., its affiliates, or any other marketplace, retailer, e-commerce platform, seller program, or review program, unless Verifyzon expressly states otherwise in a written and verifiable official agreement.",
        "Using Verifyzon does not grant any approval, authorization, or automatic compliance with the rules of third parties. Each user is solely responsible for understanding and complying with all marketplace policies, advertising rules, disclosure rules, consumer protection laws, endorsement rules, and any other obligations applicable to that user's activities.",
      ],
    },
    {
      title: "3. No buying, selling, or manipulating reviews",
      paragraphs: [
        "Verifyzon does not promote, organize, guarantee, tolerate, or authorize the purchase, sale, or manipulation of reviews. Users may not use the platform to require, request, incentivize, condition, or pressure another user into providing a positive review, a specific rating, the removal of criticism, a mandatory review, or a favorable opinion in exchange for money, products, discounts, reimbursements, access, future opportunities, commissions, or any other benefit.",
        "No user may use Verifyzon to impose an obligation to publish false, misleading, hidden, undisclosed, or unlawful opinions. Any collaboration must preserve the independent judgment of the reviewer and must comply with all applicable law, disclosure obligations, and third-party platform requirements.",
        "If a provider sends samples, products, discounts, reimbursements, or anything of value, that may not be used to demand a positive review, a specific star rating, a required publication, or the suppression of material information. Users remain fully responsible for their agreements, disclosures, and compliance.",
      ],
    },
    {
      title: "4. Users are solely responsible for their conduct",
      paragraphs: [
        "Users are solely and exclusively responsible for: (i) the truthfulness of the information they submit, (ii) the offers, messages, and negotiations they make, (iii) the products or services they provide or receive, (iv) their compliance with tax, advertising, consumer, privacy, intellectual-property, and third-party marketplace rules, and (v) any harm, claim, dispute, investigation, or penalty arising out of their conduct.",
        "Verifyzon does not actively monitor or pre-approve all negotiations, content, offers, claims, or collaborations, and it cannot guarantee the legality, authenticity, safety, quality, accuracy, or performance of anything exchanged, promised, or carried out by users on or off the platform.",
      ],
    },
    {
      title: "5. Verification, membership, and trust signals",
      paragraphs: [
        "Identity verification, membership status, access activation, internal trust indicators, or administrative review do not constitute a warranty of lawful conduct, product quality, authenticity, solvency, reliability, or business outcome. These measures are designed to reduce friction and improve trust, but they do not eliminate the inherent risk of dealing with third parties.",
        "Users must perform their own diligence and exercise independent judgment before sharing information, sending products, making payments, entering agreements, or relying on any third-party statement or representation.",
      ],
    },
    {
      title: "6. Prohibited conduct",
      paragraphs: [
        "Users may not use Verifyzon for fraud, impersonation, spam, harassment, undisclosed incentives, review manipulation, reputation laundering, fake or coordinated reviewing activity, pressure tactics, forged documentation, account abuse, malware, social engineering, unauthorized scraping, or any unlawful conduct.",
        "Users are also prohibited from using the platform to evade marketplace integrity rules, hide material connections, coordinate deceptive endorsements, simulate experiences that did not occur, or pressure reviewers to change, soften, or remove authentic opinions.",
      ],
    },
    {
      title: "7. Moderation, suspensions, and cooperation",
      paragraphs: [
        "Verifyzon may, at its sole discretion and without prior notice, limit, suspend, review, archive, retain, restrict, or terminate accounts, messages, verifications, contacts, access, or functionality if it detects abuse, fraud, legal risk, suspected review manipulation, policy violations, or other harmful behavior.",
        "Verifyzon may preserve records and cooperate with payment providers, identity-verification providers, hosting partners, legal advisers, law-enforcement authorities, and other competent parties when reasonably necessary to investigate incidents, comply with lawful requests, protect users, or enforce these terms.",
      ],
    },
    {
      title: "8. Limitation of liability",
      paragraphs: [
        "To the maximum extent permitted by applicable law, Verifyzon and its owners, operators, administrators, contractors, and service providers shall not be liable for direct, indirect, incidental, special, exemplary, punitive, or consequential damages arising from user negotiations, collaborations, shipments, payments, refunds, defective products, missed opportunities, reputation loss, account suspensions on third-party platforms, consumer complaints, user-generated reviews, or disputes between users.",
        "The platform is provided on an 'as is' and 'as available' basis. Verifyzon does not guarantee commercial results, conversions, compliance outcomes, uninterrupted availability, absence of errors, or compatibility with changing third-party marketplace policies.",
      ],
    },
    {
      title: "9. Indemnification",
      paragraphs: [
        "Each user agrees to defend, indemnify, and hold harmless Verifyzon, its owners, operators, administrators, affiliates, contractors, and service providers from and against any claim, action, investigation, demand, penalty, fine, loss, liability, cost, or expense arising out of: (i) the user's use of the platform, (ii) the user's communications or agreements with others, (iii) the user's products, promotions, endorsements, or reviews, (iv) the user's violation of law, third-party rules, or these terms, or (v) the user's infringement of any third-party rights.",
      ],
    },
    {
      title: "10. Intellectual property and brand use",
      paragraphs: [
        "Users do not acquire rights in the Verifyzon name, brand, software, interface, databases, workflows, content, or documentation except for the limited right to use the platform in accordance with these terms.",
        "Users may not represent Verifyzon as an official partner, representative, or approved intermediary of any marketplace, seller program, retailer, or third-party brand without express written authorization.",
      ],
    },
    {
      title: "11. Updates and continued use",
      paragraphs: [
        "Verifyzon may update these terms at any time to reflect operational, regulatory, legal, technical, or risk-related changes. Continued use of the platform after any update means you accept the current version of the terms.",
        "If any provision is found invalid or unenforceable, the remaining provisions shall remain in full force and effect.",
      ],
    },
    {
      title: "12. Final notice and support",
      paragraphs: [
        "If you do not agree with these terms, you must not use the platform. If you have legal questions regarding endorsements, disclosures, consumer law, or marketplace compliance, you should obtain independent professional advice before acting.",
        "For operational assistance, you may use the support center available from your account.",
      ],
    },
  ],
} as const;

export default async function TermsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const language = normalizeLanguage(typeof resolvedSearchParams.lang === "string" ? resolvedSearchParams.lang : undefined);
  const isEnglish = language === "en";
  const sections = termsSections[language];

  return (
    <main className="container-x py-8">
      <div className="rounded-[2rem] border border-[#eadfd6] bg-white p-6 shadow-[0_18px_36px_rgba(22,18,14,0.04)]">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#dc4f1f]">Legal</p>
        <h1 className="mt-3 text-3xl font-bold text-[#131316]">{isEnglish ? "Terms and Conditions" : "Terminos y condiciones"}</h1>
        <p className="mt-4 text-sm leading-7 text-[#62564a]">
          {isEnglish
            ? "These terms govern the use of Verifyzon and are intended to make clear that users, not the platform, are solely responsible for their negotiations, collaborations, endorsements, and compliance."
            : "Estos terminos regulan el uso de Verifyzon y dejan claro que los usuarios, y no la plataforma, son los unicos responsables de sus negociaciones, colaboraciones, menciones y cumplimiento."}
        </p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-[#62564a]">
          {sections.map((section) => (
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
