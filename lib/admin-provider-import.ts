import { mergeProfileData } from "@/lib/profile-data";
import {
  buildContactMethodsFromFields,
  getComparableContactMethods,
  getPrimaryContactUrl,
  normalizeContactValue,
} from "@/lib/provider-contact";
import type { createAdminClient } from "@/lib/supabase/admin";

export type ProviderImportSource = "messenger" | "instagram" | "whatsapp" | "email";

export type ProviderImportDraft = {
  email?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  messenger?: string | null;
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
      return cleaned ? `https://m.me/${cleaned}` : "";
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
  }
) {
  const requestedMethods = [input.whatsapp, input.instagram, input.messenger]
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
  const notes = String(input.notes || "").trim();
  const contactMethods = buildContactMethodsFromFields({ whatsapp, instagram, messenger });
  const methodCount = [whatsapp, instagram, messenger].filter(Boolean).length;

  if (!methodCount) {
    throw new Error("Debes agregar al menos un metodo de contacto.");
  }

  const duplicateMessage = await findDuplicateProviderContact(admin, {
    whatsapp,
    email,
    instagram,
    messenger,
  });

  if (duplicateMessage) {
    throw new Error(duplicateMessage);
  }

  const safeTitle = await getNextProviderAlias(admin);
  const safeUrl = getPrimaryContactUrl(contactMethods) || "#";
  const primaryNetwork = whatsapp ? "WhatsApp" : instagram ? "Instagram" : messenger ? "Messenger" : "";

  const payloads = [
    {
      title: safeTitle,
      email: email || null,
      network: primaryNetwork,
      url: safeUrl,
      contact_methods: contactMethods || null,
      notes,
      is_verified: Boolean(input.isVerified),
      created_by: adminId,
    },
    {
      title: safeTitle,
      network: primaryNetwork,
      url: safeUrl,
      contact_methods: contactMethods || null,
      notes,
      is_verified: Boolean(input.isVerified),
      created_by: adminId,
    },
    {
      title: safeTitle,
      network: primaryNetwork,
      url: safeUrl,
      notes,
      is_verified: Boolean(input.isVerified),
      created_by: adminId,
    },
    {
      title: safeTitle,
      network: primaryNetwork,
      url: safeUrl,
      notes,
      created_by: adminId,
    },
    {
      title: safeTitle,
      network: primaryNetwork,
      url: safeUrl,
      notes,
    },
    {
      title: safeTitle,
      network: primaryNetwork,
      url: safeUrl,
    },
  ];

  let lastError: string | null = null;

  for (const payload of payloads) {
    const { error } = await admin.from("provider_contacts").insert(payload);

    if (!error) {
      return safeTitle;
    }

    lastError = error.message;
  }

  throw new Error(lastError || "No se pudo crear el contacto del proveedor.");
}
