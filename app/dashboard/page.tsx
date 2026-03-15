import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, Compass, LockKeyhole, MapPin, MessageCircleMore, Sparkles, WalletCards } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";
import { hasAdminAccess } from "@/lib/admin";
import { ProviderReviewerFinder } from "@/components/provider-reviewer-finder";
import { ReviewerOpportunities } from "@/components/reviewer-opportunities";
import { CollaborationInbox } from "@/components/collaboration-inbox";
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
  updated_at?: string;
  request_data?: unknown;
  response_message?: string | null;
  last_activity_at?: string;
};

type MessageRow = {
  id: number;
  request_id: number;
  sender_id: string;
  body: string;
  created_at: string;
  image_url?: string | null;
  image_path?: string | null;
};

type ConversationThread = {
  requestId: number;
  counterpartId: string;
  counterpartName: string;
  counterpartCountry: string;
  counterpartInterests: string[];
  messages: Array<{
    id: number;
    senderId: string;
    body: string;
    createdAt: string;
    imageUrl?: string | null;
    imagePath?: string | null;
  }>;
  lastActivityAt: string;
};

const PAYMENT_TEST_MODE = false;
const KYC_TEST_MODE = true;

function normalizeComparable(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
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
  const userMetadataInterests = Array.isArray(metadata.interests)
    ? metadata.interests.filter((item): item is string => typeof item === "string")
    : [];
  const profileData = mergeProfileData((profile as ProfileRow | null)?.profile_data, {
    country: typeof metadata.country === "string" ? metadata.country : "",
    experienceLevel: typeof metadata.experience_level === "string" ? metadata.experience_level : "new",
    interests: userMetadataInterests,
    note: typeof metadata.profile_note === "string" ? metadata.profile_note : "",
    availability: typeof metadata.availability === "string" ? metadata.availability : "open",
    allowsDirectContact: Boolean(metadata.allows_direct_contact),
    publicProfile: metadata.public_profile === false ? false : true,
    contact: metadata.reviewer_contact,
  });
  const storedProfileData = JSON.stringify(((profile as ProfileRow | null)?.profile_data || null));
  const normalizedProfileData = JSON.stringify(profileData);

  if (storedProfileData !== normalizedProfileData) {
    await supabase.from("profiles").update({ profile_data: profileData }).eq("id", user.id);
  }

  const userInterests = profileData.interests;
  const experienceLevel = profileData.experienceLevel;
  const profileNote = profileData.note;
  const country = profileData.country || null;
  const testingMembershipStatus = typeof metadata.testing_payment_state === "string" ? metadata.testing_payment_state : null;
  const testingKycStatus = typeof metadata.testing_kyc_state === "string" ? metadata.testing_kyc_state : null;
  const isAdmin = hasAdminAccess(profile?.role, profile?.email || user.email);
  const isProvider = role === "provider";

  const { data: membership } = await supabase.from("memberships").select("status").eq("user_id", user.id).single();
  const { data: kyc } = await supabase.from("kyc_checks").select("status").eq("user_id", user.id).single();

  const membershipStatus = PAYMENT_TEST_MODE && testingMembershipStatus ? testingMembershipStatus : membership?.status || "pending_payment";
  const kycStatus = KYC_TEST_MODE && testingKycStatus ? testingKycStatus : kyc?.status || "pending";
  const canSeeContacts = !isProvider && membershipStatus === "active" && kycStatus === "approved";
  const squareStatus = typeof resolvedSearchParams.square === "string" ? resolvedSearchParams.square : null;
  const squareError = typeof resolvedSearchParams.square_error === "string" ? resolvedSearchParams.square_error : null;
  const requestedSection = typeof resolvedSearchParams.section === "string" ? resolvedSearchParams.section : "home";
  const currentSection = isProvider
    ? requestedSection === "messages"
      ? "messages"
      : "home"
    : requestedSection === "messages" || requestedSection === "contacts"
      ? requestedSection
      : "home";
  const showWelcomeActivation = !isProvider && canSeeContacts;

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
    matchPercent: number;
  }> = [];
  let sentReviewerRequests: Array<{
    id: number;
    reviewer_id: string;
    status: string;
    message: string | null;
    request_data?: unknown;
    response_message?: string | null;
    created_at?: string;
    updated_at?: string;
  }> = [];
  let reviewerOpportunities: Array<{
    id: number;
    providerId: string;
    providerName: string;
    providerCountry: string;
    providerInterests: string[];
    message: string;
    status: string;
    createdAt: string;
    responseMessage?: string | null;
    requestData?: unknown;
  }> = [];
  let collaborationThreads: ConversationThread[] = [];

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
        const fallback = await supabase.from("provider_contacts").select("id, title, network, url, notes").eq("is_active", true);
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

      contactedIds = (contactHistory || []).map((row) => Number(row.provider_contact_id)).filter((value) => Number.isFinite(value));
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
        const categoryWeight = userInterests.length ? (overlap / userInterests.length) * 70 : 35;
        const countryWeight =
          normalizeComparable(reviewerData.country) && normalizeComparable(reviewerData.country) === normalizeComparable(country) ? 20 : 0;
        const availabilityWeight = reviewerData.availability === "open" ? 10 : 6;
        const matchPercent = Math.max(1, Math.min(100, Math.round(categoryWeight + countryWeight + availabilityWeight)));

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
          isActiveMember: membershipMap.get(row.id) === "active" || Boolean(row.accepted_terms_at),
          matchPercent,
        };
      })
      .filter(
        (row) =>
          row.availability !== "busy" &&
          mergeProfileData((reviewerRows.find((item) => item.id === row.id) as ProfileRow | undefined)?.profile_data).publicProfile
      )
      .sort((a, b) => b.matchPercent - a.matchPercent || Number(b.isVerified) - Number(a.isVerified) || a.fullName.localeCompare(b.fullName));

    const { data: requestRows } = await supabase
      .from("reviewer_contact_requests")
      .select("id, reviewer_id, status, message, request_data, response_message, created_at, updated_at")
      .eq("provider_id", user.id);

    sentReviewerRequests = ((requestRows || []) as typeof sentReviewerRequests).filter((request) => request.status !== "declined");

    const acceptedRequestsResult = await supabase
      .from("reviewer_contact_requests")
      .select("id, reviewer_id, updated_at, last_activity_at")
      .eq("provider_id", user.id)
      .eq("status", "accepted");

    const acceptedRequests = (acceptedRequestsResult.data || []) as Array<{
      id: number;
      reviewer_id: string;
      updated_at?: string;
      last_activity_at?: string;
    }>;
    const acceptedRequestIds = acceptedRequests.map((item) => item.id);

    if (acceptedRequestIds.length) {
      const { data: messageRows } = await supabase
        .from("request_messages")
        .select("id, request_id, sender_id, body, created_at, image_url, image_path")
        .in("request_id", acceptedRequestIds)
        .order("created_at", { ascending: true });

      const messagesByRequest = new Map<number, MessageRow[]>();
      ((messageRows || []) as MessageRow[]).forEach((message) => {
        messagesByRequest.set(message.request_id, [...(messagesByRequest.get(message.request_id) || []), message]);
      });

      collaborationThreads = acceptedRequests.map((request) => {
        const reviewer = reviewerDirectory.find((item) => item.id === request.reviewer_id);
        return {
          requestId: request.id,
          counterpartId: request.reviewer_id,
          counterpartName: reviewer?.fullName || "Reviewer",
          counterpartCountry: reviewer?.country || "",
          counterpartInterests: reviewer?.interests || [],
          messages: (messagesByRequest.get(request.id) || []).map((message) => ({
            id: message.id,
            senderId: message.sender_id,
            body: message.body,
            createdAt: message.created_at,
            imageUrl: message.image_url || null,
            imagePath: message.image_path || null,
          })),
          lastActivityAt: request.last_activity_at || request.updated_at || new Date(0).toISOString(),
        };
      });
    }
  }

  if (!isProvider) {
    const { data: requestRows } = await supabase
      .from("reviewer_contact_requests")
      .select("id, provider_id, reviewer_id, message, status, created_at, request_data, response_message, updated_at, last_activity_at")
      .eq("reviewer_id", user.id)
      .order("created_at", { ascending: false });

    const requests = (requestRows || []) as RequestRow[];
    const providerIds = requests.map((item) => item.provider_id);
    const providerMap = new Map<string, { fullName: string; profileData: ReturnType<typeof mergeProfileData> }>();

    if (providerIds.length) {
      const providerProfilesResult = await supabase.from("profiles").select("id, full_name, profile_data").in("id", providerIds);
      const providerProfiles = (providerProfilesResult.data || []) as ProfileRow[];

      providerProfiles.forEach((item) => {
        providerMap.set(item.id, {
          fullName: item.full_name || "Provider",
          profileData: mergeProfileData(item.profile_data),
        });
      });

      reviewerOpportunities = requests.map((item) => ({
        id: item.id,
        providerId: item.provider_id,
        providerName: providerMap.get(item.provider_id)?.fullName || "Provider",
        providerCountry: providerMap.get(item.provider_id)?.profileData.country || "",
        providerInterests: providerMap.get(item.provider_id)?.profileData.interests || [],
        message: item.message || "",
        status: item.status,
        createdAt: item.created_at,
        responseMessage: item.response_message || null,
        requestData: item.request_data,
      }));
    }

    const acceptedRequests = requests.filter((item) => item.status === "accepted");
    const acceptedRequestIds = acceptedRequests.map((item) => item.id);

    if (acceptedRequestIds.length) {
      const { data: messageRows } = await supabase
        .from("request_messages")
        .select("id, request_id, sender_id, body, created_at, image_url, image_path")
        .in("request_id", acceptedRequestIds)
        .order("created_at", { ascending: true });

      const messagesByRequest = new Map<number, MessageRow[]>();
      ((messageRows || []) as MessageRow[]).forEach((message) => {
        messagesByRequest.set(message.request_id, [...(messagesByRequest.get(message.request_id) || []), message]);
      });

      collaborationThreads = acceptedRequests.map((request) => ({
        requestId: request.id,
        counterpartId: request.provider_id,
        counterpartName: providerMap.get(request.provider_id)?.fullName || "Provider",
        counterpartCountry: providerMap.get(request.provider_id)?.profileData.country || "",
        counterpartInterests: providerMap.get(request.provider_id)?.profileData.interests || [],
        messages: (messagesByRequest.get(request.id) || []).map((message) => ({
          id: message.id,
          senderId: message.sender_id,
          body: message.body,
          createdAt: message.created_at,
          imageUrl: message.image_url || null,
          imagePath: message.image_path || null,
        })),
        lastActivityAt: request.last_activity_at || request.updated_at || request.created_at,
      }));
    }
  }

  const reviewerSteps = [
    {
      title: "Acceso",
      description: membershipStatus === "active" ? "Tu acceso ya esta activo." : "Completa tu pago con Square para seguir.",
      done: membershipStatus === "active",
      icon: WalletCards,
    },
    {
      title: "Verificacion de ID",
      description: kycStatus === "approved" ? "Tu verificacion de identidad ya esta aprobada." : "Completa tu verificacion de ID para desbloquear el panel final.",
      done: kycStatus === "approved",
      icon: BadgeCheck,
    },
    {
      title: "Contactos",
      description: canSeeContacts ? "Ya puedes abrir los contactos disponibles." : "Se habilita cuando acceso y verificacion de ID esten listos.",
      done: canSeeContacts,
      icon: Compass,
    },
  ];

  const latestConversationHasReply = collaborationThreads.some((thread) => {
    const lastMessage = thread.messages[thread.messages.length - 1];
    return lastMessage && lastMessage.senderId !== user.id;
  });
  const pendingMessageRequests = isProvider
    ? sentReviewerRequests.some((request) => request.status === "accepted" || request.status === "read")
    : reviewerOpportunities.some((request) => request.status === "sent" || request.status === "read");
  const hasUnreadMessages = pendingMessageRequests || latestConversationHasReply;
  const menuItems = [
    { href: "/dashboard", label: "Inicio" },
    !isProvider ? { href: "/dashboard?section=contacts", label: "Contactos de proveedores", locked: !canSeeContacts } : null,
    { href: "/profile", label: "Editar perfil" },
    isAdmin ? { href: "/admin", label: "Panel admin" } : null,
  ].filter(Boolean) as Array<{ href: string; label: string; locked?: boolean }>;
  const providerRequestStats = {
    active: sentReviewerRequests.filter((request) => request.status === "sent" || request.status === "read").length,
    accepted: sentReviewerRequests.filter((request) => request.status === "accepted").length,
    conversations: collaborationThreads.length,
  };
  const reviewerMessageStats = {
    requests: reviewerOpportunities.filter((request) => request.status === "sent" || request.status === "read").length,
    conversations: collaborationThreads.length,
  };

  return (
    <div className="min-h-screen">
      <SiteHeader menuItems={menuItems} messageHref="/dashboard?section=messages" hasUnreadMessages={hasUnreadMessages} />
      <main className="container-x space-y-4 py-6">
        {currentSection === "home" ? (
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
                    Verificacion de ID: {kycStatus}
                  </p>
                </div>
              ) : (
                <div className="rounded-[1.4rem] border border-white/10 bg-white/6 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/50">Mensajes</p>
                  <p className="mt-2 text-sm font-semibold text-white/85">{providerRequestStats.active} solicitudes activas</p>
                  <p className="mt-2 text-sm font-semibold text-white/72">{providerRequestStats.conversations} conversaciones abiertas</p>
                </div>
              )}
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
        ) : null}
        {currentSection === "home" && isProvider ? (
          <>
            <section className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Solicitudes activas", value: providerRequestStats.active },
                { label: "Aceptadas", value: providerRequestStats.accepted },
                { label: "Conversaciones", value: providerRequestStats.conversations },
              ].map((item) => (
                <article key={item.label} className="rounded-[1.6rem] border border-[#eadfd6] bg-white p-4 shadow-[0_18px_36px_rgba(22,18,14,0.04)]">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8f857b]">{item.label}</p>
                  <p className="mt-2 text-3xl font-bold text-[#131316]">{item.value}</p>
                </article>
              ))}
            </section>
            <ProviderReviewerFinder reviewers={reviewerDirectory} sentRequests={sentReviewerRequests} providerInterests={userInterests} />
          </>
        ) : null}

        {currentSection === "home" && !isProvider ? (
          <>
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

            {showWelcomeActivation ? (
              <section className="overflow-hidden rounded-[1.9rem] border border-[#f2d2c0] bg-[linear-gradient(135deg,#fff3eb_0%,#fffaf6_48%,#ffffff_100%)] p-5 shadow-[0_24px_60px_rgba(220,79,31,0.08)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#dc4f1f]">Bienvenido</p>
                    <h2 className="mt-2 text-2xl font-bold text-[#131316]">Ya eres parte de la familia Amazona Review</h2>
                    <p className="mt-3 text-sm text-[#62626d]">
                      Felicidades por activar tu acceso. Desde ahora compartiremos contigo proveedores confiables y tu perfil quedara visible para que proveedores compatibles puedan encontrarte y contactarte.
                    </p>
                  </div>
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ff6b35] text-white shadow-[0_18px_36px_rgba(255,107,53,0.22)]">
                    <Sparkles className="h-5 w-5" />
                  </span>
                </div>

                <div className="mt-5 grid gap-3">
                  <article className="rounded-[1.4rem] border border-white/70 bg-white/88 p-4">
                    <p className="text-sm font-semibold text-[#131316]">Proveedores confiables</p>
                    <p className="mt-1 text-sm text-[#62626d]">Te mostraremos oportunidades y contactos seleccionados para que avances con mas confianza.</p>
                  </article>
                  <article className="rounded-[1.4rem] border border-white/70 bg-white/88 p-4">
                    <p className="text-sm font-semibold text-[#131316]">Tu perfil ya esta visible</p>
                    <p className="mt-1 text-sm text-[#62626d]">Los proveedores podran encontrarte segun tus categorias, pais y disponibilidad para colaborar.</p>
                  </article>
                  <article className="rounded-[1.4rem] border border-white/70 bg-white/88 p-4">
                    <p className="text-sm font-semibold text-[#131316]">Mensajeria centralizada</p>
                    <p className="mt-1 text-sm text-[#62626d]">Tus solicitudes y conversaciones viven en el icono de mensajes para que el inicio se mantenga limpio.</p>
                  </article>
                </div>
              </section>
            ) : null}

            {membershipStatus !== "active" ? (
              <section className="rounded-[1.8rem] border border-[#f0d7ca] bg-[linear-gradient(180deg,#fff7f3_0%,#ffffff_100%)] p-5">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ff6b35] text-white">
                    <WalletCards className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="font-bold">Activar membresia</h2>
                    <p className="text-sm text-[#62626d]">Paso 1 del recorrido</p>
                  </div>
                </div>
                {PAYMENT_TEST_MODE ? (
                  <>
                    <p className="mt-4 text-sm text-[#62626d]">
                      Square esta deshabilitado durante pruebas. Puedes marcar manualmente tu acceso para seguir validando el flujo.
                    </p>
                    <TestingAccessControls stage="payment" />
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-[#62626d]">Usa Square para pagar tu acceso. Cuando Square confirme el pago, tu membresia se activara automaticamente.</p>
                    {squareStatus === "processing" ? (
                      <p className="mt-3 rounded-2xl border border-[#f6d1c0] bg-[#fff4ed] px-4 py-3 text-sm font-semibold text-[#c64b1e]">
                        Regresaste desde Square. Estamos validando tu pago y activaremos tu membresia en cuanto llegue el webhook.
                      </p>
                    ) : null}
                    {squareError ? (
                      <p className="mt-3 rounded-2xl border border-[#f2d7d7] bg-[#fff7f7] px-4 py-3 text-sm font-semibold text-red-600">{squareError}</p>
                    ) : null}
                    <a href="/api/square/checkout" className="btn-primary mt-3">
                      Pagar con Square
                    </a>
                  </>
                )}
              </section>
            ) : null}

            {membershipStatus === "active" && kycStatus !== "approved" ? (
              <section className="rounded-[1.8rem] border border-[#dfe9df] bg-[linear-gradient(180deg,#f8fff8_0%,#ffffff_100%)] p-5">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1f7a4d] text-white">
                    <LockKeyhole className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="font-bold">Verificacion de ID</h2>
                    <p className="text-sm text-[#62626d]">Paso 2 del recorrido</p>
                  </div>
                </div>
                {KYC_TEST_MODE ? (
                  <>
                    <p className="mt-4 text-sm text-[#62626d]">
                      La verificacion de ID real tambien esta pausada en pruebas. Puedes aprobarla o reiniciarla manualmente para validar el recorrido.
                    </p>
                    <TestingAccessControls stage="kyc" />
                  </>
                ) : (
                  <p className="mt-1 text-sm text-[#62626d]">
                    Tu membresia esta activa. Ahora toca tu verificacion de identidad. El admin te contactara para completar el proceso.
                  </p>
                )}
              </section>
            ) : null}
          </>
        ) : null}

        {currentSection === "contacts" && !isProvider ? (
          canSeeContacts ? (
            <section className="rounded-[1.8rem] border border-[#e6ddd1] bg-white p-5 shadow-[0_18px_36px_rgba(22,18,14,0.04)]">
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
          ) : (
            <section className="overflow-hidden rounded-[1.9rem] border border-[#f1d6c8] bg-[linear-gradient(135deg,#fff6f0_0%,#fffdf9_100%)] p-5 shadow-[0_18px_36px_rgba(22,18,14,0.04)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#dc4f1f]">Acceso bloqueado</p>
                  <h2 className="mt-2 text-2xl font-bold text-[#131316]">Debes activar tu acceso antes de ver contactos</h2>
                  <p className="mt-3 text-sm text-[#62626d]">
                    Completa el pago con Square y tu verificacion de ID para desbloquear los contactos de proveedores confiables.
                  </p>
                </div>
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ff6b35] text-white">
                  <LockKeyhole className="h-5 w-5" />
                </span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <article className="rounded-[1.4rem] border border-white/70 bg-white/90 p-4">
                  <p className="text-sm font-semibold text-[#131316]">1. Pago activo</p>
                  <p className="mt-1 text-sm text-[#62626d]">Estado actual: {membershipStatus}</p>
                </article>
                <article className="rounded-[1.4rem] border border-white/70 bg-white/90 p-4">
                  <p className="text-sm font-semibold text-[#131316]">2. Verificacion de ID</p>
                  <p className="mt-1 text-sm text-[#62626d]">Estado actual: {kycStatus}</p>
                </article>
              </div>
              <Link href="/dashboard" className="btn-primary mt-5 inline-flex">
                Volver al inicio
              </Link>
            </section>
          )
        ) : null}

        {currentSection === "messages" ? (
          <>
            <section className="rounded-[1.8rem] border border-[#e6ddd1] bg-white p-5 shadow-[0_18px_36px_rgba(22,18,14,0.04)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#dc4f1f]">Mensajeria</p>
                  <h2 className="mt-2 text-2xl font-bold text-[#131316]">{isProvider ? "Tus conversaciones y ofertas" : "Tus solicitudes y conversaciones"}</h2>
                  <p className="mt-2 text-sm text-[#62626d]">
                    {isProvider
                      ? "Cuando un reviewer acepte una oferta, la conversacion seguira aqui. Si la rechaza, no le mostraremos ese rechazo al provider."
                      : "Aqui ves solicitudes nuevas y tus conversaciones activas. Si rechazas una solicitud, el provider no recibira una notificacion de rechazo."}
                  </p>
                </div>
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff3ec] text-[#dc4f1f]">
                  <MessageCircleMore className="h-5 w-5" />
                </span>
              </div>
              <div className={`mt-5 grid gap-3 ${isProvider ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                {(isProvider
                  ? [
                      { label: "Ofertas activas", value: providerRequestStats.active },
                      { label: "Aceptadas", value: providerRequestStats.accepted },
                      { label: "Conversaciones", value: providerRequestStats.conversations },
                    ]
                  : [
                      { label: "Solicitudes nuevas", value: reviewerMessageStats.requests },
                      { label: "Conversaciones", value: reviewerMessageStats.conversations },
                    ]
                ).map((item) => (
                  <article key={item.label} className="rounded-[1.35rem] border border-[#efe4d9] bg-[#fffaf6] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8f857b]">{item.label}</p>
                    <p className="mt-2 text-3xl font-bold text-[#131316]">{item.value}</p>
                  </article>
                ))}
              </div>
            </section>

            {!isProvider ? <ReviewerOpportunities opportunities={reviewerOpportunities} /> : null}

            <CollaborationInbox
              currentUserId={user.id}
              title="Conversaciones activas"
              description={
                isProvider
                  ? "Responde desde aqui y comparte imagenes cuando una colaboracion ya fue aceptada."
                  : "Cuando aceptes una solicitud, la conversacion privada aparecera aqui para seguir hablando y compartir imagenes."
              }
              emptyTitle="Todavia no tienes conversaciones activas"
              emptyDescription={
                isProvider
                  ? "Cuando un reviewer acepte una de tus ofertas, la conversacion aparecera aqui."
                  : "Acepta una solicitud de colaboracion y se abrira aqui una ventana de mensajeria entre ustedes."
              }
              threads={collaborationThreads}
            />
          </>
        ) : null}
      </main>
    </div>
  );
}
