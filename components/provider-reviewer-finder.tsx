"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { Search, Sparkles } from "lucide-react";
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
      <section className="overflow-hidden rounded-[2rem] border border-[#ecd8cb] bg-[radial-gradient(circle_at_top_left,#fff9f5_0%,#fff2e7_42%,#fffdfb_100%)] p-5 shadow-[0_28px_70px_rgba(220,79,31,0.08)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#dc4f1f]">Discovery Studio</p>
            <h2 className="mt-2 text-3xl font-bold">Encuentra reviewers alineados con tus productos</h2>
            <p className="mt-2 max-w-2xl text-sm text-[#62626d]">
              Tus mismas etiquetas se usan como categorias de producto. El sistema prioriza compatibilidad por categoria, pais y disponibilidad.
            </p>
          </div>
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#dc4f1f] shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-5 rounded-[1.6rem] border border-white/80 bg-white/80 p-4 backdrop-blur">
          <div className="rounded-[1.2rem] border border-[#f0d9cc] bg-white px-4 py-3">
            <label className="flex items-center gap-3">
              <Search className="h-4 w-4 text-[#dc4f1f]" />
              <input
                className="w-full bg-transparent text-sm outline-none"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nombre, categoria, pais o descripcion"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8f857b]">Tus categorias</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {providerInterests.length ? (
                  providerInterests.map((interest) => (
                    <span key={interest} className="rounded-full bg-[#fff2eb] px-3 py-2 text-xs font-semibold text-[#dc4f1f]">
                      {interest}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-[#8f857b]">Todavia no has definido categorias de producto en tu perfil.</span>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8f857b]">Filtrar por pais</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCountry("")}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    !selectedCountry ? "bg-[#ff6b35] text-white" : "border border-[#eadfd6] bg-white text-[#62564a]"
                  }`}
                >
                  Todos
                </button>
                {COUNTRY_OPTIONS.map((country) => (
                  <button
                    key={country}
                    type="button"
                    onClick={() => setSelectedCountry(country)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      selectedCountry === country ? "bg-[#ff6b35] text-white" : "border border-[#eadfd6] bg-white text-[#62564a]"
                    }`}
                  >
                    {country}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8f857b]">Filtrar por categoria</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedInterest("")}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    !selectedInterest ? "bg-[#ff6b35] text-white" : "border border-[#eadfd6] bg-white text-[#62564a]"
                  }`}
                >
                  Todas
                </button>
                {INTEREST_OPTIONS.map((interest) => (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => setSelectedInterest(interest)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      selectedInterest === interest ? "bg-[#ff6b35] text-white" : "border border-[#eadfd6] bg-white text-[#62564a]"
                    }`}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8f857b]">Disponibilidad</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedAvailability("")}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    !selectedAvailability ? "bg-[#ff6b35] text-white" : "border border-[#eadfd6] bg-white text-[#62564a]"
                  }`}
                >
                  Toda
                </button>
                {AVAILABILITY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSelectedAvailability(option.value)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      selectedAvailability === option.value ? "bg-[#ff6b35] text-white" : "border border-[#eadfd6] bg-white text-[#62564a]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
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
            <article key={reviewer.id} className="overflow-hidden rounded-[1.6rem] border border-[#e6ddd1] bg-[linear-gradient(180deg,#ffffff_0%,#fffdfa_100%)] shadow-[0_18px_36px_rgba(22,18,14,0.04)]">
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
                  <p className="text-xs uppercase tracking-[0.18em] text-[#8f857b]">Afinidad</p>
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

                  <div className="mt-4 rounded-[1.35rem] border border-[#eadfd6] bg-[linear-gradient(180deg,#fcfaf7_0%,#fff5ef_100%)] p-4">
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
