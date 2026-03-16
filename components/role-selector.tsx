"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { normalizeLanguage, onboardingCopy } from "@/lib/i18n";

type Role = "reviewer" | "provider";

export function RoleSelector() {
  const params = useSearchParams();
  const router = useRouter();
  const language = normalizeLanguage(params.get("lang"));
  const copy = onboardingCopy[language];
  const helperText = useMemo(
    () => (language === "en" ? "This defines your initial experience inside the platform." : "Esto define la experiencia inicial dentro de la plataforma."),
    [language]
  );
  const [role, setRole] = useState<Role>("reviewer");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!acceptTerms) {
      setError(copy.acceptTerms);
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError(copy.sessionError);
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ role, accepted_terms_at: new Date().toISOString() })
      .eq("id", user.id);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="card space-y-5 p-4">
      <h1 className="text-2xl font-bold">{copy.choosePath}</h1>
      <p className="text-sm text-[#62626d]">{helperText}</p>

      <div className="grid gap-3">
        <button
          type="button"
          onClick={() => setRole("reviewer")}
          className={`rounded-2xl border p-4 text-left ${role === "reviewer" ? "border-[#ff6b35] bg-[#fff3ec]" : "border-[#e5e5df]"}`}
        >
          <p className="font-semibold">{copy.reviewerTitle}</p>
          <p className="text-sm text-[#62626d]">{copy.reviewerDescription}</p>
        </button>
        <button
          type="button"
          onClick={() => setRole("provider")}
          className={`rounded-2xl border p-4 text-left ${role === "provider" ? "border-[#ff6b35] bg-[#fff3ec]" : "border-[#e5e5df]"}`}
        >
          <p className="font-semibold">{copy.providerTitle}</p>
          <p className="text-sm text-[#62626d]">{copy.providerDescription}</p>
        </button>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={acceptTerms} onChange={(event) => setAcceptTerms(event.target.checked)} />
        <span>{copy.terms}</span>
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button type="button" onClick={handleContinue} disabled={loading} className="btn-primary w-full">
        {loading ? copy.activating : copy.continue}
      </button>
    </div>
  );
}
