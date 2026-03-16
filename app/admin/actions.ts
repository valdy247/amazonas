"use server";

import { revalidatePath } from "next/cache";
import { hasAdminAccess } from "@/lib/admin";
import { mergeProfileData } from "@/lib/profile-data";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildContactMethodsFromFields,
  getComparableContactMethods,
  getPrimaryContactUrl,
  normalizeContactValue,
  normalizeWhatsappPrefix,
} from "@/lib/provider-contact";
import { createClient } from "@/lib/supabase/server";

export type ProviderCreateFormState = {
  status: "idle" | "success" | "error";
  message: string;
};

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

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

async function logAdminAction(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  adminId: string;
  action: string;
  targetUserId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await input.supabase.from("admin_audit_logs").insert({
    admin_id: input.adminId,
    action: input.action,
    target_user_id: input.targetUserId || null,
    metadata: input.metadata || {},
  });
}

async function assertUniqueProviderContact({
  supabase,
  contactId,
  whatsapp,
  email,
  instagram,
  messenger,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  contactId?: number;
  whatsapp?: string;
  email?: string;
  instagram?: string;
  messenger?: string;
}) {
  const requestedMethods = [whatsapp, instagram, messenger].map((value) => normalizeContactValue(value)).filter(Boolean);
  const normalizedEmail = normalizeEmail(email);

  if (!requestedMethods.length && !normalizedEmail) {
    return;
  }

  const withMethods = await supabase.from("provider_contacts").select("id, title, email, contact_methods, url, network");

  const existingContacts = withMethods.error
    ? (
        await supabase.from("provider_contacts").select("id, title, url, network")
      ).data?.map((contact) => ({ ...contact, email: null, contact_methods: null })) || []
    : withMethods.data || [];

  const duplicateManual = existingContacts.find((contact) => {
    if (contactId && Number(contact.id) === contactId) {
      return false;
    }

    if (normalizedEmail && normalizeEmail("email" in contact ? contact.email : "") === normalizedEmail) {
      return true;
    }

    const comparable = getComparableContactMethods(contact.contact_methods, contact.url, contact.network);
    return requestedMethods.some((method) => comparable.includes(method));
  });

  if (duplicateManual) {
    throw new Error(`Ya este proveedor existe. Revisa telefono, email o enlaces de contacto de ${duplicateManual.title || "ese registro"}.`);
  }

  const { data: existingProfiles } = await supabase
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
    throw new Error(`Ya este proveedor existe. Coincide con el provider registrado ${duplicateRegistered.full_name || duplicateRegistered.email || ""}.`);
  }
}

