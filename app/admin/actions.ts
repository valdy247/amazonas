"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { hasAdminAccess } from "@/lib/admin";
import { mergeProfileData } from "@/lib/profile-data";
import { resolveSiteOrigin } from "@/lib/site-url";
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

export type AdminActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const PROVIDER_CONTACT_REPORT_TYPES = ["no_reply", "not_provider", "trusted", "scam", "broken_contact"] as const;
const PROVIDER_CONTACT_REPORT_STATUSES = ["open", "in_review", "resolved", "dismissed"] as const;

function isProviderContactReportType(value: string): value is (typeof PROVIDER_CONTACT_REPORT_TYPES)[number] {
  return (PROVIDER_CONTACT_REPORT_TYPES as readonly string[]).includes(value);
}

function isProviderContactReportStatus(value: string): value is (typeof PROVIDER_CONTACT_REPORT_STATUSES)[number] {
  return (PROVIDER_CONTACT_REPORT_STATUSES as readonly string[]).includes(value);
}

async function assertAdmin() {
  const supabase = await createClient();
  const admin = createAdminClient();
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

  return { supabase, admin, adminId: user.id };
}

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function formatProviderAlias(sequenceId: number) {
  return `Proveedor ${100 + sequenceId}`;
}

async function getNextProviderAlias(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("provider_contacts").select("id").order("id", { ascending: false }).limit(1).maybeSingle();
  const nextId = (typeof data?.id === "number" ? data.id : 0) + 1;
  return formatProviderAlias(nextId);
}

async function logAdminAction(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  admin?: ReturnType<typeof createAdminClient>;
  adminId: string;
  action: string;
  targetUserId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const writer = input.admin || input.supabase;
  await writer.from("admin_audit_logs").insert({
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
  facebook,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  contactId?: number;
  whatsapp?: string;
  email?: string;
  instagram?: string;
  messenger?: string;
  facebook?: string;
}) {
  const requestedMethods = [whatsapp, instagram, messenger, facebook].map((value) => normalizeContactValue(value)).filter(Boolean);
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
    throw new Error(`Este proveedor ya ha sido agregado. Revisa el registro ${duplicateManual.title || `#${duplicateManual.id}`} y actualizalo si hace falta.`);
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
      normalizeContactValue((profileData.contact as { facebook?: string }).facebook),
    ].filter(Boolean);

    if (normalizedEmail && normalizeEmail(profile.email) === normalizedEmail) {
      return true;
    }

    return requestedMethods.some((method) => comparable.includes(method));
  });

  if (duplicateRegistered) {
    throw new Error(
      `Este proveedor ya existe como cuenta registrada. Coincide con ${duplicateRegistered.full_name || duplicateRegistered.email || "ese provider"}.`
    );
  }
}

