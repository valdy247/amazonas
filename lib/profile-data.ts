import { normalizeInterestKeys, type ExperienceLevel } from "@/lib/onboarding";

export type ReviewerAvailability = "open" | "selective" | "busy";

export type ReviewerContactDetails = {
  whatsapp: string;
  instagram: string;
  messenger: string;
};

export type ProfileData = {
  country: string;
  experienceLevel: ExperienceLevel;
  interests: string[];
  note: string;
  availability: ReviewerAvailability;
  allowsDirectContact: boolean;
  publicProfile: boolean;
  contact: ReviewerContactDetails;
};

export const DEFAULT_PROFILE_DATA: ProfileData = {
  country: "",
  experienceLevel: "new",
  interests: [],
  note: "",
  availability: "open",
  allowsDirectContact: false,
  publicProfile: true,
  contact: {
    whatsapp: "",
    instagram: "",
    messenger: "",
  },
};

export const AVAILABILITY_OPTIONS: Array<{ value: ReviewerAvailability; label: string; description: string }> = [
  { value: "open", label: "Disponible", description: "Acepto nuevas oportunidades ahora." },
  { value: "selective", label: "Selectivo", description: "Solo tomo propuestas que encajan bien." },
  { value: "busy", label: "Ocupado", description: "Quiero seguir visible, pero con menos prioridad." },
];

function safeString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function safeStringArray(value: unknown) {
  return normalizeInterestKeys(value);
}

export function normalizeProfileData(value: unknown): ProfileData {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const contact = source.contact && typeof source.contact === "object" ? (source.contact as Record<string, unknown>) : {};
  const availability = source.availability;
  const experienceLevel = source.experienceLevel;

  return {
    country: safeString(source.country),
    experienceLevel: experienceLevel === "growing" || experienceLevel === "advanced" ? experienceLevel : "new",
    interests: safeStringArray(source.interests),
    note: safeString(source.note),
    availability: availability === "selective" || availability === "busy" ? availability : "open",
    allowsDirectContact: Boolean(source.allowsDirectContact),
    publicProfile: source.publicProfile === false ? false : true,
    contact: {
      whatsapp: safeString(contact.whatsapp),
      instagram: safeString(contact.instagram),
      messenger: safeString(contact.messenger),
    },
  };
}

export function mergeProfileData(...values: unknown[]) {
  return values.reduce<ProfileData>((current, value) => {
    const next = normalizeProfileData(value);
    const hasAllowsDirectContact = value && typeof value === "object" && "allowsDirectContact" in (value as Record<string, unknown>);
    const hasPublicProfile = value && typeof value === "object" && "publicProfile" in (value as Record<string, unknown>);

    return {
      country: next.country || current.country,
      experienceLevel: next.experienceLevel || current.experienceLevel,
      interests: next.interests.length ? next.interests : current.interests,
      note: next.note || current.note,
      availability: next.availability || current.availability,
      allowsDirectContact: hasAllowsDirectContact ? next.allowsDirectContact : current.allowsDirectContact,
      publicProfile: hasPublicProfile ? next.publicProfile : current.publicProfile,
      contact: {
        whatsapp: next.contact.whatsapp || current.contact.whatsapp,
        instagram: next.contact.instagram || current.contact.instagram,
        messenger: next.contact.messenger || current.contact.messenger,
      },
    };
  }, DEFAULT_PROFILE_DATA);
}

export function buildProfileData(input: Partial<ProfileData>) {
  return normalizeProfileData({ ...DEFAULT_PROFILE_DATA, ...input, contact: { ...DEFAULT_PROFILE_DATA.contact, ...(input.contact || {}) } });
}

export function getReviewerContactMethods(profileData: ProfileData) {
  const methods = [
    profileData.contact.whatsapp ? { label: "WhatsApp", value: profileData.contact.whatsapp } : null,
    profileData.contact.instagram ? { label: "Instagram", value: profileData.contact.instagram } : null,
    profileData.contact.messenger ? { label: "Messenger", value: profileData.contact.messenger } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  return methods;
}
