"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const ACCESS_TEST_MODE = true;

async function getTesterUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("No autorizado");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "tester") {
    throw new Error("Solo testers");
  }

  return { supabase, userId: user.id };
}

export async function setTestingAccessState(formData: FormData) {
  if (!ACCESS_TEST_MODE) {
    throw new Error("Modo de pruebas deshabilitado");
  }

  const intent = String(formData.get("intent") || "");
  const { supabase, userId } = await getTesterUser();

  if (intent === "paid" || intent === "skip_payment") {
    await supabase.from("memberships").upsert({
      user_id: userId,
      status: "active",
      paid_at: new Date().toISOString(),
    });
  } else if (intent === "reset_payment") {
    await supabase.from("memberships").upsert({
      user_id: userId,
      status: "pending_payment",
      paid_at: null,
    });
  } else if (intent === "approve_kyc") {
    await supabase.from("kyc_checks").upsert({
      user_id: userId,
      status: "approved",
      reviewed_at: new Date().toISOString(),
    });
  } else if (intent === "reset_kyc") {
    await supabase.from("kyc_checks").upsert({
      user_id: userId,
      status: "pending",
      reviewed_at: null,
    });
  } else {
    throw new Error("Accion invalida");
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin");
}
