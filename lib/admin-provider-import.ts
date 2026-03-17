import { mergeProfileData } from "@/lib/profile-data";
import {
  buildContactMethodsFromFields,
  getComparableContactMethods,
  getPrimaryContactUrl,
  normalizeContactValue,
} from "@/lib/provider-contact";
import type { createAdminClient } from "@/lib/supabase/admin";

export type ProviderImportSource = "messenger" | "facebook" | "instagram" | "whatsapp" | "email";

export type ProviderImportDraft = {
  email?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  messenger?: string | null;
  facebook?: string | null;
  avatarDataUrl?: string | null;
  notes?: string | null;
  isVerified?: boolean;
};

type AdminClient = ReturnType<typeof createAdminClient>;

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

export function formatProviderAlias(sequenceId: number) {
  return `Proveedor ${100 + sequenceId}`;
}

function canRetryProviderContactWrite(errorMessage: string, columns: string[]) {
  const normalized = errorMessage.toLowerCase();
  return columns.some((column) => normalized.includes(column.toLowerCase()));
}

async function getNextProviderAlias(admin: AdminClient) {
  const { data } = await admin.from("provider_contacts").select("id").order("id", { ascending: false }).limit(1).maybeSingle();
  const nextId = (typeof data?.id === "number" ? data.id : 0) + 1;
  return formatProviderAlias(nextId);
}

export function normalizeImportedContactValue(source: ProviderImportSource, raw: string) {
  const value = String(raw || "").trim();

  if (!value) {
    return "";
  }

  switch (source) {
    case "messenger": {
      const cleaned = value
        .replace(/^https?:\/\/(www\.)?(m\.me|messenger\.com)\//i, "")
        .replace(/^@/, "")
        .replace(/^messages?\//i, "")
        .replace(/^profile\.php\?id=/i, "")
        .trim();
      return cleaned;
    }
    case "facebook": {
      const cleaned = value
        .replace(/^https?:\/\/(www\.)?facebook\.com\//i, "")
        .replace(/^@/, "")
        .replace(/\/+$/, "")
        .trim();
      return cleaned;
    }
    case "instagram": {
      const cleaned = value
        .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
        .replace(/^@/, "")
        .replace(/\/+$/, "")
        .trim();
      return cleaned ? `https://instagram.com/${cleaned}` : "";
    }
    case "whatsapp": {
      const cleaned = value.replace(/[^\d+]/g, "").trim();
      return cleaned;
    }
    case "email":
      return normalizeEmail(value);
    default:
      return value;
  }
}

export async function findDuplicateProviderContact(
  admin: AdminClient,
  input: {
    contactId?: number;
    whatsapp?: string;
    email?: string;
    instagram?: string;
    messenger?: string;
    facebook?: string;
  }
) {
  const requestedMethods = [input.whatsapp, input.instagram, input.messenger, input.facebook]
    .map((value) => normalizeContactValue(value))
    .filter(Boolean);
  const normalizedEmail = normalizeEmail(input.email);

  if (!requestedMethods.length && !normalizedEmail) {
    return null;
  }

  const withMethods = await admin.from("provider_contacts").select("id, title, email, contact_methods, url, network");
  const existingContacts = withMethods.error
    ? ((await admin.from("provider_contacts").select("id, title, url, network")).data || []).map((contact) => ({
        ...contact,
        email: null,
        contact_methods: null,
      }))
    : withMethods.data || [];

  const duplicateManual = existingContacts.find((contact) => {
    if (input.contactId && Number(contact.id) === input.contactId) {
      return false;
    }

    if (normalizedEmail && normalizeEmail("email" in contact ? contact.email : "") === normalizedEmail) {
      return true;
    }

    const comparable = getComparableContactMethods(contact.contact_methods, contact.url, contact.network);
    return requestedMethods.some((method) => comparable.includes(method));
  });

  if (duplicateManual) {
    return `Ya existe en contactos como ${duplicateManual.title || `#${duplicateManual.id}`}.`;
  }

  const { data: existingProfiles } = await admin
    .from("profiles")
    .select("id, full_name, email, phone, role, profile_data")
    .eq("role", "provider");

  const duplicateRegistered = (existingProfiles || []).find((profile) => {
    const profileData = mergeProfileData(profile.profile_data);
    const comparable = [
      normalizeContactValue(profile.phone),
      normalizeContactValue(profileData.contact.whatsapp),
      normalizeContactValue(profileData.contact.instagram),
      normalizeContactValue(profileData.contact.messenger),
      normalizeContactValue((profileData.contact as { facebook?: string }).facebook),
    ].filter(Boolean);

    if (normalizedEmail && normalizeEmail(profile.email) === normalizedEmail) {
      return true;
    }

    return requestedMethods.some((method) => comparable.includes(method));
  });

  if (duplicateRegistered) {
    return `Ya existe como cuenta registrada: ${duplicateRegistered.full_name || duplicateRegistered.email || "provider"}.`;
  }

  return null;
}

export async function createProviderContactRecord(
  admin: AdminClient,
  adminId: string,
  input: ProviderImportDraft
) {
  const email = normalizeEmail(input.email);
  const whatsapp = String(input.whatsapp || "").trim();
  const instagram = String(input.instagram || "").trim();
  const messenger = String(input.messenger || "").trim();
  const facebook = String(input.facebook || "").trim();
  const avatarDataUrl = String(input.avatarDataUrl || "").trim();
  const notes = String(input.notes || "").trim();
  const contactMethods = buildContactMethodsFromFields({ whatsapp, instagram, messenger, facebook });
  const methodCount = [whatsapp, instagram, messenger, facebook].filter(Boolean).length;

  if (!methodCount) {
    throw new Error("Debes agregar al menos un metodo de contacto.");
  }

  const duplicateMessage = await findDuplicateProviderContact(admin, {
    whatsapp,
    email,
    instagram,
    messenger,
    facebook,
  });

  if (duplicateMessage) {
    throw new Error(duplicateMessage);
  }

  const safeTitle = await getNextProviderAlias(admin);
  const safeUrl = getPrimaryContactUrl(contactMethods) || "#";
  const primaryNetwork = whatsapp ? "WhatsApp" : instagram ? "Instagram" : messenger ? "Messenger" : facebook ? "Facebook" : "";

  const basePayload = {
    title: safeTitle,
    email: email || null,
    network: primaryNetwork,
    url: safeUrl,
    contact_methods: contactMethods || null,
    avatar_data_url: avatarDataUrl || null,
    notes,
    is_verified: Boolean(input.isVerified),
    created_by: adminId,
  };

  const { error } = await admin.from("provider_contacts").insert(basePayload);

  if (!error) {
    return safeTitle;
  }

  if (canRetryProviderContactWrite(error.message, ["email"])) {
    const retryWithoutEmail = { ...basePayload, email: null };
    const { error: retryError } = await admin.from("provider_contacts").insert(retryWithoutEmail);

    if (!retryError) {
      return safeTitle;
    }

    throw new Error(retryError.message || "No se pudo crear el contacto del proveedor.");
  }

  throw new Error(error.message || "No se pudo crear el contacto del proveedor.");
}