async function performCreateProviderContact(formData: FormData) {
  const { supabase, adminId } = await assertAdmin();

  const title = String(formData.get("title") || "").trim();
  const email = normalizeEmail(String(formData.get("email") || ""));
  const whatsappPrefix = normalizeWhatsappPrefix(String(formData.get("whatsapp_prefix") || ""));
  const whatsappNumber = String(formData.get("whatsapp_number") || "").trim();
  const whatsapp = `${whatsappPrefix}${whatsappNumber}`.trim();
  const instagram = String(formData.get("instagram") || "").trim();
  const messenger = String(formData.get("messenger") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const isVerified = String(formData.get("is_verified") || "") === "on";
  const contactMethods = buildContactMethodsFromFields({ whatsapp, instagram, messenger });
  const methodCount = [whatsapp, instagram, messenger].filter(Boolean).length;

  if (!methodCount) {
    throw new Error("Debes agregar al menos un metodo de contacto.");
  }

  await assertUniqueProviderContact({
    supabase,
    whatsapp,
    email,
    instagram,
    messenger,
  });

  const safeTitle = title || "Proveedor sin nombre";
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
      is_verified: isVerified,
      created_by: adminId,
    },
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

export async function createProviderContact(formData: FormData) {
  await performCreateProviderContact(formData);
}

export async function createProviderContactAction(
  _previousState: ProviderCreateFormState,
  formData: FormData
): Promise<ProviderCreateFormState> {
  try {
    await performCreateProviderContact(formData);
    return {
      status: "success",
      message: "Proveedor agregado correctamente.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "No se pudo crear el proveedor.",
    };
  }
}

export async function updateProviderContact(formData: FormData) {
  const { supabase, adminId } = await assertAdmin();

  const contactId = Number(formData.get("contact_id") || 0);
  const title = String(formData.get("title") || "").trim();
  const email = normalizeEmail(String(formData.get("email") || ""));
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
    email,
    instagram,
    messenger,
  });

  const safeTitle = title || "Proveedor sin nombre";
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
      is_verified: isVerified,
      is_active: isActive,
      created_by: adminId,
    },
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
  const { supabase, adminId } = await assertAdmin();
  const userId = String(formData.get("user_id") || "");
  const membershipStatus = String(formData.get("membership_status") || "pending_payment");
  const kycStatus = String(formData.get("kyc_status") || "pending");

  if (!userId) {
    throw new Error("Usuario inválido");
  }

  await supabase.from("memberships").upsert({
    user_id: userId,
    status: membershipStatus,
    paid_at: membershipStatus === "active" ? new Date().toISOString() : null,
  });

  await supabase.from("kyc_checks").upsert({
    user_id: userId,
    status: kycStatus,
    reviewed_at: new Date().toISOString(),
  });

  await logAdminAction({
    supabase,
    adminId,
    action: "update_member_status",
    targetUserId: userId,
    metadata: { membershipStatus, kycStatus },
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function createAdminUser(formData: FormData) {
  const { supabase, adminId } = await assertAdmin();

  const targetEmail = String(formData.get("email") || "").toLowerCase();

  if (!targetEmail) {
    throw new Error("Correo requerido");
  }

  const { data: userProfile } = await supabase.from("profiles").select("id").eq("email", targetEmail).single();

  if (!userProfile) {
    throw new Error("Ese correo no existe en profiles. Debe registrarse primero.");
  }

  await supabase.from("profiles").update({ role: "admin" }).eq("id", userProfile.id);

  await logAdminAction({
    supabase,
    adminId,
    action: "create_admin_user",
    targetUserId: userProfile.id,
    metadata: { email: targetEmail },
  });

  revalidatePath("/admin");
}

export async function sendPasswordRecoveryForUser(formData: FormData) {
  const { supabase, adminId } = await assertAdmin();
  const userId = String(formData.get("user_id") || "").trim();
  const email = normalizeEmail(String(formData.get("email") || ""));

  if (!userId || !email) {
    throw new Error("Usuario invalido.");
  }

  const admin = createAdminClient();
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL || "https://amazonas-steel.vercel.app"}/auth`;
  const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    throw new Error(error.message || "No se pudo enviar la recuperacion.");
  }

  await logAdminAction({
    supabase,
    adminId,
    action: "send_password_recovery",
    targetUserId: userId,
    metadata: { email },
  });

  revalidatePath("/admin");
}

export async function updateUserEmail(formData: FormData) {
  const { supabase, adminId } = await assertAdmin();
  const userId = String(formData.get("user_id") || "").trim();
  const newEmail = normalizeEmail(String(formData.get("new_email") || ""));

  if (!userId || !newEmail) {
    throw new Error("Email invalido.");
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    email: newEmail,
    email_confirm: true,
  });

  if (error) {
    throw new Error(error.message || "No se pudo actualizar el email.");
  }

  const { error: profileError } = await supabase.from("profiles").update({ email: newEmail }).eq("id", userId);
  if (profileError) {
    throw new Error(profileError.message || "No se pudo sincronizar el perfil.");
  }

  await logAdminAction({
    supabase,
    adminId,
    action: "update_user_email",
    targetUserId: userId,
    metadata: { newEmail },
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}
