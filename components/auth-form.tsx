"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { authCopy, normalizeLanguage } from "@/lib/i18n";

const phoneRegex = /^\+?[0-9()\-\s]{8,20}$/;
type SignupRole = "reviewer" | "provider";

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
  const [signupRole, setSignupRole] = useState<SignupRole>(() => (params.get("role") === "provider" ? "provider" : "reviewer"));

  const mode = useMemo(() => {
    const rawMode = params.get("mode");
    return rawMode === "signup" || rawMode === "recovery" ? rawMode : "signin";
  }, [params]);
  const createdOk = params.get("created") === "1";
  const confirmedOk = params.get("confirmed") === "1";
  const confirmError = params.get("confirm_error") === "1";
  const passwordUpdatedOk = params.get("password_updated") === "1";
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
    const legalConsent = String(formData.get("legal_consent") || "") === "on";
    const preferredLanguageValue = normalizeLanguage(formData.get("preferred_language"));
    const selectedRole = String(formData.get("signup_role") || "") === "provider" ? "provider" : "reviewer";
    const isProviderSignup = selectedRole === "provider";

    try {
      if (mode === "recovery") {
        if (password.length < 8) return setError(copy.passwordMin), void setLoading(false);
        if (password !== confirmPassword) return setError(copy.passwordMismatch), void setLoading(false);

        const supabase = createClient();
        const { error: updateError } = await supabase.auth.updateUser({ password });

        if (updateError) {
          setError(updateError.message || copy.passwordUpdateFailed);
          return;
        }

        await supabase.auth.signOut();
        formElement.reset();
        router.replace(`/auth?mode=signin&password_updated=1&lang=${preferredLanguage}`);
        return;
      }

      if (mode === "signup") {
        if (!isProviderSignup && (!firstName || !lastName)) return setError(copy.requiredName), void setLoading(false);
        if (!isProviderSignup && !phoneRegex.test(phone)) return setError(copy.invalidPhone), void setLoading(false);
        if (!isProviderSignup && !identityConfirmed) {
          return setError(copy.identityRequired), void setLoading(false);
        }
        if (!legalConsent) {
          return setError(copy.legalConsentRequired), void setLoading(false);
        }
        if (password.length < 8) return setError(copy.passwordMin), void setLoading(false);
        if (password !== confirmPassword) return setError(copy.passwordMismatch), void setLoading(false);

        const acceptedAt = new Date().toISOString();

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
              signup_role: selectedRole,
              role: selectedRole,
              preferred_language: preferredLanguageValue,
              legal_consent: true,
              accepted_terms_at: acceptedAt,
              accepted_legal_policy_version: "2026-03-17",
            },
          }),
        });

        const json = (await res.json()) as ApiResponse;

        if (!res.ok || json.error) {
          setError(humanizeAuthError(json.error || copy.createFailed));
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
      <h1 className="text-2xl font-bold">
        {mode === "signup" ? copy.signupTitle : mode === "recovery" ? copy.recoveryTitle : copy.signinTitle}
      </h1>

      {createdOk ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {copy.createdOk}
        </p>
      ) : null}
      {confirmedOk ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{copy.confirmedOk}</p>
      ) : null}
      {confirmError ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{copy.confirmError}</p>
      ) : null}
      {passwordUpdatedOk ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{copy.passwordUpdatedOk}</p>
      ) : null}

      {mode === "signup" ? (
        <div className="grid gap-3">
          <input type="hidden" name="preferred_language" value={preferredLanguage} />
          <input type="hidden" name="signup_role" value={signupRole} />
          <div className="rounded-[1.5rem] border border-[#eadfd6] bg-[linear-gradient(180deg,#fffdfa_0%,#fcfaf7_100%)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#131316]">{copy.language}</p>
              </div>
              <span className="rounded-full bg-[#fff2eb] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#dc4f1f]">
                {copy.active}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { value: "es", label: "Español", flag: "🇪🇸" },
                { value: "en", label: "English", flag: "🇺🇸" },
              ].map((option) => {
                const active = preferredLanguage === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPreferredLanguage(normalizeLanguage(option.value))}
                    className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold transition ${
                      active
                        ? "border-[#ff6b35] bg-[linear-gradient(135deg,#ff6b35_0%,#ff8b5e_100%)] text-white shadow-[0_18px_30px_rgba(255,107,53,0.18)]"
                        : "border-[#eadfd6] bg-white text-[#131316] hover:border-[#f0cbb8] hover:bg-[#fff8f3]"
                    }`}
                  >
                    <span className="text-base leading-none">{option.flag}</span>
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-[#eadfd6] bg-[linear-gradient(180deg,#fffdfa_0%,#fcfaf7_100%)] p-4">
            <p className="text-sm font-semibold text-[#131316]">{copy.accountType}</p>
            <div className="mt-4 grid gap-3">
              {([
                { value: "reviewer", label: copy.reviewerAccount, body: copy.reviewerAccountBody },
                { value: "provider", label: copy.providerAccount, body: copy.providerAccountBody },
              ] as const).map((option) => {
                const active = signupRole === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSignupRole(option.value)}
                    className={`rounded-[1.4rem] border px-5 py-4 text-left transition ${
                      active
                        ? "border-[#ff6b35] bg-[linear-gradient(135deg,#fff4ee_0%,#ffe8db_100%)] text-[#131316] shadow-[0_16px_30px_rgba(255,107,53,0.12)]"
                        : "border-[#eadfd6] bg-white text-[#131316] hover:border-[#f0cbb8] hover:bg-[#fffaf6]"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-[1.05rem] font-semibold">{option.label}</span>
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] ${
                          active ? "border-[#ff6b35] bg-[#ff6b35] text-white" : "border-[#d9cec4] bg-[#f8f4ef] text-transparent"
                        }`}
                      >
                        •
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {signupRole === "reviewer" ? (
            <>
              <input className="input" name="first_name" placeholder={copy.firstName} required />
              <input className="input" name="last_name" placeholder={copy.lastName} required />
              <input className="input" name="phone" placeholder={copy.phone} required />
              <label className="rounded-[1.2rem] border border-[#eadfd6] bg-[#fcfaf7] px-4 py-3 text-sm text-[#62564a]">
                <span className="flex items-start gap-3">
                  <input className="mt-1" type="checkbox" name="identity_confirmation" required />
                  <span>{copy.identityConfirmation}</span>
                </span>
              </label>
            </>
          ) : (
            <>
              <input type="hidden" name="first_name" value="" />
              <input type="hidden" name="last_name" value="" />
              <input type="hidden" name="phone" value="" />
              <input type="hidden" name="identity_confirmation" value="" />
            </>
          )}
          <label className="rounded-[1.2rem] border border-[#eadfd6] bg-[#fcfaf7] px-4 py-3 text-sm text-[#62564a]">
            <span className="flex items-start gap-3">
              <input className="mt-1" type="checkbox" name="legal_consent" required />
              <span>
                {preferredLanguage === "en" ? "I accept the " : "Acepto los "}
                <a className="font-semibold text-[#2563eb]" href={`/terms?lang=${preferredLanguage}`} target="_blank" rel="noreferrer">
                  {preferredLanguage === "en" ? "Terms and Conditions" : "Terminos y condiciones"}
                </a>{" "}
                {preferredLanguage === "en" ? "and the " : "y la "}
                <a className="font-semibold text-[#2563eb]" href={`/privacy?lang=${preferredLanguage}`} target="_blank" rel="noreferrer">
                  {preferredLanguage === "en" ? "Privacy Policy" : "Politica de privacidad"}
                </a>
                .
              </span>
            </span>
          </label>
        </div>
      ) : null}

      {mode !== "recovery" ? (
        <input
          className="input"
          name="email"
          placeholder={copy.email}
          type="email"
          required
          defaultValue={params.get("email") || ""}
        />
      ) : (
        <p className="rounded-xl bg-[#fcfaf7] px-3 py-2 text-sm text-[#62564a]">{copy.recoveryBody}</p>
      )}
      <input className="input" name="password" placeholder={copy.password} type="password" minLength={8} required />
      {mode === "signup" || mode === "recovery" ? (
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
        {loading
          ? copy.processing
          : mode === "signup"
            ? copy.createAccount
            : mode === "recovery"
              ? copy.updatePassword
              : copy.enter}
      </button>
    </form>
  );
}
