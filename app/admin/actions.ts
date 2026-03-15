"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasAdminAccess } from "@/lib/admin";
import { buildContactMethodsFromFields, getComparableContactMethods, getPrimaryContactUrl, normalizeContactValue, normalizeWhatsappPrefix } from "@/lib/provider-contact";

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("No autorizado");
  }

  const { data: me } = await supabase.from("profiles").select("role, email").eq("id", user.id).single();

  if (!hasAdminAccess(me?.role, me?.email || user.email)) {
    throw new Error("Solo admin");
  }

  return { supabase, adminId: user.id };
}

async function assertUniqueProviderContact({
  supabase,
  contactId,
  whatsapp,
  instagram,
  messenger,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  contactId?: number;
  whatsapp?: string;
  instagram?: string;
  messenger?: string;
}) {
  const requestedMethods = [whatsapp, instagram, messenger]
    .map((value) => normalizeContactValue(value))
    .filter(Boolean);

  if (!requestedMethods.length) {
    return;
  }

  const withMethods = await supabase
    .from("provider_contacts")
    .select("id, contact_methods, url, network");

  const existingContacts = withMethods.error
    ? (
        await supabase
          .from("provider_contacts")
          .select("id, url, network")
      ).data?.map((contact) => ({ ...contact, contact_methods: null })) || []
    : withMethods.data || [];

  const duplicate = existingContacts.find((contact) => {
    if (contactId && Number(contact.id) === contactId) {
      return false;
    }

    const comparable = getComparableContactMethods(contact.contact_methods, contact.url, contact.network);
    return requestedMethods.some((method) => comparable.includes(method));
  });

  if (duplicate) {
    throw new Error("Ya existe un proveedor con ese numero o enlace de contacto.");
  }
}

