import { redirect } from "next/navigation";
import { RoleSelector } from "@/components/role-selector";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  return (
    <main className="container-x min-h-screen py-8">
      <div className="mx-auto w-full max-w-lg">
        <RoleSelector />
      </div>
    </main>
  );
}


