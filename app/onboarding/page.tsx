import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ProfileWizard } from "@/components/profile-wizard";
import { normalizeUserRole } from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/server";
import { normalizeLanguage } from "@/lib/i18n";

function splitFullName(fullName?: string | null) {
  const normalized = String(fullName || "").trim();

  if (!normalized) {
    return { firstName: "", lastName: "" };
  }

  const parts = normalized.split(/\s+/);

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, role, accepted_terms_at, preferred_language")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") {
    redirect("/admin");
  }

  if (profile?.role && profile.role !== "pending") {
    redirect("/profile");
  }

  const metadata = (user.user_metadata || {}) as Record<string, unknown>;
  const fallbackName = splitFullName(profile?.full_name);
  const signupRole =
    typeof metadata.signup_role === "string" || typeof metadata.role === "string"
      ? normalizeUserRole((metadata.signup_role as string) || (metadata.role as string))
      : null;

  const language = normalizeLanguage(profile?.preferred_language || metadata.preferred_language);

  return (
    <div className="min-h-screen">
      <SiteHeader language={language} />
      <main className="container-x py-4 sm:py-6">
        <ProfileWizard
          language={language}
          email={user.email}
          roleLocked={Boolean(signupRole)}
          initialValues={{
            role: signupRole || normalizeUserRole(profile?.role),
            firstName:
              fallbackName.firstName ||
              (typeof metadata.first_name === "string" ? metadata.first_name : ""),
            lastName:
              fallbackName.lastName ||
              (typeof metadata.last_name === "string" ? metadata.last_name : ""),
            phone:
              profile?.phone ||
              (typeof metadata.phone === "string" ? metadata.phone : ""),
            acceptTerms: Boolean(profile?.accepted_terms_at),
            country: typeof metadata.country === "string" ? metadata.country : "",
            experienceLevel:
              metadata.experience_level === "growing" || metadata.experience_level === "advanced"
                ? metadata.experience_level
                : "new",
            interests: Array.isArray(metadata.interests) ? metadata.interests : [],
            note: typeof metadata.profile_note === "string" ? metadata.profile_note : "",
            publicProfile: metadata.public_profile === false ? false : true,
            allowsDirectContact: Boolean(metadata.allows_direct_contact),
            contactWhatsapp:
              metadata.reviewer_contact &&
              typeof metadata.reviewer_contact === "object" &&
              typeof (metadata.reviewer_contact as Record<string, unknown>).whatsapp === "string"
                ? ((metadata.reviewer_contact as Record<string, unknown>).whatsapp as string)
                : "",
            contactInstagram:
              metadata.reviewer_contact &&
              typeof metadata.reviewer_contact === "object" &&
              typeof (metadata.reviewer_contact as Record<string, unknown>).instagram === "string"
                ? ((metadata.reviewer_contact as Record<string, unknown>).instagram as string)
                : "",
            contactMessenger:
              metadata.reviewer_contact &&
              typeof metadata.reviewer_contact === "object" &&
              typeof (metadata.reviewer_contact as Record<string, unknown>).messenger === "string"
                ? ((metadata.reviewer_contact as Record<string, unknown>).messenger as string)
                : "",
          }}
        />
      </main>
    </div>
  );
}
