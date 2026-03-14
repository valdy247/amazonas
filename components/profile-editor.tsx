"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { COUNTRY_OPTIONS, EXPERIENCE_LABELS, INTEREST_OPTIONS, type ExperienceLevel, type UserRole } from "@/lib/onboarding";

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
  };
};

const phoneRegex = /^\+?[0-9()\-\s]{8,20}$/;

export function ProfileEditor({ email, initialValues }: ProfileEditorProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [values, setValues] = useState(initialValues);

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

    if (!values.firstName.trim() || !values.lastName.trim()) {
      setError("Completa nombre y apellidos.");
      return;
    }

    if (!phoneRegex.test(values.phone.trim())) {
      setError("Ingresa un telefono valido.");
      return;
    }

    if (!values.country) {
      setError("Selecciona tu pais principal.");
      return;
    }

    if (values.interests.length < 3) {
      setError("Selecciona al menos 3 intereses.");
      return;
    }

    setLoading(true);

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

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone: values.phone.trim(),
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
      },
    });

    if (metadataError) {
      setError(metadataError.message);
      setLoading(false);
      return;
    }

    setSaved("Perfil actualizado.");
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-4">
      <section className="card p-5">
        <p className="text-sm font-semibold text-[#dc4f1f]">Editar perfil</p>
        <h1 className="mt-2 text-3xl font-bold">Ajusta tu informacion</h1>
        <p className="mt-2 text-sm text-[#62626d]">
          Puedes mejorar tu perfil sin rehacer el onboarding. El rol queda bloqueado para mantener la coherencia del flujo.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <div className="rounded-full border border-[#e5e5df] bg-[#f8f4ef] px-4 py-2 text-sm">
            Rol: <span className="font-semibold capitalize">{values.role}</span>
          </div>
          <div className="rounded-full border border-[#e5e5df] bg-white px-4 py-2 text-sm text-[#62626d]">
            {email || "Sin correo disponible"}
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-xl font-bold">Datos base</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input className="input" value={values.firstName} onChange={(event) => updateValue("firstName", event.target.value)} placeholder="Nombre" />
          <input className="input" value={values.lastName} onChange={(event) => updateValue("lastName", event.target.value)} placeholder="Apellidos" />
        </div>
        <div className="mt-3">
          <input className="input" value={values.phone} onChange={(event) => updateValue("phone", event.target.value)} placeholder="Telefono" />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-xl font-bold">Enfoque</h2>
        <div className="mt-4 grid gap-3">
          <select className="input" value={values.country} onChange={(event) => updateValue("country", event.target.value)}>
            <option value="">Selecciona tu pais</option>
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
              values.role === "tester"
                ? "Describe que tipo de productos te gusta probar y donde aportas mas valor."
                : "Describe que tipo de testers buscas, categorias clave y enfoque de colaboracion."
            }
          />
        </div>
      </section>

      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
      {saved ? <p className="text-sm font-semibold text-emerald-700">{saved}</p> : null}

      <div className="sticky bottom-0 rounded-[1.6rem] border border-[#e5e5df] bg-white/95 p-3 backdrop-blur">
        <button type="submit" disabled={loading} className="btn-primary h-12 w-full">
          {loading ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
