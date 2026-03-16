"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { authCopy, LANGUAGE_OPTIONS, normalizeLanguage } from "@/lib/i18n";

const phoneRegex = /^\+?[0-9()\-\s]{8,20}$/;

type ApiResponse = {
  error?: string;
  data?: {
    user?: { id?: string | null };
    access_token?: string;
    refresh_token?: string;
  };
};

export function AuthForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferredLanguage, setPreferredLanguage] = useState(() => normalizeLanguage(params.get("lang")));

  const mode = useMemo(() => (params.get("mode") === "signup" ? "signup" : "signin"), [params]);
  const createdOk = params.get("created") === "1";
  const copy = authCopy[preferredLanguage];

  function humanizeAuthError(raw: string) {
    const msg = raw.toLowerCase();
    if (msg.includes("email rate limit exceeded")) return copy.signupEmailRateLimit;
    if (msg.includes("user already registered")) return copy.signupAlreadyRegistered;
    if (msg.includes("email not confirmed")) return copy.signinEmailNotConfirmed;
    if (msg.includes("invalid login credentials")) return copy.signinInvalidCredentials;
    return raw;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const formElement = event.currentTarget;

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirm_password") || "");
    const firstName = String(formData.get("first_name") || "").trim();
    const lastName = String(formData.get("last_name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const fullName = `${firstName} ${lastName}`.trim();
    const identityConfirmed = String(formData.get("identity_confirmation") || "") === "on";
    const preferredLanguageValue = normalizeLanguage(formData.get("preferred_language"));

    try {
      if (mode === "signup") {
        if (!firstName || !lastName) return setError(copy.requiredName), void setLoading(false);
        if (!phoneRegex.test(phone)) return setError(copy.invalidPhone), void setLoading(false);
        if (!identityConfirmed) {
          return setError(copy.identityRequired), void setLoading(false);
        }
        if (password.length < 8) return setError(copy.passwordMin), void setLoading(false);
        if (password !== confirmPassword) return setError(copy.passwordMismatch), void setLoading(false);

        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            data: {
              first_name: firstName,
              last_name: lastName,
              phone,
              full_name: fullName,
              preferred_language: preferredLanguageValue,
            },
          }),
        });

        const json = (await res.json()) as ApiResponse;

        if (!res.ok || json.error) {
          setError(humanizeAuthError(json.error || copy.createFailed));
          return;
        }

        if (!json.data?.user?.id) {
          setError(copy.createConfirmFailed);
          return;
        }

        formElement.reset();
        router.replace(`/auth?mode=signin&created=1&email=${encodeURIComponent(email)}`);
        return;
      }

      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const json = (await res.json()) as ApiResponse;

      if (!res.ok || json.error) {
        setError(humanizeAuthError(json.error || copy.signinFailed));
        return;
      }

      const accessToken = json.data?.access_token;
      const refreshToken = json.data?.refresh_token;

      if (!accessToken || !refreshToken) {
        setError(copy.invalidSession);
        return;
      }

      const supabase = createClient();
      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (setSessionError) {
        setError(copy.localSessionFailed);
        return;
      }

      router.push("/dashboard");
      return;
    } catch {
      setError(copy.serverError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card w-full space-y-4 p-4" noValidate>
      <h1 className="text-2xl font-bold">{mode === "signup" ? copy.signupTitle : copy.signinTitle}</h1>

      {createdOk ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {copy.createdOk}
        </p>
      ) : null}

      {mode === "signup" ? (
        <div className="grid gap-3">
          <div className="rounded-[1.4rem] border border-[#f2d2c0] bg-[linear-gradient(180deg,#fff6f1_0%,#fffdfa_100%)] px-4 py-4 text-sm text-[#62564a]">
            <p className="font-semibold text-[#131316]">{copy.identityTitle}</p>
            <p className="mt-2">{copy.identityBody}</p>
          </div>
          <input type="hidden" name="preferred_language" value={preferredLanguage} />
          <div className="rounded-[1.5rem] border border-[#eadfd6] bg-[linear-gradient(180deg,#fffdfa_0%,#fcfaf7_100%)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#131316]">{copy.language}</p>
                <p className="mt-1 text-sm text-[#62626d]">
                  {copy.experienceSpanishFirst}
                </p>
              </div>
              <span className="rounded-full bg-[#fff2eb] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#dc4f1f]">
                {copy.active}
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {LANGUAGE_OPTIONS.map((option) => {
                const active = preferredLanguage === option.value;
                const helper = option.value === "es" ? copy.spanishOptionHelp : copy.englishOptionHelp;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPreferredLanguage(normalizeLanguage(option.value))}
                    className={`rounded-[1.35rem] border px-4 py-4 text-left transition ${
                      active
                        ? "border-[#ff6b35] bg-[linear-gradient(135deg,#ff6b35_0%,#ff8b5e_100%)] text-white shadow-[0_18px_30px_rgba(255,107,53,0.18)]"
                        : "border-[#eadfd6] bg-white text-[#131316] hover:border-[#f0cbb8] hover:bg-[#fff8f3]"
                    }`}
                  >
                    <p className="text-base font-semibold">{option.label}</p>
                    <p className={`mt-2 text-sm ${active ? "text-white/82" : "text-[#62626d]"}`}>{helper}</p>
                  </button>
                );
              })}
            </div>
          </div>
          <input className="input" name="first_name" placeholder={copy.firstName} required />
          <input className="input" name="last_name" placeholder={copy.lastName} required />
          <input className="input" name="phone" placeholder={copy.phone} required />
          <label className="rounded-[1.2rem] border border-[#eadfd6] bg-[#fcfaf7] px-4 py-3 text-sm text-[#62564a]">
            <span className="flex items-start gap-3">
              <input className="mt-1" type="checkbox" name="identity_confirmation" required />
              <span>{copy.identityConfirmation}</span>
            </span>
          </label>
        </div>
      ) : null}

      <input
        className="input"
        name="email"
        placeholder={copy.email}
        type="email"
        required
        defaultValue={params.get("email") || ""}
      />
      <input className="input" name="password" placeholder={copy.password} type="password" minLength={8} required />
      {mode === "signup" ? (
        <input
          className="input"
          name="confirm_password"
          placeholder={copy.confirmPassword}
          type="password"
          minLength={8}
          required
        />
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? copy.processing : mode === "signup" ? copy.createAccount : copy.enter}
      </button>
    </form>
  );
}
