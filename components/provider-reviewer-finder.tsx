"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { COUNTRY_OPTIONS, EXPERIENCE_LABELS, INTEREST_OPTIONS } from "@/lib/onboarding";
import { AVAILABILITY_OPTIONS, type ReviewerAvailability } from "@/lib/profile-data";

type ReviewerDirectoryItem = {
  id: string;
  fullName: string;
  firstName: string;
  country: string;
  experienceLevel: "new" | "growing" | "advanced";
  interests: string[];
  note: string;
  availability: ReviewerAvailability;
  allowsDirectContact: boolean;
  directContactMethods: Array<{ label: string; value: string }>;
  isVerified: boolean;
  isActiveMember: boolean;
  score: number;
};

type SentRequest = {
  reviewer_id: string;
  status: string;
  message: string | null;
};

type ProviderReviewerFinderProps = {
  reviewers: ReviewerDirectoryItem[];
  sentRequests: SentRequest[];
  providerInterests: string[];
};

function toHref(value: string) {
  const trimmed = value.trim();

  if (!trimmed) return "#";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const normalizedPhone = trimmed.replace(/[^\d+]/g, "");
  if (/^\+?\d{7,15}$/.test(normalizedPhone)) {
    return `https://wa.me/${normalizedPhone.replace(/^\+/, "")}`;
  }

  return `https://${trimmed}`;
}

