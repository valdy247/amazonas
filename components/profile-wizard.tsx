"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Compass, MapPin, Sparkles, Stars } from "lucide-react";
import { CompactSelect } from "@/components/compact-select";
import { createClient } from "@/lib/supabase/client";
import { COUNTRY_OPTIONS, EXPERIENCE_LABELS, getInterestLabel, getInterestOptions, INTEREST_OPTIONS, type ExperienceLevel, type UserRole } from "@/lib/onboarding";
import { buildProfileData } from "@/lib/profile-data";
import { normalizeLanguage, onboardingCopy, type AppLanguage } from "@/lib/i18n";

type WizardValues = {
  role: UserRole;
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  experienceLevel: ExperienceLevel;
  interests: string[];
  note: string;
  publicProfile: boolean;
  allowsDirectContact: boolean;
  contactWhatsapp: string;
  contactInstagram: string;
  contactMessenger: string;
  acceptTerms: boolean;
};

type ProfileWizardProps = {
  initialValues: Partial<WizardValues>;
  email?: string | null;
  language: AppLanguage;
};

const phoneRegex = /^\+?[0-9()\-\s]{8,20}$/;

function normalizeInterests(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function ProfileWizard({ initialValues, email, language }: ProfileWizardProps) {
  const router = useRouter();
  const copy = onboardingCopy[normalizeLanguage(language)];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<WizardValues>({
    role: initialValues.role || "reviewer",
    firstName: initialValues.firstName || "",
    lastName: initialValues.lastName || "",
    phone: initialValues.phone || "",
    country: initialValues.country || "",
    experienceLevel: initialValues.experienceLevel || "new",
    interests: normalizeInterests(initialValues.interests),
    note: initialValues.note || "",
    publicProfile: initialValues.publicProfile === false ? false : true,
    allowsDirectContact: Boolean(initialValues.allowsDirectContact),
    contactWhatsapp: initialValues.contactWhatsapp || "",
    contactInstagram: initialValues.contactInstagram || "",
    contactMessenger: initialValues.contactMessenger || "",
    acceptTerms: Boolean(initialValues.acceptTerms),
  });

  const hasEssentialProfile = Boolean(values.firstName.trim() && values.lastName.trim() && phoneRegex.test(values.phone.trim()));
  const baseSteps = useMemo(
    () =>
      [
        { id: "role", title: copy.steps.role.title, description: copy.steps.role.description },
        { id: "profile", title: copy.steps.profile.title, description: copy.steps.profile.description },
        { id: "focus", title: copy.steps.focus.title, description: copy.steps.focus.description },
        { id: "confirm", title: copy.steps.confirm.title, description: copy.steps.confirm.description },
      ] as const,
    [copy]
  );
  const steps = useMemo(() => baseSteps.filter((step) => (step.id === "profile" ? !hasEssentialProfile : true)), [baseSteps, hasEssentialProfile]);
  const [step, setStep] = useState(0);

  const currentStep = steps[step];
  const isLastStep = step === steps.length - 1;
  const progressPercent = Math.round(((step + 1) / steps.length) * 100);
  const selectedCountryLabel = values.country || copy.noCountrySelected;
  const roleCopy = values.role === "reviewer" ? copy.reviewerRoleCopy : copy.providerRoleCopy;
  const interestOptions = useMemo(() => getInterestOptions(language), [language]);

  function updateValue<K extends keyof WizardValues>(key: K, value: WizardValues[K]) {
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

  function toggleAllInterests() {
    setValues((current) => ({
      ...current,
      interests: current.interests.length === INTEREST_OPTIONS.length ? [] : [...INTEREST_OPTIONS],
    }));
  }

  function validateCurrentStep() {
    if (!currentStep) {
      return copy.stepLoadError;
    }

    if (currentStep.id === "profile") {
      if (!values.firstName.trim() || !values.lastName.trim()) {
        return copy.fullNameRequired;
      }

      if (!phoneRegex.test(values.phone.trim())) {
        return copy.invalidPhone;
      }
    }

    if (currentStep.id === "focus") {
      if (!values.country) {
        return copy.selectCountry;
      }

      if (values.interests.length < 3) {
        return values.role === "reviewer" ? copy.reviewerInterestsMin : copy.providerInterestsMin;
      }

      if (values.allowsDirectContact) {
        const directContactCount = [values.contactWhatsapp, values.contactInstagram, values.contactMessenger]
          .map((item) => item.trim())
          .filter(Boolean).length;

        if (!directContactCount) {
          return copy.directContactRequired;
        }
      }
    }

    if (currentStep.id === "confirm" && !values.acceptTerms) {
      return copy.acceptTerms;
    }

    return null;
  }

  async function handleNext() {
    if (!currentStep) {
      setError(copy.stepLoadError);
      return;
    }

    const validationError = validateCurrentStep();

    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);

    if (isLastStep) {
      await handleSubmit();
      return;
    }

    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  async function handleSubmit() {
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

    const fullName = `${values.firstName.trim()} ${values.lastName.trim()}`.trim();
    const acceptedTermsAt = new Date().toISOString();

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        role: values.role,
        full_name: fullName,
        phone: values.phone.trim(),
        accepted_terms_at: acceptedTermsAt,
        profile_data: buildProfileData({
          country: values.country,
          experienceLevel: values.experienceLevel,
          interests: values.interests,
          note: values.note.trim(),
          allowsDirectContact: values.allowsDirectContact,
          publicProfile: values.publicProfile,
          contact: {
            whatsapp: values.contactWhatsapp.trim(),
            instagram: values.contactInstagram.trim(),
            messenger: values.contactMessenger.trim(),
          },
        }),
      })
      .eq("id", user.id);

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        onboarding_completed_at: acceptedTermsAt,
        country: values.country,
        experience_level: values.experienceLevel,
        interests: values.interests,
        profile_note: values.note.trim(),
        availability: "open",
        allows_direct_contact: values.allowsDirectContact,
        public_profile: values.publicProfile,
        reviewer_contact: {
          whatsapp: values.contactWhatsapp.trim(),
          instagram: values.contactInstagram.trim(),
          messenger: values.contactMessenger.trim(),
        },
        role: values.role,
      },
    });

    if (metadataError) {
      setError(metadataError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-md pb-24 pt-1">
      <div className="space-y-4">
        <div className="space-y-4 px-1 pt-1 text-[#131316]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.24em] text-[#8f6a58]">{copy.onboarding}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#fff0e8] text-[#ff6b35] shadow-[0_10px_24px_rgba(255,107,53,0.16)]">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h1 className="text-xl font-bold leading-tight sm:text-2xl">{currentStep?.title}</h1>
                  <p className="mt-1 text-sm text-[#5c5c66]">{currentStep?.description}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.1rem] border border-[#f2d6ca] bg-white px-3 py-2 text-right shadow-[0_10px_24px_rgba(37,22,12,0.05)]">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#8f6a58]">{copy.progress}</p>
              <p className="mt-1 text-base font-bold">{progressPercent}%</p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#2a2019]">
              {copy.stepLabel} {step + 1} {language === "en" ? "of" : "de"} {steps.length}
            </p>
            <div className="rounded-full border border-[#f0d4c8] bg-[#fff6f1] px-3 py-1.5 text-[11px] font-semibold text-[#a45735]">
              {steps.length - step - 1} {copy.pending}
            </div>
          </div>

          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#f5ddd2]">
            <div
              className="relative h-full rounded-full bg-[linear-gradient(90deg,#ff8a5b_0%,#ff6b35_65%,#ffd0bc_100%)] transition-all"
              style={{ width: `${progressPercent}%` }}
            >
              <span className="absolute inset-y-0 right-0 w-10 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.42)_100%)]" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2">
            {steps.map((item, index) => {
              const isDone = index < step;
              const isCurrent = index === step;

              return (
                <div
                  key={item.id}
                  className={`rounded-[1.15rem] border px-2.5 py-3 transition ${
                    isCurrent
                      ? "border-[#ff9b74] bg-[#ff8a5b] text-white shadow-[0_14px_28px_rgba(255,107,53,0.22)]"
                      : isDone
                        ? "border-[#f0d4c8] bg-[#fff5ef] text-[#a45735]"
                        : "border-[#e7ddd6] bg-[#f3f1ee] text-[#7f7f88]"
                  }`}
                >
                  <span
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                      isCurrent ? "bg-white/18 text-white" : isDone ? "bg-[#ff8a5b] text-white" : "bg-white text-[#8b8b92]"
                    }`}
                  >
                    {isDone ? <Check className="h-4 w-4" /> : index + 1}
                  </span>
                  <p className="mt-2 text-[11px] font-semibold leading-tight sm:text-xs">{item.title}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card space-y-5 p-5">
          {currentStep?.id === "role" ? (
            <>
              <div>
                <p className="text-sm font-semibold text-[#dc4f1f]">{copy.choosePath}</p>
                <p className="mt-1 text-sm text-[#62626d]">{roleCopy}</p>
              </div>

              <div className="grid gap-3">
                {[
                  { role: "reviewer" as const, title: copy.reviewerTitle, description: copy.reviewerDescription },
                  { role: "provider" as const, title: copy.providerTitle, description: copy.providerDescription },
                ].map((option) => (
                  <button
                    key={option.role}
                    type="button"
                    onClick={() => updateValue("role", option.role)}
                    className={`rounded-[1.4rem] border p-4 text-left transition ${
                      values.role === option.role ? "border-[#ff6b35] bg-[#fff3ec]" : "border-[#e5e5df] bg-white"
                    }`}
                  >
                    <p className="font-semibold">{option.title}</p>
                    <p className="mt-1 text-sm text-[#62626d]">{option.description}</p>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {currentStep?.id === "profile" ? (
            <>
              <div>
                <p className="text-sm font-semibold text-[#dc4f1f]">{copy.essentials}</p>
                <p className="mt-1 text-sm text-[#62626d]">{copy.essentialsBody}</p>
              </div>

              <div className="grid gap-3">
                <input className="input" value={values.firstName} onChange={(event) => updateValue("firstName", event.target.value)} placeholder={copy.firstName} />
                <input className="input" value={values.lastName} onChange={(event) => updateValue("lastName", event.target.value)} placeholder={copy.lastName} />
                <input className="input" value={values.phone} onChange={(event) => updateValue("phone", event.target.value)} placeholder={copy.phone} />
                <div className="rounded-2xl border border-dashed border-[#e5e5df] bg-[#f8f4ef] p-3 text-sm text-[#62626d]">
                  <p className="font-semibold text-[#131316]">{copy.accessEmail}</p>
                  <p className="mt-1">{email || copy.noEmail}</p>
                </div>
              </div>
            </>
          ) : null}

          {currentStep?.id === "focus" ? (
            <>
              <div className="rounded-[1.75rem] border border-[#f2d3c4] bg-[linear-gradient(180deg,#fff6f1_0%,#fffdf9_100%)] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[#dc4f1f]">
                      {values.role === "reviewer" ? copy.reviewerInterestTitle : copy.providerInterestTitle}
                    </p>
                    <p className="mt-1 text-sm text-[#62626d]">
                      {values.role === "reviewer" ? copy.reviewerInterestBody : copy.providerInterestBody}
                    </p>
                  </div>
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#ff6b35] shadow-sm">
                    <Stars className="h-5 w-5" />
                  </span>
                </div>

                <div className="mt-4 rounded-[1.5rem] bg-[#1e1712] p-4 text-white">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/55">
                    <MapPin className="h-4 w-4" />
                    {copy.mainRegion}
                  </div>
                  <p className="mt-3 text-lg font-bold">{selectedCountryLabel}</p>
                  <p className="mt-1 text-sm text-white/65">{copy.mainRegionBody}</p>
                  <div className="mt-4">
                    <CompactSelect
                      tone="dark"
                      value={values.country}
                      onChange={(nextValue) => updateValue("country", nextValue)}
                      placeholder={copy.noCountrySelected}
                      options={[
                        { value: "", label: copy.noCountrySelected },
                        ...COUNTRY_OPTIONS.map((country) => ({ value: country, label: country })),
                      ]}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-[#eadfd6] bg-[#fcfaf7] p-4">
                <p className="text-sm font-semibold text-[#131316]">{copy.experienceLevel ?? "Nivel de experiencia"}</p>
                <p className="mt-1 text-sm text-[#62626d]">
                  {copy.experienceLevelBody ?? "Elige el punto que mejor describe en que etapa te encuentras ahora."}
                </p>
                <div className="mt-4">
                  <CompactSelect
                    value={values.experienceLevel}
                    onChange={(nextValue) => updateValue("experienceLevel", nextValue as ExperienceLevel)}
                    options={(["new", "growing", "advanced"] as ExperienceLevel[]).map((level) => ({
                      value: level,
                      label: EXPERIENCE_LABELS[level],
                    }))}
                  />
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-[#eadfd6] bg-[#fcfaf7] p-4">
                <p className="text-sm font-semibold text-[#131316]">{copy.visibilityContactTitle}</p>
                <p className="mt-1 text-sm text-[#62626d]">
                  {values.role === "reviewer" ? copy.reviewerContactHelp : copy.providerContactHelp}
                </p>

                <div className="mt-4 grid gap-3">
                  <label className="flex items-start gap-3 rounded-2xl border border-[#e5e5df] bg-white p-4 text-sm">
                    <input
                      type="checkbox"
                      checked={values.publicProfile}
                      onChange={(event) => updateValue("publicProfile", event.target.checked)}
                      className="mt-1"
                    />
                    <span>{values.role === "reviewer" ? copy.showProfileReviewer : copy.showProfileProvider}</span>
                  </label>
                  <label className="flex items-start gap-3 rounded-2xl border border-[#e5e5df] bg-white p-4 text-sm">
                    <input
                      type="checkbox"
                      checked={values.allowsDirectContact}
                      onChange={(event) => updateValue("allowsDirectContact", event.target.checked)}
                      className="mt-1"
                    />
                    <span>{copy.allowDirectContact}</span>
                  </label>
                </div>

                {values.allowsDirectContact ? (
                  <div className="mt-4 grid gap-3">
                    <input
                      className="input"
                      value={values.contactWhatsapp}
                      onChange={(event) => updateValue("contactWhatsapp", event.target.value)}
                      placeholder={copy.whatsappPlaceholder}
                    />
                    <input
                      className="input"
                      value={values.contactInstagram}
                      onChange={(event) => updateValue("contactInstagram", event.target.value)}
                      placeholder={copy.instagramPlaceholder}
                    />
                    <input
                      className="input"
                      value={values.contactMessenger}
                      onChange={(event) => updateValue("contactMessenger", event.target.value)}
                      placeholder={copy.messengerPlaceholder}
                    />
                  </div>
                ) : null}
              </div>

              <div className="rounded-[1.75rem] border border-[#eadfd6] bg-[#fcfaf7] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[#131316]">
                      {values.role === "reviewer" ? copy.interestMap : copy.productMap}
                    </p>
                    <p className="mt-1 text-sm text-[#62626d]">
                      {values.role === "reviewer" ? copy.interestMapBody : copy.productMapBody}
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#dc4f1f] shadow-sm">
                    <Compass className="h-4 w-4" />
                    {values.interests.length} {copy.selected}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={toggleAllInterests}
                    className={`col-span-full rounded-[1.25rem] border px-4 py-3 text-left text-sm font-semibold transition ${
                      values.interests.length === INTEREST_OPTIONS.length
                        ? "border-[#ff6b35] bg-[linear-gradient(135deg,#ff6b35_0%,#ff8b5e_100%)] text-white shadow-[0_14px_26px_rgba(255,107,53,0.22)]"
                        : "border-[#f3d0c1] bg-[#fff5ef] text-[#dc4f1f]"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span>{values.interests.length === INTEREST_OPTIONS.length ? copy.clearSelection : copy.selectAll}</span>
                      {values.interests.length === INTEREST_OPTIONS.length ? <Check className="h-4 w-4" /> : null}
                    </span>
                  </button>
                  {interestOptions.map((option) => {
                    const active = values.interests.includes(option.value);

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => toggleInterest(option.value)}
                        className={`rounded-[1.25rem] border px-4 py-3 text-left text-sm font-semibold transition ${
                          active
                            ? "border-[#ff6b35] bg-[linear-gradient(135deg,#ff6b35_0%,#ff8b5e_100%)] text-white shadow-[0_14px_26px_rgba(255,107,53,0.22)]"
                            : "border-[#ebe4db] bg-white text-[#131316]"
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span>{option.label}</span>
                          {active ? <Check className="h-4 w-4" /> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <textarea
                className="input min-h-28 resize-none"
                value={values.note}
                onChange={(event) => updateValue("note", event.target.value)}
                placeholder={values.role === "reviewer" ? copy.reviewerNote : copy.providerNote}
              />
            </>
          ) : null}

          {currentStep?.id === "confirm" ? (
            <>
              <div>
                <p className="text-sm font-semibold text-[#dc4f1f]">{copy.summary}</p>
                <p className="mt-1 text-sm text-[#62626d]">{copy.summaryBody}</p>
              </div>

              <div className="rounded-[1.5rem] bg-[#f8f4ef] p-4">
                <p className="text-sm text-[#62626d]">{copy.role}</p>
                <p className="font-semibold capitalize">{values.role}</p>
                <p className="mt-3 text-sm text-[#62626d]">{copy.profile}</p>
                <p className="font-semibold">
                  {values.firstName} {values.lastName}
                </p>
                <p className="text-sm text-[#62626d]">{values.country || copy.pendingCountry}</p>
                <p className="mt-3 text-sm text-[#62626d]">{values.role === "reviewer" ? copy.interests : copy.productCategories}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {values.interests.map((interest) => (
                    <span key={interest} className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-[#dc4f1f]">
                      {getInterestLabel(interest, language)}
                    </span>
                  ))}
                </div>
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-[#e5e5df] p-4 text-sm">
                <input type="checkbox" checked={values.acceptTerms} onChange={(event) => updateValue("acceptTerms", event.target.checked)} className="mt-1" />
                <span>{copy.terms}</span>
              </label>
            </>
          ) : null}

          {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
        </div>
      </div>

      <div className="sticky bottom-0 z-10 mt-4 grid grid-cols-[auto_1fr] gap-3 rounded-[1.6rem] border border-[#e5e5df] bg-white/95 p-3 backdrop-blur">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setStep((current) => Math.max(current - 1, 0));
          }}
          disabled={step === 0 || loading}
          className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#e5e5df] disabled:opacity-40"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <button type="button" onClick={handleNext} disabled={loading} className="btn-primary h-12 w-full gap-2">
          <span>{loading ? copy.activating : isLastStep ? copy.activateProfile : copy.continue}</span>
          {!loading ? <ChevronRight className="h-4 w-4" /> : null}
        </button>
      </div>
    </div>
  );
}
