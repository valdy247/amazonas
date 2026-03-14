"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasAdminAccess } from "@/lib/admin";
import { buildContactMethodsFromFields, getPrimaryContactUrl } from "@/lib/provider-contact";

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

export async function createProviderContact(formData: FormData) {
  const { supabase, adminId } = await assertAdmin();

  const title = String(formData.get("title") || "").trim();
  const whatsapp = String(formData.get("whatsapp") || "").trim();
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

  const insertWithMethods = await supabase.from("provider_contacts").insert({
    title: safeTitle,
    network: primaryNetwork,
    url: safeUrl,
    contact_methods: contactMethods || null,
    notes,
    is_verified: isVerified,
    created_by: adminId,
  });

  if (insertWithMethods.error) {
    await supabase.from("provider_contacts").insert({
      title: safeTitle,
      network: primaryNetwork,
      url: safeUrl,
      notes,
      is_verified: isVerified,
      created_by: adminId,
    });
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