export async function createProviderContact(formData: FormData) {
  const { supabase, adminId } = await assertAdmin();

  const title = String(formData.get("title") || "").trim();
  const whatsappPrefix = normalizeWhatsappPrefix(String(formData.get("whatsapp_prefix") || ""));
  const whatsappNumber = String(formData.get("whatsapp_number") || "").trim();
  const whatsapp = `${whatsappPrefix}${whatsappNumber}`.trim();
  const instagram = String(formData.get("instagram") || "").trim();
  const messenger = String(formData.get("messenger") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const isVerified = String(formData.get("is_verified") || "") === "on";
  const contactMethods = buildContactMethodsFromFields({ whatsapp, instagram, messenger });
  const methodCount = [whatsapp, instagram, messenger].filter(Boolean).length;

  // Evita romper la UI en testing: completa valores faltantes.
  const safeTitle = title || "Proveedor sin nombre";
  const safeUrl = getPrimaryContactUrl(contactMethods) || "#";
  const primaryNetwork = whatsapp ? "WhatsApp" : instagram ? "Instagram" : messenger ? "Messenger" : "";

  if (!methodCount) {
    throw new Error("Debes agregar al menos un metodo de contacto.");
  }

  await assertUniqueProviderContact({
    supabase,
    whatsapp,
    instagram,
    messenger,
  });

  const payloads = [
    {
      title: safeTitle,
      network: primaryNetwork,
      url: safeUrl,
      contact_methods: contactMethods || null,
      notes,
      is_verified: isVerified,
      created_by: adminId,
    },
    {
      title: safeTitle,
      network: primaryNetwork,
      url: safeUrl,
      notes,
      is_verified: isVerified,
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
    const { error } = await supabase.from("provider_contacts").insert(payload);

    if (!error) {
      revalidatePath("/admin");
      revalidatePath("/dashboard");
      return;
    }

    lastError = error.message;
  }

  throw new Error(lastError || "No se pudo crear el contacto del proveedor.");
}

export async function updateProviderContact(formData: FormData) {
  const { supabase, adminId } = await assertAdmin();

  const contactId = Number(formData.get("contact_id") || 0);
  const title = String(formData.get("title") || "").trim();
  const whatsappPrefix = normalizeWhatsappPrefix(String(formData.get("whatsapp_prefix") || ""));
  const whatsappNumber = String(formData.get("whatsapp_number") || "").trim();
  const whatsapp = `${whatsappPrefix}${whatsappNumber}`.trim();
  const instagram = String(formData.get("instagram") || "").trim();
  const messenger = String(formData.get("messenger") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const isVerified = String(formData.get("is_verified") || "") === "on";
  const isActive = String(formData.get("is_active") || "") === "on";
  const contactMethods = buildContactMethodsFromFields({ whatsapp, instagram, messenger });
  const methodCount = [whatsapp, instagram, messenger].filter(Boolean).length;

  if (!Number.isFinite(contactId) || contactId <= 0) {
    throw new Error("Contacto invalido.");
  }

  if (!methodCount) {
    throw new Error("Debes agregar al menos un metodo de contacto.");
  }

  await assertUniqueProviderContact({
    supabase,
    contactId,
    whatsapp,
    instagram,
    messenger,
  });

  const safeTitle = title || "Proveedor sin nombre";
  const safeUrl = getPrimaryContactUrl(contactMethods) || "#";
  const primaryNetwork = whatsapp ? "WhatsApp" : instagram ? "Instagram" : messenger ? "Messenger" : "";

  const payloads = [
    {
      title: safeTitle,
      network: primaryNetwork,
      url: safeUrl,
      contact_methods: contactMethods || null,
      notes,
      is_verified: isVerified,
      is_active: isActive,
      created_by: adminId,
    },
    {
      title: safeTitle,
      network: primaryNetwork,
      url: safeUrl,
      notes,
      is_verified: isVerified,
      is_active: isActive,
      created_by: adminId,
    },
    {
      title: safeTitle,
      network: primaryNetwork,
      url: safeUrl,
      notes,
      is_active: isActive,
      created_by: adminId,
    },
    {
      title: safeTitle,
      network: primaryNetwork,
      url: safeUrl,
      notes,
      is_active: isActive,
    },
    {
      title: safeTitle,
      network: primaryNetwork,
      url: safeUrl,
    },
  ];

  let lastError: string | null = null;

  for (const payload of payloads) {
    const { error } = await supabase.from("provider_contacts").update(payload).eq("id", contactId);

    if (!error) {
      revalidatePath("/admin");
      revalidatePath("/dashboard");
      return;
    }

    lastError = error.message;
  }

  throw new Error(lastError || "No se pudo actualizar el contacto del proveedor.");
}

export async function deleteProviderContact(formData: FormData) {
  const { supabase } = await assertAdmin();
  const contactId = Number(formData.get("contact_id") || 0);

  if (!Number.isFinite(contactId) || contactId <= 0) {
    throw new Error("Contacto invalido.");
  }

  const { error } = await supabase.from("provider_contacts").delete().eq("id", contactId);

  if (error) {
    throw new Error(error.message || "No se pudo eliminar el contacto.");
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function updateMemberStatus(formData: FormData) {
  const { supabase } = await assertAdmin();
  const userId = String(formData.get("user_id") || "");
  const membershipStatus = String(formData.get("membership_status") || "pending_payment");
  const kycStatus = String(formData.get("kyc_status") || "pending");

  if (!userId) {
    throw new Error("Usuario inválido");
  }

  await supabase
    .from("memberships")
    .upsert({
      user_id: userId,
      status: membershipStatus,
      paid_at: membershipStatus === "active" ? new Date().toISOString() : null,
    });

  await supabase
    .from("kyc_checks")
    .upsert({
      user_id: userId,
      status: kycStatus,
      reviewed_at: new Date().toISOString(),
    });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function createAdminUser(formData: FormData) {
  const { supabase } = await assertAdmin();

  const targetEmail = String(formData.get("email") || "").toLowerCase();

  if (!targetEmail) {
    throw new Error("Correo requerido");
  }

  const { data: userProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", targetEmail)
    .single();

  if (!userProfile) {
    throw new Error("Ese correo no existe en profiles. Debe registrarse primero.");
  }

  await supabase.from("profiles").update({ role: "admin" }).eq("id", userProfile.id);

  revalidatePath("/admin");
}


