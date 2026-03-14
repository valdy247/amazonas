import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ProfileWizard } from "@/components/profile-wizard";
import { createClient } from "@/lib/supabase/server";

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
    .select("first_name, last_name, phone, role, accepted_terms_at")
    .eq("id", user.id)
    .single();

  const metadata = (user.user_metadata || {}) as Record<string, unknown>;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="container-x py-4 sm:py-6">
        <ProfileWizard
          email={user.email}
          initialValues={{
            role: profile?.role === "provider" ? "provider" : "tester",
            firstName:
              profile?.first_name ||
              (typeof metadata.first_name === "string" ? metadata.first_name : ""),
            lastName:
              profile?.last_name ||
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
          }}
        />
      </main>
    </div>
  );
}