async function deleteProviderContactAsDuplicate(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  admin: ReturnType<typeof createAdminClient>;
  adminId: string;
  contactId: number;
  duplicateMessage: string;
}) {
  const { error } = await input.admin.from("provider_contacts").delete().eq("id", input.contactId);

  if (error) {
    throw new Error(error.message || "No se pudo eliminar el duplicado saneado.");
  }

  await logAdminAction({
    supabase: input.supabase,
    admin: input.admin,
    adminId: input.adminId,
    action: "delete_provider_contact_duplicate_after_repair",
    metadata: {
      contactId: input.contactId,
      duplicateMessage: input.duplicateMessage,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

async function performCreateProviderContact(formData: FormData) {
  const { supabase, admin, adminId } = await assertAdmin();

  const email = normalizeEmail(String(formData.get("email") || ""));
  const whatsappPrefix = normalizeWhatsappPrefix(String(formData.get("whatsapp_prefix") || ""));
  const whatsappNumber = String(formData.get("whatsapp_number") || "").trim();
  const whatsapp = `${whatsappPrefix}${whatsappNumber}`.trim();
  const instagram = String(formData.get("instagram") || "").trim();
  const messenger = String(formData.get("messenger") || "").trim();
  const facebook = String(formData.get("facebook") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const isVerified = String(formData.get("is_verified") || "") === "on";
  const contactMethods = buildContactMethodsFromFields({ email, whatsapp, instagram, messenger, facebook });
  const methodCount = [email, whatsapp, instagram, messenger, facebook].filter(Boolean).length;

  if (!methodCount) {
    throw new Error("Debes agregar al menos un metodo de contacto.");
  }

  await assertUniqueProviderContact({
    supabase,
    whatsapp,
    email,
    instagram,
    messenger,
    facebook,
  });

  const safeTitle = await getNextProviderAlias(supabase);
  const safeUrl = getPrimaryContactUrl(contactMethods) || "#";
  const primaryNetwork = email ? "Email" : whatsapp ? "WhatsApp" : instagram ? "Instagram" : messenger ? "Messenger" : facebook ? "Facebook" : "";

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
    const { error } = await admin.from("provider_contacts").insert(payload);

    if (!error) {
      await logAdminAction({
        supabase,
        admin,
        adminId,
        action: "create_provider_contact",
        metadata: {
          title: safeTitle,
          network: primaryNetwork,
          hasEmail: Boolean(email),
          hasWhatsapp: Boolean(whatsapp),
          hasInstagram: Boolean(instagram),
          hasMessenger: Boolean(messenger),
          hasFacebook: Boolean(facebook),
          isVerified,
        },
      });
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
  const { supabase, admin, adminId } = await assertAdmin();

  const contactId = Number(formData.get("contact_id") || 0);
  const email = normalizeEmail(String(formData.get("email") || ""));
  const whatsappPrefix = normalizeWhatsappPrefix(String(formData.get("whatsapp_prefix") || ""));
  const whatsappNumber = String(formData.get("whatsapp_number") || "").trim();
  const whatsapp = `${whatsappPrefix}${whatsappNumber}`.trim();
  const instagram = String(formData.get("instagram") || "").trim();
  const messenger = String(formData.get("messenger") || "").trim();
  const facebook = String(formData.get("facebook") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const isVerified = String(formData.get("is_verified") || "") === "on";
  const allowDuplicateDelete = String(formData.get("allow_duplicate_delete") || "") === "on";
  const isActive = String(formData.get("is_active") || "") === "on";
  const contactMethods = buildContactMethodsFromFields({ email, whatsapp, instagram, messenger, facebook });
  const methodCount = [email, whatsapp, instagram, messenger, facebook].filter(Boolean).length;

  if (!Number.isFinite(contactId) || contactId <= 0) {
    throw new Error("Contacto invalido.");
  }

  if (!methodCount) {
    throw new Error("Debes agregar al menos un metodo de contacto.");
  }

  try {
    await assertUniqueProviderContact({
      supabase,
      contactId,
      whatsapp,
      email,
      instagram,
      messenger,
      facebook,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo validar el duplicado.";
    const isDuplicateConflict =
      message.includes("ya ha sido agregado") || message.includes("ya existe como cuenta registrada");

    if (allowDuplicateDelete && isDuplicateConflict) {
      await deleteProviderContactAsDuplicate({
        supabase,
        admin,
        adminId,
        contactId,
        duplicateMessage: message,
      });
      return;
    }

    throw error;
  }

  const safeTitle = formatProviderAlias(contactId);
  const safeUrl = getPrimaryContactUrl(contactMethods) || "#";
  const primaryNetwork = email ? "Email" : whatsapp ? "WhatsApp" : instagram ? "Instagram" : messenger ? "Messenger" : facebook ? "Facebook" : "";

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
    const { error } = await admin.from("provider_contacts").update(payload).eq("id", contactId);

    if (!error) {
      await logAdminAction({
        supabase,
        admin,
        adminId,
        action: "update_provider_contact",
        metadata: {
          contactId,
          title: safeTitle,
          network: primaryNetwork,
          isActive,
          isVerified,
        },
      });
      revalidatePath("/admin");
      revalidatePath("/dashboard");
      return;
    }

    lastError = error.message;
  }

  throw new Error(lastError || "No se pudo actualizar el contacto del proveedor.");
}

export async function deleteProviderContact(formData: FormData) {
  const { supabase, admin, adminId } = await assertAdmin();
  const contactId = Number(formData.get("contact_id") || 0);

  if (!Number.isFinite(contactId) || contactId <= 0) {
    throw new Error("Contacto invalido.");
  }

  const { error } = await admin.from("provider_contacts").delete().eq("id", contactId);

  if (error) {
    throw new Error(error.message || "No se pudo eliminar el contacto.");
  }

  await logAdminAction({
    supabase,
    admin,
    adminId,
    action: "delete_provider_contact",
    metadata: { contactId },
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function updateProviderContactAction(
  _previousState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  try {
    await updateProviderContact(formData);
    return {
      status: "success",
      message:
        String(formData.get("allow_duplicate_delete") || "") === "on"
          ? "Saneamiento aplicado. Si era duplicado, se elimino automaticamente."
          : "Reparacion aplicada correctamente.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "No se pudo aplicar la reparacion.",
    };
  }
}

export async function updateMemberStatus(formData: FormData) {
  const { supabase, admin, adminId } = await assertAdmin();
  const userId = String(formData.get("user_id") || "");
  const requestedMembershipStatus = String(formData.get("membership_status") || "pending_payment");
  const membershipStatus = requestedMembershipStatus === "paid" ? "active" : requestedMembershipStatus;
  const kycStatus = String(formData.get("kyc_status") || "pending");
  const kycReviewNote = String(formData.get("kyc_review_note") || "").trim();

  if (!userId) {
    throw new Error("Usuario invalido");
  }

  const membershipWithOrderId = await admin
    .from("memberships")
    .select("square_customer_id, square_order_id, square_subscription_id, created_at")
    .eq("user_id", userId)
    .maybeSingle();

  const membershipWithoutOrderId = membershipWithOrderId.error
    ? await admin
        .from("memberships")
        .select("square_customer_id, square_subscription_id, created_at")
        .eq("user_id", userId)
        .maybeSingle()
    : null;

  const existingMembership = membershipWithOrderId.error
    ? membershipWithoutOrderId?.data
      ? {
          ...membershipWithoutOrderId.data,
          square_order_id: null,
        }
      : null
    : membershipWithOrderId.data;

  const existingMembershipError = membershipWithOrderId.error && !membershipWithoutOrderId?.data
    ? membershipWithoutOrderId?.error || membershipWithOrderId.error
    : null;

  if (existingMembershipError) {
    throw new Error(existingMembershipError.message || "No se pudo leer la membresia actual.");
  }

  const now = new Date();
  const currentPeriodEndAt =
    membershipStatus === "active"
      ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : null;

  const { error: membershipError } = await admin.from("memberships").upsert(
    {
      user_id: userId,
      status: membershipStatus,
      paid_at: membershipStatus === "active" ? now.toISOString() : null,
      current_period_end_at: currentPeriodEndAt,
      last_payment_failed_at: membershipStatus === "payment_failed" ? now.toISOString() : null,
      canceled_at: membershipStatus === "canceled" ? now.toISOString() : null,
      square_customer_id: existingMembership?.square_customer_id || null,
      square_order_id: existingMembership?.square_order_id || null,
      square_subscription_id: existingMembership?.square_subscription_id || null,
      created_at: existingMembership?.created_at || now.toISOString(),
      updated_at: now.toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (membershipError) {
    throw new Error(membershipError.message || "No se pudo actualizar la membresia.");
  }

  const { error: kycError } = await admin.from("kyc_checks").upsert(
    {
      user_id: userId,
      status: kycStatus,
      review_note: kycReviewNote || null,
      reviewed_at: now.toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (kycError) {
    throw new Error(kycError.message || "No se pudo actualizar el KYC.");
  }

  await logAdminAction({
    supabase,
    admin,
    adminId,
    action: "update_member_status",
    targetUserId: userId,
    metadata: { membershipStatus, kycStatus, kycReviewNote: kycReviewNote || null },
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function updateMemberStatusAction(
  _previousState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  try {
    await updateMemberStatus(formData);
    return {
      status: "success",
      message: "Decision guardada correctamente.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "No se pudo guardar la decision.",
    };
  }
}

export async function createAdminUser(formData: FormData) {
  const { supabase, admin, adminId } = await assertAdmin();

  const targetEmail = String(formData.get("email") || "").toLowerCase();

  if (!targetEmail) {
    throw new Error("Correo requerido");
  }

  const { data: userProfile } = await supabase.from("profiles").select("id").eq("email", targetEmail).single();

  if (!userProfile) {
    throw new Error("Ese correo no existe en profiles. Debe registrarse primero.");
  }

  await admin.from("profiles").update({ role: "admin" }).eq("id", userProfile.id);

  await logAdminAction({
    supabase,
    admin,
    adminId,
    action: "create_admin_user",
    targetUserId: userProfile.id,
    metadata: { email: targetEmail },
  });

  revalidatePath("/admin");
}

export async function createAdminUserAction(
  _previousState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  try {
    await createAdminUser(formData);
    return {
      status: "success",
      message: "Admin asignado correctamente.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "No se pudo asignar el admin.",
    };
  }
}

export async function sendPasswordRecoveryForUser(formData: FormData) {
  const { supabase, admin, adminId } = await assertAdmin();
  const userId = String(formData.get("user_id") || "").trim();
  const email = normalizeEmail(String(formData.get("email") || ""));

  if (!userId || !email) {
    throw new Error("Usuario invalido.");
  }

  const requestHeaders = await headers();
  const redirectTo = `${resolveSiteOrigin({
    headerOrigin: requestHeaders.get("origin"),
    forwardedHost: requestHeaders.get("x-forwarded-host") || requestHeaders.get("host"),
    forwardedProto: requestHeaders.get("x-forwarded-proto"),
  })}/auth/callback`;
  const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    throw new Error(error.message || "No se pudo enviar la recuperacion.");
  }

  await logAdminAction({
    supabase,
    admin,
    adminId,
    action: "send_password_recovery",
    targetUserId: userId,
    metadata: { email },
  });

  revalidatePath("/admin");
}

export async function sendPasswordRecoveryForUserAction(
  _previousState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  try {
    await sendPasswordRecoveryForUser(formData);
    return {
      status: "success",
      message: "Correo de recuperacion enviado correctamente.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "No se pudo enviar la recuperacion.",
    };
  }
}

export async function updateUserEmail(formData: FormData) {
  const { supabase, admin, adminId } = await assertAdmin();
  const userId = String(formData.get("user_id") || "").trim();
  const newEmail = normalizeEmail(String(formData.get("new_email") || ""));

  if (!userId || !newEmail) {
    throw new Error("Email invalido.");
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    email: newEmail,
    email_confirm: true,
  });

  if (error) {
    throw new Error(error.message || "No se pudo actualizar el email.");
  }

  const { error: profileError } = await admin.from("profiles").update({ email: newEmail }).eq("id", userId);
  if (profileError) {
    throw new Error(profileError.message || "No se pudo sincronizar el perfil.");
  }

  await logAdminAction({
    supabase,
    admin,
    adminId,
    action: "update_user_email",
    targetUserId: userId,
    metadata: { newEmail },
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function updateUserEmailAction(
  _previousState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  try {
    await updateUserEmail(formData);
    return {
      status: "success",
      message: "Email actualizado correctamente.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "No se pudo actualizar el email.",
    };
  }
}

export async function updateDirectoryRemovalRequest(formData: FormData) {
  const { supabase, admin, adminId } = await assertAdmin();
  const requestId = Number(formData.get("request_id") || 0);
  const status = String(formData.get("status") || "open").trim();
  const adminNote = String(formData.get("admin_note") || "").trim();

  if (!Number.isFinite(requestId) || requestId <= 0) {
    throw new Error("Solicitud invalida.");
  }

  if (!["open", "in_review", "resolved", "rejected"].includes(status)) {
    throw new Error("Estado invalido.");
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from("directory_removal_requests")
    .update({
      status,
      admin_note: adminNote || null,
      reviewed_by: adminId,
      resolved_at: status === "resolved" || status === "rejected" ? now : null,
      updated_at: now,
    })
    .eq("id", requestId);

  if (error) {
    throw new Error(error.message || "No se pudo actualizar la solicitud.");
  }

  await logAdminAction({
    supabase,
    admin,
    adminId,
    action: "update_directory_removal_request",
    metadata: {
      requestId,
      status,
      hasAdminNote: Boolean(adminNote),
    },
  });

  revalidatePath("/admin");
}

export async function createProviderContactAdminReport(formData: FormData) {
  const { supabase, admin, adminId } = await assertAdmin();
  const contactId = Number(formData.get("contact_id") || 0);
  const reportType = String(formData.get("report_type") || "").trim();

  if (!Number.isFinite(contactId) || contactId <= 0) {
    throw new Error("Contacto invalido.");
  }

  if (!isProviderContactReportType(reportType)) {
    throw new Error("Tipo de reporte invalido.");
  }

  const now = new Date().toISOString();
  const { error } = await admin.from("provider_contact_reports").upsert(
    {
      provider_contact_id: contactId,
      reporter_id: adminId,
      reporter_role: "admin",
      report_type: reportType,
      status: "open",
      updated_at: now,
    },
    {
      onConflict: "provider_contact_id,reporter_id,report_type",
    }
  );

  if (error) {
    throw new Error(error.message || "No se pudo registrar la marca.");
  }

  await logAdminAction({
    supabase,
    admin,
    adminId,
    action: "admin_provider_contact_report",
    metadata: {
      contactId,
      reportType,
    },
  });

  revalidatePath("/admin");
}

export async function updateProviderContactReportReview(formData: FormData) {
  const { supabase, admin, adminId } = await assertAdmin();
  const contactId = Number(formData.get("contact_id") || 0);
  const reportType = String(formData.get("report_type") || "").trim();
  const status = String(formData.get("status") || "").trim();
  const adminNote = String(formData.get("admin_note") || "").trim();

  if (!Number.isFinite(contactId) || contactId <= 0) {
    throw new Error("Contacto invalido.");
  }

  if (!isProviderContactReportType(reportType)) {
    throw new Error("Tipo de reporte invalido.");
  }

  if (!isProviderContactReportStatus(status)) {
    throw new Error("Estado invalido.");
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from("provider_contact_reports")
    .update({
      status,
      admin_note: adminNote || null,
      updated_at: now,
    })
    .eq("provider_contact_id", contactId)
    .eq("report_type", reportType);

  if (error) {
    throw new Error(error.message || "No se pudo actualizar la revision.");
  }

  await logAdminAction({
    supabase,
    admin,
    adminId,
    action: "review_provider_contact_report",
    metadata: {
      contactId,
      reportType,
      status,
      hasAdminNote: Boolean(adminNote),
    },
  });

  revalidatePath("/admin");
}

