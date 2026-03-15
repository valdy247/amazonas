import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, Compass, LockKeyhole, MapPin, Sparkles, WalletCards } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";
import { hasAdminAccess } from "@/lib/admin";
import { ProviderReviewerFinder } from "@/components/provider-reviewer-finder";
import { ReviewerOpportunities } from "@/components/reviewer-opportunities";
import { TestingAccessControls } from "@/components/testing-access-controls";
import { ProviderContactGrid } from "@/components/provider-contact-grid";
import { normalizeUserRole } from "@/lib/onboarding";
import { getReviewerContactMethods, mergeProfileData, type ReviewerAvailability } from "@/lib/profile-data";

type ProviderContact = {
  id: number;
  title: string;
  network: string | null;
  url: string;
  notes: string | null;
  is_verified: boolean;
  contact_methods?: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string | null;
  email?: string | null;
  phone?: string | null;
  accepted_terms_at?: string | null;
  profile_data?: unknown;
};

type RequestRow = {
  id: number;
  provider_id: string;
  reviewer_id: string;
  message: string | null;
  status: string;
  created_at: string;
};

const ACCESS_TEST_MODE = true;

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const withProfileData = await supabase
    .from("profiles")
    .select("full_name, role, email, profile_data")
    .eq("id", user.id)
    .single();

  const profile = withProfileData.error
    ? (
        await supabase
          .from("profiles")
          .select("full_name, role, email")
          .eq("id", user.id)
          .single()
      ).data
    : withProfileData.data;

  if (!profile?.role || profile.role === "pending") {
    redirect("/onboarding");
  }

  const role = normalizeUserRole(profile.role);
  const firstName = String(profile.full_name || "miembro").trim().split(/\s+/)[0] || "miembro";
  const metadata = (user.user_metadata || {}) as Record<string, unknown>;
  const profileData = mergeProfileData((profile as ProfileRow | null)?.profile_data, {
    country: typeof metadata.country === "string" ? metadata.country : "",
    experienceLevel: typeof metadata.experience_level === "string" ? metadata.experience_level : "new",
    interests: Array.isArray(metadata.interests)
      ? metadata.interests.filter((item): item is string => typeof item === "string")
      : [],
    note: typeof metadata.profile_note === "string" ? metadata.profile_note : "",
    availability: typeof metadata.availability === "string" ? metadata.availability : "open",
    allowsDirectContact: Boolean(metadata.allows_direct_contact),
    publicProfile: metadata.public_profile === false ? false : true,
    contact: metadata.reviewer_contact,
  });
  const userInterests = profileData.interests;
  const experienceLevel = profileData.experienceLevel;
  const profileNote = profileData.note;
  const country = profileData.country || null;
  const testingMembershipStatus = typeof metadata.testing_payment_state === "string" ? metadata.testing_payment_state : null;
  const testingKycStatus = typeof metadata.testing_kyc_state === "string" ? metadata.testing_kyc_state : null;
  const isAdmin = hasAdminAccess(profile?.role, profile?.email || user.email);
  const isProvider = role === "provider";

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

  const membershipStatus = ACCESS_TEST_MODE && testingMembershipStatus ? testingMembershipStatus : membership?.status || "pending_payment";
  const kycStatus = ACCESS_TEST_MODE && testingKycStatus ? testingKycStatus : kyc?.status || "pending";
  const canSeeContacts = !isProvider && membershipStatus === "active" && kycStatus === "approved";

  let contacts: ProviderContact[] = [];
  let contactedIds: number[] = [];
  let reviewerDirectory: Array<{
    id: string;
    fullName: string;
    firstName: string;
    country: string;
    experienceLevel: "new" | "growing" | "advanced";
    interests: string[];
    note: string;
    availability: ReviewerAvailability;
    allowsDirectContact: boolean;
    directContactMethods: Array<{ label: string; value: string }>;
    isVerified: boolean;
    isActiveMember: boolean;
    score: number;
  }> = [];
  let sentReviewerRequests: Array<{ reviewer_id: string; status: string; message: string | null }> = [];
  let reviewerOpportunities: Array<{
    id: number;
    providerId: string;
    providerName: string;
    providerCountry: string;
    providerInterests: string[];
    message: string;
    status: string;
    createdAt: string;
  }> = [];

  if (canSeeContacts) {
    const withMethods = await supabase
      .from("provider_contacts")
      .select("id, title, network, url, notes, is_verified, contact_methods")
      .eq("is_active", true);

    if (withMethods.error) {
      const withVerification = await supabase
        .from("provider_contacts")
        .select("id, title, network, url, notes, is_verified")
        .eq("is_active", true);

      if (withVerification.error) {
        const fallback = await supabase
          .from("provider_contacts")
          .select("id, title, network, url, notes")
          .eq("is_active", true);

        contacts = (fallback.data || []).map((contact) => ({
          ...contact,
          is_verified: false,
          contact_methods: null,
        })) as ProviderContact[];
      } else {
        contacts = (withVerification.data || []).map((contact) => ({
          ...contact,
          contact_methods: null,
        })) as ProviderContact[];
      }
    } else {
      contacts = (withMethods.data || []) as ProviderContact[];
    }

    const contactIds = contacts.map((contact) => contact.id);

    if (contactIds.length) {
      const { data: contactHistory } = await supabase
        .from("reviewer_contact_history")
        .select("provider_contact_id")
        .eq("reviewer_id", user.id)
        .in("provider_contact_id", contactIds);

      contactedIds = (contactHistory || [])
        .map((row) => Number(row.provider_contact_id))
        .filter((value) => Number.isFinite(value));
    }
  }

  if (isProvider) {
    const withReviewerData = await supabase
      .from("profiles")
      .select("id, full_name, role, accepted_terms_at, profile_data")
      .in("role", ["reviewer", "tester"])
      .not("accepted_terms_at", "is", null);

    const reviewerRows = withReviewerData.error
      ? (
          await supabase
            .from("profiles")
            .select("id, full_name, role, accepted_terms_at")
            .in("role", ["reviewer", "tester"])
            .not("accepted_terms_at", "is", null)
        ).data || []
      : withReviewerData.data || [];

    const reviewerIds = reviewerRows.map((row) => row.id);
    const { data: reviewerMemberships } = reviewerIds.length
      ? await supabase.from("memberships").select("user_id, status").in("user_id", reviewerIds)
      : { data: [] };
    const { data: reviewerKyc } = reviewerIds.length
      ? await supabase.from("kyc_checks").select("user_id, status").in("user_id", reviewerIds)
      : { data: [] };

    const membershipMap = new Map((reviewerMemberships || []).map((row) => [row.user_id, row.status]));
    const kycMap = new Map((reviewerKyc || []).map((row) => [row.user_id, row.status]));

    reviewerDirectory = (reviewerRows as ProfileRow[])
      .map((row) => {
        const reviewerData = mergeProfileData(row.profile_data);
        const overlap = reviewerData.interests.filter((interest) => userInterests.includes(interest)).length;
        const score = overlap * 3 + (reviewerData.country && reviewerData.country === country ? 2 : 0) + (reviewerData.availability === "open" ? 1 : 0);

        return {
          id: row.id,
          fullName: row.full_name || "Reviewer sin nombre",
          firstName: String(row.full_name || "reviewer").trim().split(/\s+/)[0] || "reviewer",
          country: reviewerData.country,
          experienceLevel: reviewerData.experienceLevel,
          interests: reviewerData.interests,
          note: reviewerData.note,
          availability: reviewerData.availability,
          allowsDirectContact: reviewerData.allowsDirectContact,
          directContactMethods: reviewerData.allowsDirectContact ? getReviewerContactMethods(reviewerData) : [],
          isVerified: kycMap.get(row.id) === "approved",
          isActiveMember: membershipMap.get(row.id) === "active",
          score,
        };
      })
      .filter((row) => row.isActiveMember && (row.interests.length || row.note || row.country) && mergeProfileData((reviewerRows.find((item) => item.id === row.id) as ProfileRow | undefined)?.profile_data).publicProfile)
      .sort((a, b) => b.score - a.score || Number(b.isVerified) - Number(a.isVerified) || a.fullName.localeCompare(b.fullName));

    const { data: requestRows } = await supabase
      .from("reviewer_contact_requests")
      .select("reviewer_id, status, message")
      .eq("provider_id", user.id);

    sentReviewerRequests = (requestRows || []) as Array<{ reviewer_id: string; status: string; message: string | null }>;
  }

  if (!isProvider) {
    const { data: requestRows } = await supabase
      .from("reviewer_contact_requests")
      .select("id, provider_id, reviewer_id, message, status, created_at")
      .eq("reviewer_id", user.id)
      .order("created_at", { ascending: false });

    const requests = (requestRows || []) as RequestRow[];
    const providerIds = requests.map((item) => item.provider_id);

    if (providerIds.length) {
      const providerProfilesResult = await supabase
        .from("profiles")
        .select("id, full_name, profile_data")
        .in("id", providerIds);

      const providerProfiles = (providerProfilesResult.data || []) as ProfileRow[];
      const providerMap = new Map(
        providerProfiles.map((item) => [
          item.id,
          {
            fullName: item.full_name || "Provider",
            profileData: mergeProfileData(item.profile_data),
          },
        ])
      );

      reviewerOpportunities = requests.map((item) => ({
        id: item.id,
        providerId: item.provider_id,
        providerName: providerMap.get(item.provider_id)?.fullName || "Provider",
        providerCountry: providerMap.get(item.provider_id)?.profileData.country || "",
        providerInterests: providerMap.get(item.provider_id)?.profileData.interests || [],
        message: item.message || "",
        status: item.status,
        createdAt: item.created_at,
      }));
    }
  }

  const reviewerSteps = [
    {
      title: "Acceso",
      description: membershipStatus === "active" ? "Tu acceso de prueba ya esta activo." : "Activa la membresia de prueba para seguir.",
      done: membershipStatus === "active",
      icon: WalletCards,
    },
    {
      title: "KYC",
      description: kycStatus === "approved" ? "Tu validacion de prueba ya esta aprobada." : "Aprueba KYC de prueba para desbloquear el panel final.",
      done: kycStatus === "approved",
      icon: BadgeCheck,
    },
    {
      title: "Contactos",
      description: canSeeContacts ? "Ya puedes abrir los contactos disponibles." : "Se habilita cuando acceso y KYC esten listos.",
      done: canSeeContacts,
      icon: Compass,
    },
  ];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="container-x space-y-4 py-6">
        <section className="overflow-hidden rounded-[1.8rem] border border-[#1f1b17] bg-[linear-gradient(135deg,#201915_0%,#2c221a_55%,#3f2a1d_100%)] p-5 text-white shadow-[0_26px_80px_rgba(35,22,13,0.22)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-white/55">{isProvider ? "Provider Hub" : "Reviewer Hub"}</p>
              <h1 className="mt-2 text-3xl font-bold">Hola, {firstName}</h1>
            </div>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <Sparkles className="h-5 w-5" />
            </span>
          </div>

          <div className={`mt-5 grid gap-3 ${isProvider ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/6 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/50">Pais y nivel</p>
              <div className="mt-2 flex items-center gap-2 text-sm text-white/85">
                <MapPin className="h-4 w-4" />
                <span>{country || "Sin pais"}</span>
              </div>
              <p className="mt-2 text-sm text-white/72">{experienceLevel || "Nivel pendiente"}</p>
            </div>
            {!isProvider ? (
              <div className="rounded-[1.4rem] border border-white/10 bg-white/6 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/50">Estado</p>
                <p className={`mt-2 text-sm font-semibold ${membershipStatus === "active" ? "text-emerald-300" : "text-amber-300"}`}>
                  Membresia: {membershipStatus}
                </p>
                <p className={`mt-2 text-sm font-semibold ${kycStatus === "approved" ? "text-emerald-300" : "text-amber-300"}`}>
                  KYC: {kycStatus}
                </p>
              </div>
            ) : null}
            {isAdmin ? (
              <div className="rounded-[1.4rem] border border-white/10 bg-white/6 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/50">Permisos</p>
                <p className="mt-2 text-sm font-semibold text-white/85">Admin habilitado</p>
              </div>
            ) : null}
          </div>

          {userInterests.length ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {userInterests.map((interest) => (
                <span key={interest} className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs font-semibold text-white">
                  {interest}
                </span>
              ))}
            </div>
          ) : null}

          {profileNote ? <p className="mt-4 max-w-2xl text-sm text-white/68">{profileNote}</p> : null}
        </section>

        {isProvider ? (
          <>
            <section className="card p-4">
              <h2 className="font-bold">Perfil provider activo</h2>
              <p className="mt-1 text-sm text-[#62626d]">
                Tu acceso no requiere pago. Desde aqui ya puedes descubrir reviewers, filtrar por afinidad y enviar solicitudes.
              </p>
              <Link href="/profile" className="btn-secondary mt-3">
                Editar perfil
              </Link>
            </section>

            <ProviderReviewerFinder reviewers={reviewerDirectory} sentRequests={sentReviewerRequests} providerInterests={userInterests} />
          </>
        ) : null}

        {!isProvider ? (
          <section className="grid gap-3 sm:grid-cols-3">
            {reviewerSteps.map((step) => {
              const Icon = step.icon;

              return (
                <article
                  key={step.title}
                  className={`rounded-[1.6rem] border p-4 ${
                    step.done ? "border-[#ffd7c8] bg-[linear-gradient(180deg,#fff6f1_0%,#fffdf9_100%)]" : "border-[#e8e1d8] bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${
                        step.done ? "bg-[#ff6b35] text-white" : "bg-[#f6f1ea] text-[#131316]"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className={`text-xs font-bold uppercase tracking-[0.18em] ${step.done ? "text-[#dc4f1f]" : "text-[#8f857b]"}`}>
                      {step.done ? "Listo" : "Pendiente"}
                    </span>
                  </div>
                  <h2 className="mt-4 text-lg font-bold">{step.title}</h2>
                  <p className="mt-2 text-sm text-[#62626d]">{step.description}</p>
                </article>
              );
            })}
          </section>
        ) : null}

        {!isProvider && membershipStatus !== "active" ? (
          <section className="rounded-[1.8rem] border border-[#f0d7ca] bg-[linear-gradient(180deg,#fff7f3_0%,#ffffff_100%)] p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ff6b35] text-white">
                <WalletCards className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-bold">Activar membresia</h2>
                <p className="text-sm text-[#62626d]">Paso 1 del recorrido de prueba</p>
              </div>
            </div>
            {ACCESS_TEST_MODE ? (
              <>
                <p className="mt-4 text-sm text-[#62626d]">
                  Square esta deshabilitado durante pruebas. Puedes marcar manualmente tu acceso para seguir validando el flujo.
                </p>
                <TestingAccessControls stage="payment" />
              </>
            ) : (
              <>
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
              </>
            )}
          </section>
        ) : null}

        {!isProvider && membershipStatus === "active" && kycStatus !== "approved" ? (
          <section className="rounded-[1.8rem] border border-[#dfe9df] bg-[linear-gradient(180deg,#f8fff8_0%,#ffffff_100%)] p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1f7a4d] text-white">
                <LockKeyhole className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-bold">Verificacion KYC</h2>
                <p className="text-sm text-[#62626d]">Paso 2 del recorrido de prueba</p>
              </div>
            </div>
            {ACCESS_TEST_MODE ? (
              <>
                <p className="mt-4 text-sm text-[#62626d]">
                  El KYC real tambien esta pausado en pruebas. Puedes aprobarlo o reiniciarlo manualmente para validar el recorrido.
                </p>
                <TestingAccessControls stage="kyc" />
              </>
            ) : (
              <p className="mt-1 text-sm text-[#62626d]">
                Tu membresia esta activa. Ahora toca validacion KYC economica. El admin te contactara para completar el proceso.
              </p>
            )}
          </section>
        ) : null}

        {!isProvider && canSeeContacts ? (
          <section className="rounded-[1.8rem] border border-[#e6ddd1] bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Contactos de proveedores</h2>
                <p className="mt-1 text-sm text-[#62626d]">Toca un proveedor para elegir la via de contacto disponible.</p>
              </div>
              <span className="inline-flex rounded-full bg-[#fff3ec] px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#dc4f1f]">
                Acceso abierto
              </span>
            </div>
            <ProviderContactGrid contacts={contacts} initialContactedIds={contactedIds} />
          </section>
        ) : null}

        {!isProvider && !canSeeContacts ? (
          <section className="rounded-[1.8rem] border border-dashed border-[#dfd4c8] bg-[#fffdf9] p-5">
            <h2 className="font-bold">Acceso a contactos</h2>
            <p className="mt-2 text-sm text-[#62626d]">
              Se habilita automaticamente cuando membresia y KYC esten en estado aprobado.
            </p>
            {ACCESS_TEST_MODE ? <TestingAccessControls stage="reset" /> : null}
          </section>
        ) : null}

        {!isProvider ? <ReviewerOpportunities opportunities={reviewerOpportunities} /> : null}

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
