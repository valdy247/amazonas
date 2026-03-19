import Link from "next/link";
import { redirect } from "next/navigation";
import { LockKeyhole, Sparkles, WalletCards } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasAdminAccess } from "@/lib/admin";
import { ProviderReviewerFinder } from "@/components/provider-reviewer-finder";
import { ProviderCampaignStudio } from "@/components/provider-campaign-studio";
import { CollaborationInbox } from "@/components/collaboration-inbox";
import { SupportCenter } from "@/components/support-center";
import { TestingAccessControls } from "@/components/testing-access-controls";
import { ProviderContactGrid } from "@/components/provider-contact-grid";
import { ReviewerReferralCard } from "@/components/reviewer-referral-card";
import { getInterestLabel, normalizeInterestKeys, normalizeUserRole } from "@/lib/onboarding";
import { getReviewerContactMethods, mergeProfileData, type ReviewerAvailability } from "@/lib/profile-data";
import { normalizeContactRequestData } from "@/lib/contact-requests";
import { buildContactMethodsFromFields, getComparableContactMethods } from "@/lib/provider-contact";
import { dashboardCopy, normalizeLanguage, type AppLanguage } from "@/lib/i18n";
import { formatMembershipDate, getMembershipMeta, membershipHasAccess, normalizeMembershipStatus } from "@/lib/membership";
import { reconcileMembershipFromSquare } from "@/lib/square-membership";
import {
  buildReferralLink,
  ensureReferralCode,
  getMonthlyRewardedReferralCount,
  getProviderAccessLimit,
  isVerifiedReviewerReferrer,
  sortItemsForViewer,
  syncReferralQualification,
} from "@/lib/referrals";

type ProviderContact = {
  id: string;
  title: string;
  network: string | null;
  url: string;
  notes: string | null;
  is_verified: boolean;
  avatar_data_url?: string | null;
  email?: string | null;
  contact_methods?: string | null;
  source?: "admin" | "registered";
  source_label?: string | null;
  history_id?: number | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string | null;
  email?: string | null;
  phone?: string | null;
  preferred_language?: AppLanguage | null;
  accepted_terms_at?: string | null;
  created_at?: string | null;
  profile_data?: unknown;
  referral_code?: string | null;
  referred_by_user_id?: string | null;
  referred_by_code?: string | null;
  email_confirmed_at?: string | null;
  referral_qualified_at?: string | null;
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
  source_language?: AppLanguage | null;
  translations?: Record<string, string> | null;
  created_at: string;
  image_url?: string | null;
  image_path?: string | null;
};

type SupportThreadRow = {
  id: number;
  user_id: string;
  category: string;
  subject: string;
  status: string;
  priority: string;
  last_activity_at: string;
  assigned_admin_id?: string | null;
};

type SupportMessageRow = {
  id: number;
  thread_id: number;
  sender_id: string;
  body: string;
  created_at: string;
};

type ConversationThread = {
  requestId: number;
  counterpartId: string;
  counterpartName: string;
  counterpartCountry: string;
  counterpartInterests: string[];
  requestData?: Record<string, unknown> | null;
  requestMeta?: {
    category: string;
    productName: string;
    note: string;
  };
  messages: Array<{
    id: number;
    senderId: string;
    body: string;
    sourceLanguage: AppLanguage;
    translations?: Record<string, string> | null;
    createdAt: string;
    imageUrl?: string | null;
    imagePath?: string | null;
  }>;
  lastActivityAt: string;
};

type ProviderSnapshot = {
  fullName?: string;
  country?: string;
  interests?: string[];
};

const PAYMENT_TEST_MODE = false;
const KYC_TEST_MODE = false;

function normalizeComparable(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function getProviderSnapshot(value: unknown): ProviderSnapshot | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const snapshot = (value as { providerSnapshot?: unknown }).providerSnapshot;
  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }

  return {
    fullName: typeof (snapshot as { fullName?: unknown }).fullName === "string" ? (snapshot as { fullName: string }).fullName : undefined,
    country: typeof (snapshot as { country?: unknown }).country === "string" ? (snapshot as { country: string }).country : undefined,
    interests: Array.isArray((snapshot as { interests?: unknown }).interests)
      ? ((snapshot as { interests: unknown[] }).interests).filter((item): item is string => typeof item === "string")
      : undefined,
  };
}

