"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { COUNTRY_OPTIONS, EXPERIENCE_LABELS, INTEREST_OPTIONS, type ExperienceLevel, type UserRole } from "@/lib/onboarding";
import { AVAILABILITY_OPTIONS, type ReviewerAvailability } from "@/lib/profile-data";
import { LANGUAGE_OPTIONS, normalizeLanguage, profileCopy, type AppLanguage } from "@/lib/i18n";

type ProfileEditorProps = {
  email?: string | null;
  initialValues: {
    role: UserRole;
    firstName: string;
    lastName: string;
    phone: string;
    country: string;
    experienceLevel: ExperienceLevel;
    interests: string[];
    note: string;
    availability: ReviewerAvailability;
    allowsDirectContact: boolean;
    publicProfile: boolean;
    contactWhatsapp: string;
    contactInstagram: string;
    contactMessenger: string;
    preferredLanguage: AppLanguage;
  };
};

const phoneRegex = /^\+?[0-9()\-\s]{8,20}$/;

export function ProfileEditor({ email, initialValues }: ProfileEditorProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [values, setValues] = useState(initialValues);
  const copy = profileCopy[values.preferredLanguage];

  function updateValue<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function toggleInterest(option: string) {
    setValues((current) => ({
      ...current,
      interests: current.interests.includes(option)
        ? current.interests.filter((item) => item !== option)
        : [...current.interests, option],
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(null);

    if (!phoneRegex.test(values.phone.trim())) {
      setError(copy.invalidPhone);
      return;
    }

    if (!values.country) {
      setError(copy.selectCountry);
      return;
    }

    if (values.interests.length < 3) {
      setError(copy.selectInterests);
      return;
    }

    if (values.allowsDirectContact) {
      const directContactCount = [values.contactWhatsapp, values.contactInstagram, values.contactMessenger]
        .map((item) => item.trim())
        .filter(Boolean).length;

      if (!directContactCount) {
        setError(copy.directContactRequired);
        return;
      }
    }

    setLoading(true);

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

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        phone: values.phone.trim(),
        preferred_language: values.preferredLanguage,
        profile_data: {
          country: values.country,
          experienceLevel: values.experienceLevel,
          interests: values.interests,
          note: values.note.trim(),
          availability: values.availability,
          allowsDirectContact: values.allowsDirectContact,
          publicProfile: values.publicProfile,
          contact: {
            whatsapp: values.contactWhatsapp.trim(),
            instagram: values.contactInstagram.trim(),
            messenger: values.contactMessenger.trim(),
          },
        },
      })
      .eq("id", user.id);

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        country: values.country,
        experience_level: values.experienceLevel,
        interests: values.interests,
        profile_note: values.note.trim(),
        availability: values.availability,
        allows_direct_contact: values.allowsDirectContact,
        public_profile: values.publicProfile,
        reviewer_contact: {
          whatsapp: values.contactWhatsapp.trim(),
          instagram: values.contactInstagram.trim(),
          messenger: values.contactMessenger.trim(),
        },
        preferred_language: values.preferredLanguage,
      },
    });

    if (metadataError) {
      setError(metadataError.message);
      setLoading(false);
      return;
    }

    setSaved(copy.updated);
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-4">
      <section className="card p-5">
        <p className="text-sm font-semibold text-[#dc4f1f]">{copy.editProfile}</p>
        <h1 className="mt-2 text-3xl font-bold">{copy.adjustInfo}</h1>
        <p className="mt-2 text-sm text-[#62626d]">{copy.improveProfile}</p>

        <div className="mt-4 flex flex-wrap gap-3">
          <div className="rounded-full border border-[#e5e5df] bg-white px-4 py-2 text-sm text-[#62626d]">
            {email || copy.noEmail}
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-xl font-bold">{copy.basicData}</h2>
        <p className="mt-2 text-sm text-[#62626d]">{copy.nameLocked}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            className="input cursor-not-allowed bg-[#f3efe9] text-[#7d7368] opacity-90"
            value={values.firstName}
            placeholder={copy.firstName}
            readOnly
            disabled
          />
          <input
            className="input cursor-not-allowed bg-[#f3efe9] text-[#7d7368] opacity-90"
            value={values.lastName}
            placeholder={copy.lastName}
            readOnly
            disabled
          />
        </div>
        <div className="mt-3">
          <input className="input" value={values.phone} onChange={(event) => updateValue("phone", event.target.value)} placeholder={copy.phone} />
        </div>
        <div className="mt-4 rounded-[1.5rem] border border-[#eadfd6] bg-[linear-gradient(180deg,#fffdfa_0%,#fcfaf7_100%)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#131316]">{copy.language}</p>
              <p className="mt-1 text-sm text-[#62626d]">{copy.languageHelp}</p>
            </div>
            <span className="rounded-full bg-[#fff2eb] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#dc4f1f]">
              {values.preferredLanguage === "es" ? "Espanol" : "English"}
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {LANGUAGE_OPTIONS.map((option) => {
              const active = values.preferredLanguage === option.value;
              const helper =
                option.value === "es"
                  ? copy.spanishHelper
                  : "You will see the platform and translated messages in English first.";

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateValue("preferredLanguage", normalizeLanguage(option.value))}
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
      </section>

      <section className="card p-5">
        <h2 className="text-xl font-bold">{copy.focus}</h2>
        <p className="mt-2 text-sm text-[#62626d]">
          {values.role === "reviewer"
            ? copy.reviewerFocus
            : copy.providerFocus}
        </p>
        <div className="mt-4 grid gap-3">
          <select className="input" value={values.country} onChange={(event) => updateValue("country", event.target.value)}>
            <option value="">{copy.selectCountryOption}</option>
            {COUNTRY_OPTIONS.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>

          <div className="grid gap-2">
            {(["new", "growing", "advanced"] as ExperienceLevel[]).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => updateValue("experienceLevel", level)}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  values.experienceLevel === level ? "border-[#ff6b35] bg-[#fff3ec]" : "border-[#e5e5df]"
                }`}
              >
                <p className="font-semibold">{EXPERIENCE_LABELS[level]}</p>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((option) => {
              const active = values.interests.includes(option);

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleInterest(option)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    active ? "border-[#ff6b35] bg-[#ff6b35] text-white" : "border-[#e5e5df] bg-white text-[#131316]"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>

          <textarea
            className="input min-h-32 resize-none"
            value={values.note}
            onChange={(event) => updateValue("note", event.target.value)}
            placeholder={
              values.role === "reviewer"
                ? copy.reviewerNote
                : copy.providerNote
            }
          />
        </div>
      </section>

      {values.role === "reviewer" || values.role === "provider" ? (
        <section className="card p-5">
          <h2 className="text-xl font-bold">{values.role === "reviewer" ? copy.availabilityContact : copy.visibilityContact}</h2>
          <p className="mt-2 text-sm text-[#62626d]">
            {values.role === "reviewer"
              ? copy.reviewerContactHelp
              : copy.providerContactHelp}
          </p>

          {values.role === "reviewer" ? (
            <div className="mt-4 grid gap-2">
              {AVAILABILITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateValue("availability", option.value)}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    values.availability === option.value ? "border-[#ff6b35] bg-[#fff3ec]" : "border-[#e5e5df]"
                  }`}
                >
                  <p className="font-semibold">{option.label}</p>
                  <p className="mt-1 text-sm text-[#62626d]">{option.description}</p>
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-4 grid gap-3">
            <label className="flex items-start gap-3 rounded-2xl border border-[#e5e5df] p-4 text-sm">
              <input type="checkbox" checked={values.publicProfile} onChange={(event) => updateValue("publicProfile", event.target.checked)} className="mt-1" />
              <span>{values.role === "reviewer" ? copy.showProfileReviewer : copy.showProfileProvider}</span>
            </label>
            <label className="flex items-start gap-3 rounded-2xl border border-[#e5e5df] p-4 text-sm">
              <input type="checkbox" checked={values.allowsDirectContact} onChange={(event) => updateValue("allowsDirectContact", event.target.checked)} className="mt-1" />
              <span>{copy.allowDirectContact}</span>
            </label>
          </div>

          <div className="mt-4 grid gap-3">
            <input className="input" value={values.contactWhatsapp} onChange={(event) => updateValue("contactWhatsapp", event.target.value)} placeholder={copy.whatsappPlaceholder} />
            <input className="input" value={values.contactInstagram} onChange={(event) => updateValue("contactInstagram", event.target.value)} placeholder={copy.instagramPlaceholder} />
            <input className="input" value={values.contactMessenger} onChange={(event) => updateValue("contactMessenger", event.target.value)} placeholder={copy.messengerPlaceholder} />
          </div>
        </section>
      ) : null}

      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
      {saved ? <p className="text-sm font-semibold text-emerald-700">{saved}</p> : null}

      <div className="sticky bottom-0 space-y-3 rounded-[1.6rem] border border-[#e5e5df] bg-white/95 p-3 backdrop-blur">
        <button type="submit" disabled={loading} className="btn-primary h-12 w-full">
          {loading ? copy.saving : copy.saveChanges}
        </button>
        <Link href="/dashboard" className="btn-secondary h-12 w-full">
          {copy.goDashboard}
        </Link>
      </div>
    </form>
  );
}