export function ProviderReviewerFinder({ reviewers, sentRequests, providerInterests }: ProviderReviewerFinderProps) {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [selectedInterest, setSelectedInterest] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedAvailability, setSelectedAvailability] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(reviewers[0]?.id ?? null);
  const [draftMessages, setDraftMessages] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [requestState, setRequestState] = useState<Record<string, { status: string; message: string | null }>>(
    Object.fromEntries(sentRequests.map((request) => [request.reviewer_id, { status: request.status, message: request.message }]))
  );
  const [isPending, startTransition] = useTransition();
  const deferredQuery = useDeferredValue(query);

  const filteredReviewers = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return reviewers.filter((reviewer) => {
      if (selectedInterest && !reviewer.interests.includes(selectedInterest)) {
        return false;
      }

      if (selectedCountry && reviewer.country !== selectedCountry) {
        return false;
      }

      if (selectedAvailability && reviewer.availability !== selectedAvailability) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        reviewer.fullName,
        reviewer.country,
        reviewer.note,
        reviewer.experienceLevel,
        reviewer.availability,
        ...reviewer.interests,
        ...reviewer.directContactMethods.map((item) => item.value),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [deferredQuery, reviewers, selectedAvailability, selectedCountry, selectedInterest]);

  function submitRequest(reviewerId: string) {
    setError(null);
    setPendingAction(reviewerId);

    startTransition(async () => {
      const message = draftMessages[reviewerId]?.trim() || "";
      const { data: userResult, error: userError } = await supabase.auth.getUser();

      if (userError || !userResult.user) {
        setError("No se pudo validar tu sesion.");
        setPendingAction(null);
        return;
      }

      const { error: requestError } = await supabase.from("reviewer_contact_requests").upsert({
        provider_id: userResult.user.id,
        reviewer_id: reviewerId,
        message,
        status: "sent",
        updated_at: new Date().toISOString(),
      });

      if (requestError) {
        setError(requestError.message);
        setPendingAction(null);
        return;
      }

      setRequestState((current) => ({
        ...current,
        [reviewerId]: {
          status: "sent",
          message,
        },
      }));
      setPendingAction(null);
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[1.8rem] border border-[#ecd8cb] bg-[linear-gradient(180deg,#fff7f2_0%,#ffffff_100%)] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#dc4f1f]">Matching inteligente</p>
            <h2 className="mt-2 text-2xl font-bold">Encuentra reviewers alineados contigo</h2>
            <p className="mt-2 text-sm text-[#62626d]">
              Usamos coincidencia de intereses, pais, nivel y disponibilidad para ordenar mejores perfiles primero.
            </p>
          </div>
          <div className="rounded-[1.2rem] bg-white px-4 py-3 text-right shadow-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-[#8f857b]">Tus intereses</p>
            <p className="mt-2 text-sm font-semibold text-[#131316]">{providerInterests.length ? providerInterests.join(", ") : "Sin etiquetas"}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, interes o nota" />
          <select className="input" value={selectedCountry} onChange={(event) => setSelectedCountry(event.target.value)}>
            <option value="">Todos los paises</option>
            {COUNTRY_OPTIONS.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
          <select className="input" value={selectedInterest} onChange={(event) => setSelectedInterest(event.target.value)}>
            <option value="">Todos los intereses</option>
            {INTEREST_OPTIONS.map((interest) => (
              <option key={interest} value={interest}>
                {interest}
              </option>
            ))}
          </select>
          <select className="input" value={selectedAvailability} onChange={(event) => setSelectedAvailability(event.target.value)}>
            <option value="">Toda disponibilidad</option>
            {AVAILABILITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3 text-sm text-[#62626d]">
        <span>{filteredReviewers.length} reviewers encontrados</span>
        {(query || selectedCountry || selectedInterest || selectedAvailability) ? (
          <button
            type="button"
            className="font-semibold text-[#dc4f1f]"
            onClick={() => {
              setQuery("");
              setSelectedCountry("");
              setSelectedInterest("");
              setSelectedAvailability("");
            }}
          >
            Limpiar filtros
          </button>
        ) : null}
      </div>

      <div className="space-y-3">
        {filteredReviewers.map((reviewer) => {
          const currentRequest = requestState[reviewer.id];
          const isExpanded = expandedId === reviewer.id;

          return (
            <article key={reviewer.id} className="overflow-hidden rounded-[1.5rem] border border-[#e6ddd1] bg-white">
              <button
                type="button"
                className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left"
                onClick={() => setExpandedId((current) => (current === reviewer.id ? null : reviewer.id))}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold">{reviewer.fullName}</h3>
                    {reviewer.isVerified ? (
                      <span className="rounded-full bg-[#eef9f0] px-3 py-1 text-xs font-semibold text-[#1f7a4d]">Verificado</span>
                    ) : null}
                    {currentRequest ? (
                      <span className="rounded-full bg-[#fff3ec] px-3 py-1 text-xs font-semibold text-[#dc4f1f]">
                        Solicitud {currentRequest.status}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-[#62626d]">
                    {reviewer.country || "Sin pais"} · {EXPERIENCE_LABELS[reviewer.experienceLevel]} · {AVAILABILITY_OPTIONS.find((item) => item.value === reviewer.availability)?.label}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {reviewer.interests.slice(0, 4).map((interest) => (
                      <span key={interest} className="rounded-full border border-[#ece3d9] bg-[#fcfaf7] px-3 py-1 text-xs font-semibold text-[#62564a]">
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#8f857b]">Score</p>
                  <p className="mt-1 text-2xl font-bold text-[#131316]">{reviewer.score}</p>
                </div>
              </button>

              {isExpanded ? (
                <div className="border-t border-[#eee3d8] px-4 py-4">
                  <p className="text-sm text-[#62626d]">{reviewer.note || "Este reviewer aun no ha completado una bio detallada."}</p>

                  {reviewer.allowsDirectContact && reviewer.directContactMethods.length ? (
                    <div className="mt-4">
                      <p className="text-sm font-semibold text-[#131316]">Contacto directo</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {reviewer.directContactMethods.map((method) => (
                          <a key={`${reviewer.id}-${method.label}`} href={toHref(method.value)} target="_blank" rel="noreferrer" className="btn-secondary">
                            {method.label}
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 rounded-[1.2rem] border border-[#eadfd6] bg-[#fcfaf7] p-4">
                    <p className="text-sm font-semibold text-[#131316]">Contactar a traves de la pagina</p>
                    <p className="mt-1 text-sm text-[#62626d]">
                      Envia una solicitud breve. El reviewer la vera en su panel y podra responder desde la plataforma.
                    </p>
                    <textarea
                      className="input mt-3 min-h-28 resize-none"
                      value={draftMessages[reviewer.id] || currentRequest?.message || ""}
                      onChange={(event) =>
                        setDraftMessages((current) => ({
                          ...current,
                          [reviewer.id]: event.target.value,
                        }))
                      }
                      placeholder="Describe el producto, categoria y por que este reviewer encaja contigo."
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={isPending && pendingAction === reviewer.id}
                        onClick={() => submitRequest(reviewer.id)}
                      >
                        {isPending && pendingAction === reviewer.id
                          ? "Enviando..."
                          : currentRequest
                            ? "Actualizar solicitud"
                            : "Enviar solicitud"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
    </div>
  );
}
