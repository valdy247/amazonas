"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Compass, MapPin, Sparkles, Stars } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { COUNTRY_OPTIONS, EXPERIENCE_LABELS, INTEREST_OPTIONS, type ExperienceLevel, type UserRole } from "@/lib/onboarding";

type WizardValues = {
  role: UserRole;
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  experienceLevel: ExperienceLevel;
  interests: string[];
  note: string;
  acceptTerms: boolean;
};

type ProfileWizardProps = {
  initialValues: Partial<WizardValues>;
  email?: string | null;
};

const baseSteps = [
  { id: "role", title: "Tu camino", description: "Define como vas a usar la plataforma." },
  { id: "profile", title: "Perfil base", description: "Datos minimos para arrancar desde mobile." },
  { id: "focus", title: "Intereses", description: "Etiquetas para personalizar tu experiencia." },
  { id: "confirm", title: "Confirmar", description: "Revisa y activa tu perfil." },
] as const;

const phoneRegex = /^\+?[0-9()\-\s]{8,20}$/;

function normalizeInterests(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function ProfileWizard({ initialValues, email }: ProfileWizardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<WizardValues>({
    role: initialValues.role || "tester",
    firstName: initialValues.firstName || "",
    lastName: initialValues.lastName || "",
    phone: initialValues.phone || "",
    country: initialValues.country || "",
    experienceLevel: initialValues.experienceLevel || "new",
    interests: normalizeInterests(initialValues.interests),
    note: initialValues.note || "",
    acceptTerms: Boolean(initialValues.acceptTerms),
  });
  const hasEssentialProfile = Boolean(values.firstName.trim() && values.lastName.trim() && phoneRegex.test(values.phone.trim()));
  const steps = useMemo(
    () => baseSteps.filter((step) => (step.id === "profile" ? !hasEssentialProfile : true)),
    [hasEssentialProfile]
  );
  const [step, setStep] = useState(0);

  const currentStep = steps[step];
  const isLastStep = step === steps.length - 1;
  const selectedCountryLabel = values.country || "Sin pais seleccionado";
  const roleCopy =
    values.role === "tester"
      ? "Te ayudaremos a construir un perfil claro para encontrar oportunidades alineadas."
      : "Activaremos un perfil orientado a descubrir testers segun las categorias que te interesan.";

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

  function validateCurrentStep() {
    if (!currentStep) {
      return "No se pudo cargar este paso.";
    }

    if (currentStep.id === "profile") {
      if (!values.firstName.trim() || !values.lastName.trim()) {
        return "Completa nombre y apellidos.";
      }

      if (!phoneRegex.test(values.phone.trim())) {
        return "Ingresa un telefono valido.";
      }
    }

    if (currentStep.id === "focus") {
      if (!values.country) {
        return "Selecciona tu pais principal.";
      }

      if (values.interests.length < 3) {
        return "Selecciona al menos 3 intereses para que el matching tenga contexto.";
      }
    }

    if (currentStep.id === "confirm" && !values.acceptTerms) {
      return "Debes aceptar terminos y reglas para activar tu perfil.";
    }

    return null;
  }

  async function handleNext() {
    if (!currentStep) {
      setError("No se pudo cargar este paso.");
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
      setError("No se pudo validar tu sesion.");
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
    <div className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-md flex-col justify-between py-4">
      <div className="space-y-4">
        <div className="card overflow-hidden border-none bg-[linear-gradient(140deg,#1a1713,#33261a)] p-5 text-white shadow-[0_24px_80px_rgba(34,25,17,0.18)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-white/65">Onboarding</p>
              <h1 className="mt-2 text-3xl font-bold">Perfil paso a paso</h1>
              <p className="mt-2 max-w-xs text-sm text-white/72">{currentStep.description}</p>
            </div>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
              <Sparkles className="h-5 w-5" />
            </span>
          </div>

          <div className="mt-5 flex gap-2">
            {steps.map((item, index) => (
              <div key={item.id} className="h-2 flex-1 rounded-full bg-white/12">
                <div
                  className="h-full rounded-full bg-[#ff8a5b] transition-all"
                  style={{ width: index <= step ? "100%" : "0%" }}
                />
              </div>
            ))}
          </div>

          <p className="mt-3 text-sm text-white/72">
            Paso {step + 1} de {steps.length}: {currentStep?.title}
          </p>
        </div>

        <div className="card space-y-5 p-5">
          {currentStep?.id === "role" ? (
            <>
              <div>
                <p className="text-sm font-semibold text-[#dc4f1f]">Elige tu ruta inicial</p>
                <p className="mt-1 text-sm text-[#62626d]">{roleCopy}</p>
              </div>

              <div className="grid gap-3">
                {[
                  {
                    role: "tester" as const,
                    title: "Soy tester",
                    description: "Voy a completar mi perfil para recibir oportunidades alineadas con mis intereses.",
                  },
                  {
                    role: "provider" as const,
                    title: "Soy proveedor",
                    description: "Quiero entrar sin friccion y preparar mi perfil para buscar testers relevantes.",
                  },
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
                <p className="text-sm font-semibold text-[#dc4f1f]">Completa lo esencial</p>
                <p className="mt-1 text-sm text-[#62626d]">
                  Este paso debe sentirse rapido en movil, sin campos innecesarios.
                </p>
              </div>

              <div className="grid gap-3">
                <input
                  className="input"
                  value={values.firstName}
                  onChange={(event) => updateValue("firstName", event.target.value)}
                  placeholder="Nombre"
                />
                <input
                  className="input"
                  value={values.lastName}
                  onChange={(event) => updateValue("lastName", event.target.value)}
                  placeholder="Apellidos"
                />
                <input
                  className="input"
                  value={values.phone}
                  onChange={(event) => updateValue("phone", event.target.value)}
                  placeholder="Telefono"
                />
                <div className="rounded-2xl border border-dashed border-[#e5e5df] bg-[#f8f4ef] p-3 text-sm text-[#62626d]">
                  <p className="font-semibold text-[#131316]">Correo de acceso</p>
                  <p className="mt-1">{email || "Sin correo disponible"}</p>
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
                      {values.role === "tester" ? "Que te interesa probar" : "Que categorias quieres trabajar"}
                    </p>
                    <p className="mt-1 text-sm text-[#62626d]">
                      Estas etiquetas nos ayudan a personalizar el dashboard y futuros matches.
                    </p>
                  </div>
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#ff6b35] shadow-sm">
                    <Stars className="h-5 w-5" />
                  </span>
                </div>

                <div className="mt-4 rounded-[1.5rem] bg-[#1e1712] p-4 text-white">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/55">
                    <MapPin className="h-4 w-4" />
                    Region principal
                  </div>
                  <p className="mt-3 text-lg font-bold">{selectedCountryLabel}</p>
                  <p className="mt-1 text-sm text-white/65">
                    Elegimos un pais base para mostrar oportunidades y matches relevantes primero.
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {COUNTRY_OPTIONS.map((country) => {
                      const active = values.country === country;

                      return (
                        <button
                          key={country}
                          type="button"
                          onClick={() => updateValue("country", country)}
                          className={`rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition ${
                            active
                              ? "border-[#ff8a5b] bg-[#ff8a5b] text-white"
                              : "border-white/12 bg-white/6 text-white/82"
                          }`}
                        >
                          {country}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

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

              <div className="rounded-[1.75rem] border border-[#eadfd6] bg-[#fcfaf7] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[#131316]">Mapa de intereses</p>
                    <p className="mt-1 text-sm text-[#62626d]">Selecciona al menos 3 para entrenar mejor tu perfil.</p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#dc4f1f] shadow-sm">
                    <Compass className="h-4 w-4" />
                    {values.interests.length} seleccionados
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {INTEREST_OPTIONS.map((option) => {
                    const active = values.interests.includes(option);

                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => toggleInterest(option)}
                        className={`rounded-[1.25rem] border px-4 py-3 text-left text-sm font-semibold transition ${
                          active
                            ? "border-[#ff6b35] bg-[linear-gradient(135deg,#ff6b35_0%,#ff8b5e_100%)] text-white shadow-[0_14px_26px_rgba(255,107,53,0.22)]"
                            : "border-[#ebe4db] bg-white text-[#131316]"
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span>{option}</span>
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
                placeholder={
                  values.role === "tester"
                    ? "Cuentanos que tipo de productos te gusta reseñar o en que eres fuerte."
                    : "Describe que tipo de testers o categorias buscas primero."
                }
              />
            </>
          ) : null}

          {currentStep?.id === "confirm" ? (
            <>
              <div>
                <p className="text-sm font-semibold text-[#dc4f1f]">Resumen rapido</p>
                <p className="mt-1 text-sm text-[#62626d]">
                  El objetivo es activar tu perfil sin friccion y dejar una base clara para agregar pasos despues.
                </p>
              </div>

              <div className="rounded-[1.5rem] bg-[#f8f4ef] p-4">
                <p className="text-sm text-[#62626d]">Rol</p>
                <p className="font-semibold capitalize">{values.role}</p>
                <p className="mt-3 text-sm text-[#62626d]">Perfil</p>
                <p className="font-semibold">
                  {values.firstName} {values.lastName}
                </p>
                <p className="text-sm text-[#62626d]">{values.country || "Pais pendiente"}</p>
                <p className="mt-3 text-sm text-[#62626d]">Etiquetas</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {values.interests.map((interest) => (
                    <span key={interest} className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-[#dc4f1f]">
                      {interest}
                    </span>
                  ))}
                </div>
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-[#e5e5df] p-4 text-sm">
                <input
                  type="checkbox"
                  checked={values.acceptTerms}
                  onChange={(event) => updateValue("acceptTerms", event.target.checked)}
                  className="mt-1"
                />
                <span>Acepto terminos, privacidad y reglas de cumplimiento para activar mi acceso.</span>
              </label>
            </>
          ) : null}

          {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
        </div>
      </div>

      <div className="sticky bottom-0 mt-4 grid grid-cols-[auto_1fr] gap-3 rounded-[1.6rem] border border-[#e5e5df] bg-white/95 p-3 backdrop-blur">
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
          <span>{loading ? "Guardando..." : isLastStep ? "Activar perfil" : "Continuar"}</span>
          {!loading ? <ChevronRight className="h-4 w-4" /> : null}
        </button>
      </div>
    </div>
  );
}
