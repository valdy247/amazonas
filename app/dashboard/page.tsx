import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";
import { hasAdminAccess } from "@/lib/admin";

type ProviderContact = {
  id: number;
  title: string;
  network: string | null;
  url: string;
  notes: string | null;
};

function statusColor(status: string) {
  if (status === "active" || status === "approved") return "text-emerald-700";
  if (status === "rejected" || status === "suspended") return "text-red-600";
  return "text-amber-700";
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, email")
    .eq("id", user.id)
    .single();

  if (!profile?.role || profile.role === "pending") {
    redirect("/onboarding");
  }

  const metadata = (user.user_metadata || {}) as Record<string, unknown>;
  const userInterests = Array.isArray(metadata.interests)
    ? metadata.interests.filter((item): item is string => typeof item === "string")
    : [];
  const experienceLevel = typeof metadata.experience_level === "string" ? metadata.experience_level : null;
  const profileNote = typeof metadata.profile_note === "string" ? metadata.profile_note : null;
  const country = typeof metadata.country === "string" ? metadata.country : null;
  const isAdmin = hasAdminAccess(profile?.role, profile?.email || user.email);
  const isProvider = profile?.role === "provider";

  const { data: membership } = await supabase
    .from("memberships")
    .select("status")
    .eq("user_id", user.id)
    .single();

  const { data: kyc } = await supabase
    .from("kyc_checks")
    .select("status")
    .eq("user_id", user.id)
    .single();

  const membershipStatus = membership?.status || "pending_payment";
  const kycStatus = kyc?.status || "pending";
  const canSeeContacts = !isProvider && membershipStatus === "active" && kycStatus === "approved";

  const { data: contacts } = canSeeContacts
    ? await supabase.from("provider_contacts").select("id, title, network, url, notes").eq("is_active", true)
    : { data: [] as ProviderContact[] };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="container-x space-y-4 py-6">
        <section className="card p-4">
          <h1 className="text-2xl font-bold">Hola, {profile?.full_name || "miembro"}</h1>
          <p className="mt-1 text-sm text-[#62626d]">Rol: {isAdmin ? "admin" : profile?.role}</p>
          {!isProvider ? <p className={`mt-1 text-sm ${statusColor(membershipStatus)}`}>Membresia: {membershipStatus}</p> : null}
          {!isProvider ? <p className={`mt-1 text-sm ${statusColor(kycStatus)}`}>KYC: {kycStatus}</p> : null}
          {country ? <p className="mt-1 text-sm text-[#62626d]">Pais: {country}</p> : null}
          {experienceLevel ? <p className="mt-1 text-sm text-[#62626d]">Nivel: {experienceLevel}</p> : null}
          {userInterests.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {userInterests.map((interest) => (
                <span key={interest} className="rounded-full bg-[#fff3ec] px-3 py-1 text-xs font-semibold text-[#dc4f1f]">
                  {interest}
                </span>
              ))}
            </div>
          ) : null}
          {profileNote ? <p className="mt-3 text-sm text-[#62626d]">{profileNote}</p> : null}
        </section>

        {isProvider ? (
          <>
            <section className="card p-4">
              <h2 className="font-bold">Perfil provider activo</h2>
              <p className="mt-1 text-sm text-[#62626d]">
                Tu acceso no requiere pago. Este dashboard queda listo para evolucionar a un buscador de testers por intereses,
                pais y experiencia.
              </p>
              <Link href="/profile" className="btn-secondary mt-3">
                Editar perfil
              </Link>
            </section>

            <section className="card p-4">
              <h2 className="font-bold">Buscador de testers</h2>
              <p className="mt-1 text-sm text-[#62626d]">
                La siguiente capa puede usar tus etiquetas para mostrar testers compatibles sin friccion desde movil.
              </p>
            </section>
          </>
        ) : null}

        {!isProvider && membershipStatus !== "active" ? (
          <section className="card p-4">
            <h2 className="font-bold">1) Activar membresia</h2>
            <p className="mt-1 text-sm text-[#62626d]">
              Usa Square para pagar tu acceso. Cuando se confirme, admin marcara tu cuenta como activa.
            </p>
            <a
              href={process.env.NEXT_PUBLIC_SQUARE_PAYMENT_LINK || "#"}
              target="_blank"
              rel="noreferrer"
              className="btn-primary mt-3"
            >
              Pagar con Square
            </a>
          </section>
        ) : null}

        {!isProvider && membershipStatus === "active" && kycStatus !== "approved" ? (
          <section className="card p-4">
            <h2 className="font-bold">2) Verificacion KYC</h2>
            <p className="mt-1 text-sm text-[#62626d]">
              Tu membresia esta activa. Ahora toca validacion KYC economica. El admin te contactara para completar el proceso.
            </p>
          </section>
        ) : null}

        {!isProvider && canSeeContacts ? (
          <section className="card p-4">
            <h2 className="font-bold">Contactos de proveedores</h2>
            <div className="mt-3 grid gap-3">
              {(contacts as ProviderContact[] | null)?.map((contact) => (
                <article key={contact.id} className="rounded-xl border border-[#e5e5df] p-3">
                  <p className="font-semibold">{contact.title}</p>
                  <p className="text-xs text-[#62626d]">{contact.network || "Red no definida"}</p>
                  <a className="mt-2 inline-block text-sm font-semibold text-[#dc4f1f]" href={contact.url} target="_blank" rel="noreferrer">
                    Abrir contacto
                  </a>
                  {contact.notes ? <p className="mt-2 text-sm text-[#62626d]">{contact.notes}</p> : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {!isProvider && !canSeeContacts ? (
          <section className="card p-4">
            <h2 className="font-bold">3) Acceso a contactos</h2>
            <p className="mt-1 text-sm text-[#62626d]">
              Se habilita automaticamente cuando membresia y KYC esten en estado aprobado.
            </p>
          </section>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Link href="/profile" className="btn-secondary">
            Editar perfil
          </Link>
          {isAdmin ? (
            <Link href="/admin" className="btn-secondary">
              Ir al panel admin
            </Link>
          ) : null}
        </div>
      </main>
    </div>
  );
}