function getLastSeenMessageIdForRole(requestData: Record<string, unknown> | null | undefined, role: "provider" | "reviewer") {
  if (!requestData) {
    return 0;
  }

  const value = requestData[role === "provider" ? "providerLastSeenMessageId" : "reviewerLastSeenMessageId"];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getLastIncomingMessageId(messages: ConversationThread["messages"], currentUserId: string) {
  const incomingMessage = [...messages].reverse().find((message) => message.senderId !== currentUserId);
  return incomingMessage?.id || 0;
}

function formatProviderAlias(aliasNumber: number) {
  return `Proveedor ${aliasNumber}`;
}

function getStableMatchAdjustment(seed: string) {
  const normalizedSeed = seed.trim();
  let hash = 0;

  for (let index = 0; index < normalizedSeed.length; index += 1) {
    hash = (hash * 31 + normalizedSeed.charCodeAt(index)) | 0;
  }

  const magnitude = 3 + (Math.abs(hash) % 3);
  const sign = Math.abs(hash >> 3) % 2 === 0 ? 1 : -1;

  return magnitude * sign;
}

function getRegisteredProviderComparableFields(provider: ProfileRow) {
  const providerProfileData = mergeProfileData(provider.profile_data);
  const contactMethods = buildContactMethodsFromFields({
    whatsapp: providerProfileData.contact.whatsapp || provider.phone || "",
    instagram: providerProfileData.contact.instagram,
    messenger: providerProfileData.contact.messenger,
  });

  return {
    profileData: providerProfileData,
    contactMethods,
    comparableContacts: getComparableContactMethods(contactMethods),
    comparableEmail: normalizeComparable(provider.email),
  };
}

function shouldMergeProviderContacts(
  manualContact: Pick<ProviderContact, "contact_methods" | "url" | "network" | "email">,
  registeredProvider: { comparableContacts: string[]; comparableEmail: string }
) {
  const manualContacts = getComparableContactMethods(
    manualContact.contact_methods,
    manualContact.url,
    manualContact.network
  );
  const manualEmail = normalizeComparable(manualContact.email);

  return (
    manualContacts.some((value) => registeredProvider.comparableContacts.includes(value)) ||
    (Boolean(manualEmail) && manualEmail === registeredProvider.comparableEmail)
  );
}

function buildProviderAliasMaps(input: {
  manualContacts: Array<{ history_id?: number | null }>;
  registeredProviders: ProfileRow[];
}) {
  const manualAliasMap = new Map<number, string>();
  const registeredAliasMap = new Map<string, string>();

  const manualIds = Array.from(
    new Set(
      input.manualContacts
        .map((contact) => contact.history_id)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    )
  ).sort((left, right) => left - right);

  manualIds.forEach((manualId, index) => {
    manualAliasMap.set(manualId, formatProviderAlias(101 + index));
  });

  const orderedRegisteredProviders = [...input.registeredProviders].sort((left, right) => {
    const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0;
    const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0;

    return leftTime - rightTime || left.id.localeCompare(right.id);
  });

  orderedRegisteredProviders.forEach((provider, index) => {
    registeredAliasMap.set(provider.id, formatProviderAlias(101 + manualIds.length + index));
  });

  return {
    manualAliasMap,
    registeredAliasMap,
  };
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
    .select("full_name, role, email, preferred_language, profile_data, referral_code, referred_by_user_id, referred_by_code, email_confirmed_at, referral_qualified_at")
    .eq("id", user.id)
    .single();

  const profile = withProfileData.error
    ? (
        await supabase
          .from("profiles")
          .select("full_name, role, email, preferred_language, referral_code, referred_by_user_id, referred_by_code, email_confirmed_at, referral_qualified_at")
          .eq("id", user.id)
          .single()
      ).data
    : withProfileData.data;

  if (!profile?.role || profile.role === "pending") {
    redirect("/onboarding");
  }

  const rawRole = profile.role;
  const role = normalizeUserRole(profile.role);
  const firstName = String(profile.full_name || "miembro").trim().split(/\s+/)[0] || "miembro";
  const metadata = (user.user_metadata || {}) as Record<string, unknown>;
  const userMetadataInterests = normalizeInterestKeys(metadata.interests);
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

  const userInterests = normalizeInterestKeys(profileData.interests);
  const profileNote = profileData.note;
  const country = profileData.country || null;
  const testingMembershipStatus = typeof metadata.testing_payment_state === "string" ? metadata.testing_payment_state : null;
  const testingKycStatus = typeof metadata.testing_kyc_state === "string" ? metadata.testing_kyc_state : null;
  const isAdmin = hasAdminAccess(profile?.role, profile?.email || user.email);
  const isProvider = role === "provider";
  const currentUserLanguage = normalizeLanguage((profile as ProfileRow | null)?.preferred_language || metadata.preferred_language);
  const reviewerQuickReplies =
    currentUserLanguage === "en"
      ? ["Hi, I am a reviewer and I would love to collaborate with you.", "Hi, what kind of products do you offer?"]
      : ["Hola, soy reseñadora y me gustaría colaborar con usted.", "Hola, ¿qué tipo de productos ofreces?"];
  const copy = dashboardCopy[currentUserLanguage];
  const admin = createAdminClient();
  const authEmailConfirmedAt = (user as { email_confirmed_at?: string | null }).email_confirmed_at || null;

  if (authEmailConfirmedAt && !(profile as ProfileRow | null)?.email_confirmed_at) {
    await admin.from("profiles").update({ email_confirmed_at: authEmailConfirmedAt }).eq("id", user.id).is("email_confirmed_at", null);
    if (profile) {
      (profile as ProfileRow).email_confirmed_at = authEmailConfirmedAt;
    }
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("status, paid_at, current_period_end_at, canceled_at, last_payment_failed_at, square_customer_id, square_order_id, square_subscription_id, last_square_event_type, last_square_event_at")
    .eq("user_id", user.id)
    .single();
  const { data: kyc } = await supabase.from("kyc_checks").select("status, review_note").eq("user_id", user.id).single();

  let membershipState = membership || null;
  if (!PAYMENT_TEST_MODE && membershipState && normalizeMembershipStatus(membershipState.status) === "payment_processing") {
    const admin = createAdminClient();
    const reconciliation = await reconcileMembershipFromSquare({
      admin,
      userId: user.id,
      membership: membershipState,
    }).catch(() => null);

    if (reconciliation?.updated && reconciliation.nextMembership) {
      membershipState = {
        ...membershipState,
        ...reconciliation.nextMembership,
      };
    }
  }

  const membershipStatus =
    PAYMENT_TEST_MODE && testingMembershipStatus ? testingMembershipStatus : membershipState?.status || "pending_payment";
  const kycStatus = KYC_TEST_MODE && testingKycStatus ? testingKycStatus : kyc?.status || "pending";
  const kycReviewNote = typeof kyc?.review_note === "string" ? kyc.review_note : null;
  const isManualNameReview =
    kycStatus === "in_review" &&
    Boolean(kycReviewNote && kycReviewNote.toLowerCase().includes("nombre verificado"));
  const membershipMeta = getMembershipMeta(membershipStatus, currentUserLanguage);
  const membershipPeriodEnd = formatMembershipDate(membershipState?.current_period_end_at, currentUserLanguage);
  const membershipCanceledAt = formatMembershipDate(membershipState?.canceled_at, currentUserLanguage);
  const lastPaymentFailedAt = formatMembershipDate(membershipState?.last_payment_failed_at, currentUserLanguage);
  const hasMembershipAccess = isAdmin || membershipHasAccess(membershipState);
  const canSeeContacts = isAdmin || (!isProvider && hasMembershipAccess && kycStatus === "approved");
  const canUseReferralProgram = rawRole === "reviewer" || rawRole === "tester" || rawRole === "admin";
  const referralCode = canUseReferralProgram ? await ensureReferralCode(user.id, (profile as ProfileRow | null)?.referral_code) : null;
  const referralQualifiedAt = canUseReferralProgram
    ? await syncReferralQualification({
        userId: user.id,
        role: rawRole,
        emailConfirmedAt: (profile as ProfileRow | null)?.email_confirmed_at || authEmailConfirmedAt,
        referredByUserId: (profile as ProfileRow | null)?.referred_by_user_id || null,
        referralQualifiedAt: (profile as ProfileRow | null)?.referral_qualified_at || null,
        membership: membershipState,
        kycStatus,
      })
    : null;
  if (canUseReferralProgram && referralQualifiedAt && profile) {
    (profile as ProfileRow).referral_qualified_at = referralQualifiedAt;
  }
  const squareStatus = typeof resolvedSearchParams.square === "string" ? resolvedSearchParams.square : null;
  const squareError = typeof resolvedSearchParams.square_error === "string" ? resolvedSearchParams.square_error : null;
  const veriffStatus = typeof resolvedSearchParams.veriff === "string" ? resolvedSearchParams.veriff : null;
  const veriffError = typeof resolvedSearchParams.veriff_error === "string" ? resolvedSearchParams.veriff_error : null;
  const requestedThreadId =
    typeof resolvedSearchParams.thread === "string" && Number.isFinite(Number(resolvedSearchParams.thread))
      ? Number(resolvedSearchParams.thread)
      : null;
  const requestedSection = typeof resolvedSearchParams.section === "string" ? resolvedSearchParams.section : "home";
  const currentSection = isProvider
    ? requestedSection === "messages" || requestedSection === "reviewers" || requestedSection === "support"
      ? requestedSection
      : "home"
    : requestedSection === "messages" || requestedSection === "contacts" || requestedSection === "support"
      ? requestedSection
      : "home";
  const showWelcomeActivation = !isProvider && canSeeContacts;

  let contacts: ProviderContact[] = [];
  let contactedIds: string[] = [];
  let reviewerDirectory: Array<{
    id: string;
    fullName: string;
    firstName: string;
    country: string;
    experienceLevel: "new" | "growing" | "advanced";
    interestKeys: string[];
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
  let collaborationThreads: ConversationThread[] = [];
  let supportThreads: Array<{
    id: number;
    userId: string;
    userName: string;
    userEmail: string;
    subject: string;
    category: string;
    status: string;
    priority: string;
    lastActivityAt: string;
    assignedAdminId?: string | null;
    assignedAdminName?: string | null;
    messages: Array<{
      id: number;
      senderId: string;
      senderName: string;
      body: string;
      createdAt: string;
    }>;
  }> = [];
  let allRegisteredProviderProfiles: ProfileRow[] = [];
  let providerAliasByManualId = new Map<number, string>();
  let providerAliasByRegisteredId = new Map<string, string>();
  let referralProfiles: ProfileRow[] = [];
  let rewardedReferralsThisMonth = 0;
  let totalQualifiedReferrals = 0;
  let providerAccessLimit = 100;

  if (isProvider) {
    const [{ count: manualContactCount }, registeredProvidersResult] = await Promise.all([
      supabase.from("provider_contacts").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabase
        .from("profiles")
        .select("id, created_at")
        .eq("role", "provider")
        .not("accepted_terms_at", "is", null),
    ]);

    allRegisteredProviderProfiles = (registeredProvidersResult.data || []) as ProfileRow[];

    const orderedRegisteredProviders = [...allRegisteredProviderProfiles].sort((left, right) => {
      const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0;
      const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0;

      return leftTime - rightTime || left.id.localeCompare(right.id);
    });

    orderedRegisteredProviders.forEach((provider, index) => {
      providerAliasByRegisteredId.set(provider.id, formatProviderAlias(101 + (manualContactCount || 0) + index));
    });
  }

  if (!isProvider) {
    const registeredProvidersResult = await supabase
      .from("profiles")
      .select("id, full_name, email, accepted_terms_at, profile_data, phone, created_at")
      .eq("role", "provider")
      .not("accepted_terms_at", "is", null);

    allRegisteredProviderProfiles = (registeredProvidersResult.data || []) as ProfileRow[];
  }

  const greetingName = isProvider
    ? providerAliasByRegisteredId.get(user.id) || "Proveedor"
    : firstName;

  if (canUseReferralProgram) {
    const referredProfilesResult = await admin
      .from("profiles")
      .select("id, referred_by_user_id, referral_qualified_at")
      .eq("referred_by_user_id", user.id);

    referralProfiles = (referredProfilesResult.data || []) as ProfileRow[];
    rewardedReferralsThisMonth = getMonthlyRewardedReferralCount(referralProfiles, user.id);
    totalQualifiedReferrals = referralProfiles.filter((item) => Boolean(item.referral_qualified_at)).length;
    providerAccessLimit = getProviderAccessLimit(rewardedReferralsThisMonth);
  }

  if (canSeeContacts) {
      const withMethods = await supabase
      .from("provider_contacts")
      .select("id, title, email, network, url, notes, is_verified, avatar_data_url, contact_methods")
      .eq("is_active", true);

    if (withMethods.error) {
        const withVerification = await supabase
        .from("provider_contacts")
        .select("id, title, network, url, notes, is_verified, avatar_data_url")
        .eq("is_active", true);

      if (withVerification.error) {
        const fallback = await supabase.from("provider_contacts").select("id, title, network, url, notes").eq("is_active", true);
        contacts = (fallback.data || []).map((contact) => ({
          ...contact,
          id: `admin:${contact.id}`,
          email: null,
          is_verified: false,
          avatar_data_url: null,
          contact_methods: null,
          history_id: contact.id,
          source: "admin",
          source_label: "Equipo",
        })) as ProviderContact[];
      } else {
        contacts = (withVerification.data || []).map((contact) => ({
            ...contact,
            email: null,
            id: `admin:${contact.id}`,
            avatar_data_url: contact.avatar_data_url || null,
            contact_methods: null,
          history_id: contact.id,
          source: "admin",
          source_label: "Equipo",
        })) as ProviderContact[];
      }
    } else {
      contacts = ((withMethods.data || []) as Array<Omit<ProviderContact, "id"> & { id: number }>).map((contact) => ({
        ...contact,
        id: `admin:${contact.id}`,
        history_id: contact.id,
        source: "admin",
        source_label: "Equipo",
      }));
    }

    const contactIds = contacts.map((contact) => contact.history_id).filter((value): value is number => Number.isFinite(value));
    if (contactIds.length) {
      const { data: contactHistory } = await supabase
        .from("reviewer_contact_history")
        .select("provider_contact_id")
        .eq("reviewer_id", user.id)
        .in("provider_contact_id", contactIds);

      contactedIds = (contactHistory || [])
        .map((row) => Number(row.provider_contact_id))
        .filter((value) => Number.isFinite(value))
        .map((value) => `admin:${value}`);
    }

    const manualContacts = [...contacts];
    const matchedManualContactIds = new Set<string>();
    const registeredProviders = allRegisteredProviderProfiles
      .map((provider) => {
        const providerFields = getRegisteredProviderComparableFields(provider);
        const providerProfileData = providerFields.profileData;
        const contactMethods = providerFields.contactMethods;
        const primaryMethod = getReviewerContactMethods(providerProfileData)[0];
        const primaryFallback = providerProfileData.contact.whatsapp || provider.phone || "";

        if (!providerProfileData.publicProfile || !contactMethods || (!providerProfileData.allowsDirectContact && !primaryFallback)) {
          return null;
        }

        const matchedManualContact = manualContacts.find((contact) => {
          const matches = shouldMergeProviderContacts(contact, providerFields);
          if (matches) {
            matchedManualContactIds.add(contact.id);
          }
          return matches;
        });

        return {
          id: `registered:${provider.id}`,
          title: providerAliasByRegisteredId.get(provider.id) || "Proveedor",
          network: providerProfileData.country || matchedManualContact?.network || "Registered on Verifyzon",
          url: primaryMethod?.value || primaryFallback || matchedManualContact?.url || "",
          notes: providerProfileData.note || matchedManualContact?.notes || null,
          is_verified: matchedManualContact?.is_verified || false,
          avatar_data_url: matchedManualContact?.avatar_data_url || null,
          email: provider.email || matchedManualContact?.email || null,
          contact_methods: matchedManualContact?.contact_methods || contactMethods,
          source: "registered" as const,
          source_label: matchedManualContact?.is_verified ? "Verificado" : "Registrado",
          history_id: null,
        };
      })
      .filter(Boolean) as ProviderContact[];

    contacts = [...manualContacts.filter((contact) => !matchedManualContactIds.has(contact.id)), ...registeredProviders].sort((left, right) => {
      if (left.is_verified !== right.is_verified) {
        return Number(right.is_verified) - Number(left.is_verified);
      }

      if ((left.source === "admin") !== (right.source === "admin")) {
        return left.source === "admin" ? -1 : 1;
      }

      return left.title.localeCompare(right.title);
    });
  }

  if (!isProvider) {
    const aliasMaps = buildProviderAliasMaps({
      manualContacts: contacts,
      registeredProviders: allRegisteredProviderProfiles,
    });
    providerAliasByManualId = aliasMaps.manualAliasMap;
    providerAliasByRegisteredId = aliasMaps.registeredAliasMap;

    contacts = contacts.map((contact) => {
      if (contact.source === "registered") {
        const registeredId = contact.id.replace("registered:", "");
        return {
          ...contact,
          title: providerAliasByRegisteredId.get(registeredId) || contact.title,
        };
      }

      if (contact.history_id) {
        return {
          ...contact,
          title: providerAliasByManualId.get(contact.history_id) || contact.title,
        };
      }

      return contact;
    });

    const registeredContacts = contacts.filter((contact) => contact.source === "registered");
    const directoryContacts = contacts.filter((contact) => contact.source !== "registered");
    const randomizedDirectoryContacts = sortItemsForViewer(directoryContacts, user.id);
    const selectedIds = new Set([
      ...registeredContacts.map((contact) => contact.id),
      ...randomizedDirectoryContacts.slice(0, providerAccessLimit).map((contact) => contact.id),
    ]);
    contactedIds.forEach((contactId) => selectedIds.add(contactId));
    contacts = [...registeredContacts, ...randomizedDirectoryContacts].filter((contact) => selectedIds.has(contact.id));
    contactedIds = contactedIds.filter((contactId) => selectedIds.has(contactId));
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
        const reviewerInterests = normalizeInterestKeys(reviewerData.interests);
        const overlap = reviewerInterests.filter((interest) => userInterests.includes(interest)).length;
        const categoryWeight = userInterests.length ? (overlap / userInterests.length) * 70 : 35;
        const countryWeight =
          normalizeComparable(reviewerData.country) && normalizeComparable(reviewerData.country) === normalizeComparable(country) ? 20 : 0;
        const availabilityWeight = reviewerData.availability === "open" ? 10 : 6;
        const baseMatchPercent = Math.round(categoryWeight + countryWeight + availabilityWeight);
        const adjustedMatchPercent = baseMatchPercent + getStableMatchAdjustment(row.id);
        const matchPercent = Math.max(1, Math.min(100, adjustedMatchPercent));

        return {
          id: row.id,
          fullName: row.full_name || "Reviewer sin nombre",
          firstName: String(row.full_name || "reviewer").trim().split(/\s+/)[0] || "reviewer",
          country: reviewerData.country,
          experienceLevel: reviewerData.experienceLevel,
          interestKeys: reviewerInterests,
          interests: reviewerInterests.map((interest) => getInterestLabel(interest, currentUserLanguage)),
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

    const conversationRequestsResult = await supabase
      .from("reviewer_contact_requests")
      .select("id, reviewer_id, updated_at, last_activity_at, request_data, status, created_at")
      .eq("provider_id", user.id)
      .neq("status", "declined");

    const conversationRequests = (conversationRequestsResult.data || []) as Array<{
      id: number;
      reviewer_id: string;
      updated_at?: string;
      last_activity_at?: string;
      request_data?: unknown;
      status?: string;
      created_at?: string;
    }>;
    const acceptedRequestIds = conversationRequests.map((item) => item.id);

    if (acceptedRequestIds.length) {
      const { data: messageRows } = await supabase
        .from("request_messages")
        .select("id, request_id, sender_id, body, source_language, translations, created_at, image_url, image_path")
        .in("request_id", acceptedRequestIds)
        .order("created_at", { ascending: true });

      const messagesByRequest = new Map<number, MessageRow[]>();
      ((messageRows || []) as MessageRow[]).forEach((message) => {
        messagesByRequest.set(message.request_id, [...(messagesByRequest.get(message.request_id) || []), message]);
      });

      collaborationThreads = conversationRequests.map((request) => {
        const reviewer = reviewerDirectory.find((item) => item.id === request.reviewer_id);
        return {
          requestId: request.id,
          counterpartId: request.reviewer_id,
          counterpartName: reviewer?.fullName || "Reviewer",
          counterpartCountry: reviewer?.country || "",
          counterpartInterests: reviewer?.interests || [],
          requestData: request.request_data && typeof request.request_data === "object" ? (request.request_data as Record<string, unknown>) : null,
          requestMeta: normalizeContactRequestData(request.request_data),
          messages: (messagesByRequest.get(request.id) || []).map((message) => ({
            id: message.id,
            senderId: message.sender_id,
            body: message.body,
            sourceLanguage: normalizeLanguage(message.source_language),
            translations: message.translations || null,
            createdAt: message.created_at,
            imageUrl: message.image_url || null,
            imagePath: message.image_path || null,
          })),
          lastActivityAt: request.last_activity_at || request.updated_at || request.created_at || new Date(0).toISOString(),
        };
      });
    }
  }

  const { data: supportThreadRows } = await supabase
    .from("support_threads")
    .select("id, user_id, category, subject, status, priority, last_activity_at, assigned_admin_id")
    .eq("user_id", user.id)
    .order("last_activity_at", { ascending: false });

  if ((supportThreadRows || []).length) {
    const supportIds = (supportThreadRows as SupportThreadRow[]).map((row) => row.id);
    const { data: supportMessageRows } = await supabase
      .from("support_messages")
      .select("id, thread_id, sender_id, body, created_at")
      .in("thread_id", supportIds)
      .order("created_at", { ascending: true });

    supportThreads = (supportThreadRows as SupportThreadRow[]).map((thread) => ({
      id: thread.id,
      userId: thread.user_id,
      userName: firstName,
      userEmail: profile?.email || user.email || "",
      subject: thread.subject,
      category: thread.category,
      status: thread.status,
      priority: thread.priority || "normal",
      lastActivityAt: thread.last_activity_at,
      assignedAdminId: thread.assigned_admin_id || null,
      assignedAdminName: thread.assigned_admin_id ? "Soporte" : null,
      messages: ((supportMessageRows || []) as SupportMessageRow[])
        .filter((message) => message.thread_id === thread.id)
        .map((message) => ({
          id: message.id,
          senderId: message.sender_id,
          senderName: message.sender_id === user.id ? firstName : currentUserLanguage === "en" ? "Support" : "Soporte",
          body: message.body,
          createdAt: message.created_at,
        })),
    }));
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
      const providerProfiles = allRegisteredProviderProfiles.filter((item) => providerIds.includes(item.id));

      providerProfiles.forEach((item) => {
        providerMap.set(item.id, {
          fullName: providerAliasByRegisteredId.get(item.id) || "Proveedor",
          profileData: mergeProfileData(item.profile_data),
        });
      });

    }

    const conversationRequests = requests.filter((item) => item.status !== "declined");
    const acceptedRequestIds = conversationRequests.map((item) => item.id);

    if (acceptedRequestIds.length) {
      const { data: messageRows } = await supabase
        .from("request_messages")
        .select("id, request_id, sender_id, body, source_language, translations, created_at, image_url, image_path")
        .in("request_id", acceptedRequestIds)
        .order("created_at", { ascending: true });

      const messagesByRequest = new Map<number, MessageRow[]>();
      ((messageRows || []) as MessageRow[]).forEach((message) => {
        messagesByRequest.set(message.request_id, [...(messagesByRequest.get(message.request_id) || []), message]);
      });

      collaborationThreads = conversationRequests.map((request) => {
        const snapshot = getProviderSnapshot(request.request_data);
        return {
          requestId: request.id,
          counterpartId: request.provider_id,
          counterpartName: providerMap.get(request.provider_id)?.fullName || snapshot?.fullName || "Proveedor",
          counterpartCountry: providerMap.get(request.provider_id)?.profileData.country || snapshot?.country || "",
          counterpartInterests: normalizeInterestKeys(providerMap.get(request.provider_id)?.profileData.interests || snapshot?.interests || []).map((interest) =>
            getInterestLabel(interest, currentUserLanguage)
          ),
          requestData: request.request_data && typeof request.request_data === "object" ? (request.request_data as Record<string, unknown>) : null,
          requestMeta: normalizeContactRequestData(request.request_data),
          messages: (messagesByRequest.get(request.id) || []).map((message) => ({
            id: message.id,
            senderId: message.sender_id,
            body: message.body,
            sourceLanguage: normalizeLanguage(message.source_language),
            translations: message.translations || null,
            createdAt: message.created_at,
            imageUrl: message.image_url || null,
            imagePath: message.image_path || null,
          })),
          lastActivityAt: request.last_activity_at || request.updated_at || request.created_at,
        };
      });
    }
  }

  const unreadConversationCount = collaborationThreads.filter((thread) => {
    const lastIncomingMessageId = getLastIncomingMessageId(thread.messages, user.id);
    const lastSeenMessageId = getLastSeenMessageIdForRole(thread.requestData, isProvider ? "provider" : "reviewer");
    return lastIncomingMessageId > lastSeenMessageId;
  }).length;
  const hasUnreadMessages = unreadConversationCount > 0;
  const menuItems = [
    { href: "/dashboard", label: copy.home },
    isProvider ? { href: "/dashboard?section=reviewers", label: currentUserLanguage === "en" ? "Find reviewers" : "Buscar reseñadores" } : null,
    !isProvider ? { href: "/dashboard?section=contacts", label: copy.providerContacts, locked: !canSeeContacts } : null,
    { href: "/dashboard?section=support", label: currentUserLanguage === "en" ? "Support" : "Soporte" },
    { href: "/profile", label: currentUserLanguage === "en" ? "Edit profile" : "Editar perfil" },
    isAdmin ? { href: "/admin", label: currentUserLanguage === "en" ? "Admin panel" : "Panel admin" } : null,
  ].filter(Boolean) as Array<{ href: string; label: string; locked?: boolean }>;
  const collaborationInboxKey = `${user.id}-${requestedThreadId || "none"}-${isProvider ? "provider" : "reviewer"}`;
  const referralLink = referralCode ? buildReferralLink(process.env.NEXT_PUBLIC_SITE_URL || "https://verifyzon.com", referralCode) : null;
  const reviewerCanEarnReferralRewards = isVerifiedReviewerReferrer({
    role: rawRole,
    membership: membershipState,
    kycStatus,
    emailConfirmedAt: (profile as ProfileRow | null)?.email_confirmed_at || authEmailConfirmedAt,
  });

  return (
    <div className="min-h-screen">
      <SiteHeader
        menuItems={menuItems}
        messageHref="/dashboard?section=messages"
        hasUnreadMessages={hasUnreadMessages}
        language={currentUserLanguage}
        unreadThreads={collaborationThreads.map((thread) => ({
          threadId: thread.requestId,
          lastIncomingMessageId: getLastIncomingMessageId(thread.messages, user.id),
          lastSeenMessageId: getLastSeenMessageIdForRole(thread.requestData, isProvider ? "provider" : "reviewer"),
        }))}
      />
      <main className="container-x space-y-4 py-6">
        {currentSection === "home" ? (
          <section className="overflow-hidden rounded-[1.8rem] border border-[#ffc4a8] bg-[linear-gradient(135deg,#ffb28b_0%,#ff8356_38%,#ff6b35_100%)] p-5 text-white shadow-[0_26px_80px_rgba(220,95,45,0.24)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="mt-2 text-3xl font-bold">{copy.greeting}, {greetingName}</h1>
                {!isProvider && referralCode ? (
                  <p className="mt-2 text-sm font-semibold text-white/82">
                    {currentUserLanguage === "en" ? "Referral code" : "Codigo de referido"}: {referralCode}
                  </p>
                ) : null}
              </div>
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/18 shadow-[0_12px_28px_rgba(255,255,255,0.16)]">
                <Sparkles className="h-5 w-5" />
              </span>
            </div>

            {profileNote ? <p className="mt-4 max-w-2xl text-sm text-white/82">{profileNote}</p> : null}
          </section>
        ) : null}
        {currentSection === "home" && isProvider ? (
          <>
            <ProviderCampaignStudio
              reviewers={reviewerDirectory.map((reviewer) => ({
                id: reviewer.id,
                fullName: reviewer.fullName,
                firstName: reviewer.firstName,
                interestKeys: reviewer.interestKeys,
                matchPercent: reviewer.matchPercent,
                isVerified: reviewer.isVerified,
              }))}
              providerInterests={userInterests}
              language={currentUserLanguage}
            />
          </>
        ) : null}

        {currentSection === "reviewers" && isProvider ? (
          <ProviderReviewerFinder
            reviewers={reviewerDirectory}
            sentRequests={sentReviewerRequests}
            providerInterests={userInterests}
            language={currentUserLanguage}
          />
        ) : null}

        {currentSection === "home" && !isProvider ? (
          <>
            {showWelcomeActivation ? (
              <section className="overflow-hidden rounded-[1.9rem] border border-[#f2d2c0] bg-[linear-gradient(135deg,#fff3eb_0%,#fffaf6_48%,#ffffff_100%)] p-5 shadow-[0_24px_60px_rgba(220,79,31,0.08)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#dc4f1f]">{copy.welcomeBadge}</p>
                    <h2 className="mt-2 text-2xl font-bold text-[#131316]">{copy.welcomeTitle}</h2>
                    <p className="mt-3 text-sm text-[#62626d]">{copy.welcomeBody}</p>
                  </div>
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ff6b35] text-white shadow-[0_18px_36px_rgba(255,107,53,0.22)]">
                    <Sparkles className="h-5 w-5" />
                  </span>
                </div>

                <div className="mt-5 grid gap-3">
                  <article className="rounded-[1.4rem] border border-white/70 bg-white/88 p-4">
                    <p className="text-sm font-semibold text-[#131316]">{copy.trustedProvidersTitle}</p>
                    <p className="mt-1 text-sm text-[#62626d]">{copy.trustedProvidersBody}</p>
                  </article>
                  <article className="rounded-[1.4rem] border border-white/70 bg-white/88 p-4">
                    <p className="text-sm font-semibold text-[#131316]">{copy.visibleProfileTitle}</p>
                    <p className="mt-1 text-sm text-[#62626d]">{copy.visibleProfileBody}</p>
                  </article>
                  <article className="rounded-[1.4rem] border border-white/70 bg-white/88 p-4">
                    <p className="text-sm font-semibold text-[#131316]">{copy.safeContactTitle}</p>
                    <p className="mt-1 text-sm text-[#62626d]">{copy.safeContactBody}</p>
                  </article>
                </div>
              </section>
            ) : null}

            {!isAdmin && hasMembershipAccess && (membershipStatus === "payment_failed" || membershipStatus === "canceled") ? (
              <section className="rounded-[1.6rem] border border-[#f1d6c8] bg-[#fff8f3] p-5">
                <p className="text-sm font-bold text-[#131316]">{membershipMeta.label}</p>
                <p className="mt-2 text-sm text-[#62564a]">{membershipMeta.detail}</p>
                {membershipPeriodEnd ? <p className="mt-2 text-sm text-[#62564a]">{copy.membershipPeriodEnds}: {membershipPeriodEnd}</p> : null}
                <a href="/api/square/checkout" className="btn-primary mt-4">
                  {copy.renewWithSquare}
                </a>
              </section>
            ) : null}

            {!isAdmin && !hasMembershipAccess ? (
              <section className="rounded-[1.8rem] border border-[#f0d7ca] bg-[linear-gradient(180deg,#fff7f3_0%,#ffffff_100%)] p-5">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ff6b35] text-white">
                    <WalletCards className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="font-bold">{copy.activateMembershipTitle}</h2>
                    <p className="text-sm text-[#62626d]">{copy.stepOne}</p>
                  </div>
                </div>
                {PAYMENT_TEST_MODE ? (
                  <>
                    <p className="mt-4 text-sm text-[#62626d]">{copy.squareTestingBody}</p>
                    <TestingAccessControls stage="payment" />
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-[#62626d]">
                      {membershipStatus === "payment_failed"
                        ? copy.squarePaymentFailedBody
                        : membershipStatus === "canceled"
                          ? copy.squareCanceledBody
                          : membershipStatus === "payment_processing"
                            ? copy.squareDelayedBody
                            : copy.squareBody}
                    </p>
                    {squareStatus === "processing" || membershipStatus === "payment_processing" ? (
                      <p className="mt-3 rounded-2xl border border-[#f6d1c0] bg-[#fff4ed] px-4 py-3 text-sm font-semibold text-[#c64b1e]">
                        {copy.squareProcessing}
                      </p>
                    ) : null}
                    <div className="mt-3 rounded-[1.2rem] border border-[#f1e3d9] bg-[#fffaf7] px-4 py-3 text-sm text-[#62564a]">
                      <p className="font-semibold text-[#131316]">{membershipMeta.label}</p>
                      <p className="mt-1">{membershipMeta.detail}</p>
                      {membershipPeriodEnd ? <p className="mt-2">{copy.membershipPeriodEnds}: {membershipPeriodEnd}</p> : null}
                      {membershipCanceledAt ? <p className="mt-1">{copy.membershipCanceledAt}: {membershipCanceledAt}</p> : null}
                      {lastPaymentFailedAt ? <p className="mt-1">{copy.paymentIssueDetectedAt}: {lastPaymentFailedAt}</p> : null}
                    </div>
                    {squareError ? (
                      <p className="mt-3 rounded-2xl border border-[#f2d7d7] bg-[#fff7f7] px-4 py-3 text-sm font-semibold text-red-600">{squareError}</p>
                    ) : null}
                    <a href="/api/square/checkout" className="btn-primary mt-3">
                      {membershipStatus === "pending_payment" || membershipStatus === "payment_processing" ? copy.payWithSquare : copy.renewWithSquare}
                    </a>
                  </>
                )}
              </section>
            ) : null}

            {!isAdmin && hasMembershipAccess && kycStatus !== "approved" ? (
              <section className="rounded-[1.8rem] border border-[#dfe9df] bg-[linear-gradient(180deg,#f8fff8_0%,#ffffff_100%)] p-5">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1f7a4d] text-white">
                    <LockKeyhole className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="font-bold">{copy.idVerificationTitle}</h2>
                    <p className="text-sm text-[#62626d]">{copy.stepTwo}</p>
                  </div>
                </div>
                {KYC_TEST_MODE ? (
                  <>
                    <p className="mt-4 text-sm text-[#62626d]">{copy.kycTestingBody}</p>
                    <TestingAccessControls stage="kyc" />
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-[#62626d]">
                      {isManualNameReview
                        ? copy.nameReviewBody
                        : copy.veriffBody}
                    </p>
                    {veriffStatus === "processing" ? (
                      <p className="mt-3 rounded-2xl border border-[#d7ead9] bg-[#f4fff4] px-4 py-3 text-sm font-semibold text-[#1f7a4d]">
                        {copy.veriffProcessing}
                      </p>
                    ) : null}
                    {isManualNameReview ? (
                      <p className="mt-3 rounded-2xl border border-[#f7dbc9] bg-[#fff5ee] px-4 py-3 text-sm font-semibold text-[#c15a2a]">
                        {copy.manualReviewNotice}
                      </p>
                    ) : null}
                    {veriffError ? (
                      <p className="mt-3 rounded-2xl border border-[#f2d7d7] bg-[#fff7f7] px-4 py-3 text-sm font-semibold text-red-600">{veriffError}</p>
                    ) : null}
                    {!isManualNameReview ? (
                      <a href="/api/veriff/session" className="btn-primary mt-3">
                        {copy.verifyWithVeriff}
                      </a>
                    ) : null}
                  </>
                )}
              </section>
            ) : null}

            <div className="flex justify-center pt-2">
              <Link href="/dashboard?section=contacts" className="btn-primary">
                {copy.exploreProviders}
              </Link>
            </div>
          </>
        ) : null}

        {currentSection === "contacts" && !isProvider ? (
          canSeeContacts ? (
            <section className="rounded-[1.8rem] border border-[#e6ddd1] bg-white p-5 shadow-[0_18px_36px_rgba(22,18,14,0.04)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{copy.contactsTitle}</h2>
                  <p className="mt-1 text-sm text-[#62626d]">{copy.contactsBody}</p>
                </div>
                <span className="inline-flex rounded-full bg-[#fff3ec] px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#dc4f1f]">
                  {copy.accessOpen}
                </span>
              </div>
              {referralCode && referralLink ? (
                <div className="mt-4">
                  <ReviewerReferralCard
                    language={currentUserLanguage}
                    referralCode={referralCode}
                    referralLink={referralLink}
                    rewardedCountThisMonth={rewardedReferralsThisMonth}
                    providerLimit={providerAccessLimit}
                    totalQualifiedReferrals={totalQualifiedReferrals}
                    eligibleForRewards={reviewerCanEarnReferralRewards}
                  />
                </div>
              ) : null}
              <ProviderContactGrid key={user.id} contacts={contacts} initialContactedIds={contactedIds} language={currentUserLanguage} reviewerId={user.id} />
            </section>
          ) : (
            <section className="overflow-hidden rounded-[1.9rem] border border-[#f1d6c8] bg-[linear-gradient(135deg,#fff6f0_0%,#fffdf9_100%)] p-5 shadow-[0_18px_36px_rgba(22,18,14,0.04)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#dc4f1f]">{copy.accessBlocked}</p>
                  <h2 className="mt-2 text-2xl font-bold text-[#131316]">{copy.blockedTitle}</h2>
                  <p className="mt-3 text-sm text-[#62626d]">{copy.blockedBody}</p>
                </div>
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ff6b35] text-white">
                  <LockKeyhole className="h-5 w-5" />
                </span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <article className="rounded-[1.4rem] border border-white/70 bg-white/90 p-4">
                  <p className="text-sm font-semibold text-[#131316]">{copy.paymentActive}</p>
                  <p className="mt-1 text-sm text-[#62626d]">{copy.currentStatus}: {membershipMeta.label}</p>
                  {membershipPeriodEnd ? <p className="mt-1 text-sm text-[#62626d]">{copy.membershipPeriodEnds}: {membershipPeriodEnd}</p> : null}
                </article>
                <article className="rounded-[1.4rem] border border-white/70 bg-white/90 p-4">
                  <p className="text-sm font-semibold text-[#131316]">{copy.idStatus}</p>
                  <p className="mt-1 text-sm text-[#62626d]">{copy.currentStatus}: {kycStatus}</p>
                </article>
              </div>
              <Link href="/dashboard" className="btn-primary mt-5 inline-flex">
                {copy.backHome}
              </Link>
            </section>
          )
        ) : null}

        {currentSection === "messages" ? (
          <>
            <CollaborationInbox
              key={collaborationInboxKey}
              currentUserId={user.id}
              currentUserRole={isProvider ? "provider" : "reviewer"}
              currentUserLanguage={currentUserLanguage}
              title={copy.activeConversations}
              description={isProvider ? copy.providerMessagesDescription : copy.reviewerMessagesDescription}
              emptyTitle={copy.emptyConversationsTitle}
              emptyDescription={isProvider ? copy.providerEmptyConversationsBody : copy.reviewerEmptyConversationsBody}
              threads={collaborationThreads}
              initialThreadId={requestedThreadId}
              categorySuggestions={isProvider ? userInterests : []}
              quickReplies={
                isProvider
                  ? []
                  : reviewerQuickReplies
              }
            />
          </>
        ) : null}

        {currentSection === "support" ? (
          <SupportCenter currentUserId={user.id} language={currentUserLanguage} threads={supportThreads} />
        ) : null}
      </main>
    </div>
  );
}
