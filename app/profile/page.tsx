import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ProfileEditor } from "@/components/profile-editor";
import { createClient } from "@/lib/supabase/server";
import { normalizeUserRole, type ExperienceLevel } from "@/lib/onboarding";

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

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, role")
    .eq("id", user.id)
    .single();

  if (!profile?.role || profile.role === "pending") {
    redirect("/onboarding");
  }

  const metadata = (user.user_metadata || {}) as Record<string, unknown>;
  const fallbackName = splitFullName(profile?.full_name);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="container-x py-4 sm:py-6">
        <ProfileEditor
          email={user.email}
          initialValues={{
            role: normalizeUserRole(profile.role),
            firstName:
              fallbackName.firstName ||
              (typeof metadata.first_name === "string" ? metadata.first_name : ""),
            lastName:
              fallbackName.lastName ||
              (typeof metadata.last_name === "string" ? metadata.last_name : ""),
            phone:
              profile.phone ||
              (typeof metadata.phone === "string" ? metadata.phone : ""),
            country: typeof metadata.country === "string" ? metadata.country : "",
            experienceLevel:
              metadata.experience_level === "growing" || metadata.experience_level === "advanced"
                ? (metadata.experience_level as ExperienceLevel)
                : "new",
            interests: Array.isArray(metadata.interests)
              ? metadata.interests.filter((item): item is string => typeof item === "string")
              : [],
            note: typeof metadata.profile_note === "string" ? metadata.profile_note : "",
          }}
        />
      </main>
    </div>
  );
}
