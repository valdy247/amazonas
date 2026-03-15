"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { NotebookTabs, Sparkles, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { EXPERIENCE_LABELS } from "@/lib/onboarding";
import { AVAILABILITY_OPTIONS, type ReviewerAvailability } from "@/lib/profile-data";
import {
  buildContactRequestMessage,
  CONTACT_REQUEST_CHANNEL_OPTIONS,
  CONTACT_REQUEST_INTENT_OPTIONS,
  CONTACT_REQUEST_TIMELINE_OPTIONS,
  DEFAULT_CONTACT_REQUEST_DATA,
  getRequestStatusLabel,
  normalizeContactRequestData,
  type ContactRequestData,
} from "@/lib/contact-requests";

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
  matchPercent: number;
};

type SentRequest = {
  id: number;
  reviewer_id: string;
  status: string;
  message: string | null;
  request_data?: unknown;
  response_message?: string | null;
  created_at?: string;
  updated_at?: string;
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

function normalizeFilterValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function mergeProfileSnapshotCountry(profileData: unknown, metadata: Record<string, unknown> | undefined) {
  if (profileData && typeof profileData === "object" && typeof (profileData as { country?: unknown }).country === "string") {
    return ((profileData as { country?: string }).country || "").trim();
  }

  if (metadata && typeof metadata.country === "string") {
    return metadata.country.trim();
  }

  return "";
}

export function ProviderReviewerFinder({ reviewers, sentRequests, providerInterests }: ProviderReviewerFinderProps) {
  const supabase = createClient();
  const reviewerRefs = useRef<Record<string, HTMLElement | null>>({});
  const [selectedInterest, setSelectedInterest] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(reviewers[0]?.id ?? null);
  const [contactOptionsId, setContactOptionsId] = useState<string | null>(null);
  const [platformFormId, setPlatformFormId] = useState<string | null>(null);
  const [draftRequests, setDraftRequests] = useState<Record<string, ContactRequestData>>(
    Object.fromEntries(
      reviewers.map((reviewer) => [
        reviewer.id,
        {
          ...DEFAULT_CONTACT_REQUEST_DATA,
          category: providerInterests[0] || reviewer.interests[0] || "",
        },
      ])
    )
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [requestLog, setRequestLog] = useState<
    Array<{
      id: number;
      reviewerId: string;
      status: string;
      message: string | null;
      requestData: ContactRequestData;
      responseMessage: string | null;
      createdAt?: string;
      updatedAt?: string;
    }>
  >(
    sentRequests.map((request) => ({
      id: request.id,
      reviewerId: request.reviewer_id,
      status: request.status,
      message: request.message,
      requestData: normalizeContactRequestData(request.request_data),
      responseMessage: request.response_message || null,
      createdAt: request.created_at,
      updatedAt: request.updated_at,
    }))
  );
  const [isPending, startTransition] = useTransition();
  const availableCountries = useMemo(
    () => Array.from(new Set(reviewers.map((reviewer) => reviewer.country.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [reviewers]
  );
  const availableInterests = useMemo(
    () => Array.from(new Set(reviewers.flatMap((reviewer) => reviewer.interests).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [reviewers]
  );

  const recommendedReviewers = useMemo(
    () =>
      reviewers
        .filter((reviewer) => reviewer.matchPercent > 0)
        .slice(0, 4),
    [reviewers]
  );

  const latestRequestByReviewer = useMemo(
    () =>
      requestLog.reduce<Record<string, (typeof requestLog)[number]>>((current, request) => {
        const existing = current[request.reviewerId];
        const requestTime = new Date(request.updatedAt || request.createdAt || 0).getTime();
        const existingTime = existing ? new Date(existing.updatedAt || existing.createdAt || 0).getTime() : -1;

        if (!existing || requestTime >= existingTime) {
          current[request.reviewerId] = request;
        }

        return current;
      }, {}),
    [requestLog]
  );

  const filteredReviewers = useMemo(() => {
    return reviewers.filter((reviewer) => {
      if (selectedInterest && !reviewer.interests.some((interest) => normalizeFilterValue(interest) === normalizeFilterValue(selectedInterest))) {
        return false;
      }

      if (selectedCountry && normalizeFilterValue(reviewer.country) !== normalizeFilterValue(selectedCountry)) {
        return false;
      }

      return true;
    });
  }, [reviewers, selectedCountry, selectedInterest]);

  function submitRequest(reviewerId: string) {
    setError(null);
    setPendingAction(reviewerId);

    startTransition(async () => {
      const requestData = normalizeContactRequestData(draftRequests[reviewerId]);
      const message = buildContactRequestMessage(requestData);

      if (!requestData.productName.trim()) {
        setError("Escribe el nombre del producto o servicio que quieres presentar.");
        setPendingAction(null);
        return;
      }

      if (!requestData.category.trim()) {
        setError("Selecciona una categoria para contextualizar la solicitud.");
        setPendingAction(null);
        return;
      }

      const { data: userResult, error: userError } = await supabase.auth.getUser();

      if (userError || !userResult.user) {
        setError("No se pudo validar tu sesion.");
        setPendingAction(null);
        return;
      }

      const { data: providerProfile } = await supabase
        .from("profiles")
        .select("full_name, profile_data")
        .eq("id", userResult.user.id)
        .single();

      const providerSnapshot = {
        fullName:
          typeof providerProfile?.full_name === "string" && providerProfile.full_name.trim()
            ? providerProfile.full_name
            : typeof userResult.user.user_metadata?.full_name === "string"
              ? userResult.user.user_metadata.full_name
              : "Provider",
        country: mergeProfileSnapshotCountry(providerProfile?.profile_data, userResult.user.user_metadata),
        interests: Array.isArray(providerProfile?.profile_data && (providerProfile.profile_data as { interests?: unknown }).interests)
          ? ((providerProfile?.profile_data as { interests?: unknown }).interests as unknown[]).filter(
              (item): item is string => typeof item === "string"
            )
          : providerInterests,
      };

      const timestamp = new Date().toISOString();
      const { data: createdRequest, error: requestError } = await supabase
        .from("reviewer_contact_requests")
        .insert({
          provider_id: userResult.user.id,
          reviewer_id: reviewerId,
          message,
          request_data: {
            ...requestData,
            providerSnapshot,
          },
          status: "sent",
          updated_at: timestamp,
          last_activity_at: timestamp,
        })
        .select("id, reviewer_id, status, message, request_data, response_message, created_at, updated_at")
        .single();

      if (requestError) {
        setError(requestError.message);
        setPendingAction(null);
        return;
      }

      setRequestLog((current) => [
        {
          id: Number(createdRequest.id),
          reviewerId: String(createdRequest.reviewer_id),
          status: "sent",
          message,
          requestData,
          responseMessage: null,
          createdAt: String(createdRequest.created_at || timestamp),
          updatedAt: String(createdRequest.updated_at || timestamp),
        },
        ...current,
      ]);
      setPendingAction(null);
    });
  }

  function updateDraftRequest(reviewerId: string, patch: Partial<ContactRequestData>) {
    setDraftRequests((current) => ({
      ...current,
      [reviewerId]: {
        ...DEFAULT_CONTACT_REQUEST_DATA,
        ...(current[reviewerId] || {}),
        ...patch,
      },
    }));
  }

  function openContactOptions(reviewerId: string) {
    setContactOptionsId((current) => (current === reviewerId ? null : reviewerId));
    setPlatformFormId((current) => (current === reviewerId ? current : null));
  }

  function openReviewerContact(reviewerId: string) {
    setExpandedId(reviewerId);
    setContactOptionsId(reviewerId);
    setPlatformFormId(null);

    window.requestAnimationFrame(() => {
      reviewerRefs.current[reviewerId]?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[2rem] border border-[#ecd8cb] bg-[radial-gradient(circle_at_top_left,#fff9f5_0%,#fff2e7_42%,#fffdfb_100%)] p-5 shadow-[0_28px_70px_rgba(220,79,31,0.08)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#dc4f1f]">Discovery Studio</p>
            <h2 className="mt-2 text-3xl font-bold">Encuentra reviewers alineados con tus productos</h2>
            <p className="mt-2 max-w-2xl text-sm text-[#62626d]">Filtra por pais o categoria para descubrir reviewers que encajen con tu marca.</p>
          </div>
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#dc4f1f] shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-5 rounded-[1.6rem] border border-white/80 bg-white/80 p-4 backdrop-blur">
          <div className="grid gap-4">
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
                {availableCountries.map((country) => (
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
                {availableInterests.map((interest) => (
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

          </div>
        </div>
      </section>

      {recommendedReviewers.length ? (
        <section className="rounded-[1.8rem] border border-[#eadfd6] bg-white p-5 shadow-[0_18px_36px_rgba(22,18,14,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#dc4f1f]">Recomendados para ti</p>
              <h3 className="mt-1 text-xl font-bold">Reviewers con mejor encaje</h3>
            </div>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff3ec] text-[#dc4f1f]">
              <Star className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {recommendedReviewers.map((reviewer) => (
              <button
                key={`recommended-${reviewer.id}`}
                type="button"
                onClick={() => openReviewerContact(reviewer.id)}
                className="rounded-[1.4rem] border border-[#ece3d9] bg-[linear-gradient(180deg,#fff8f3_0%,#ffffff_100%)] p-4 text-left transition hover:border-[#ffcfbe]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{reviewer.fullName}</p>
                    <p className="mt-1 text-sm text-[#62626d]">{reviewer.country || "Sin pais"} · {EXPERIENCE_LABELS[reviewer.experienceLevel]}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#dc4f1f]">{reviewer.matchPercent}% compatible</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {reviewer.interests.slice(0, 3).map((interest) => (
                    <span key={`recommended-${reviewer.id}-${interest}`} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#62564a]">
                      {interest}
                    </span>
                  ))}
                </div>
                <span className="mt-4 inline-flex rounded-full bg-[#ff6b35] px-4 py-2 text-sm font-semibold text-white">Contactar</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex items-center justify-between gap-3 text-sm text-[#62626d]">
        <span>{filteredReviewers.length} reviewers encontrados</span>
        {(selectedCountry || selectedInterest) ? (
          <button
            type="button"
            className="font-semibold text-[#dc4f1f]"
            onClick={() => {
              setSelectedCountry("");
              setSelectedInterest("");
            }}
          >
            Limpiar filtros
          </button>
        ) : null}
      </div>

      <div className="space-y-3">
        {filteredReviewers.map((reviewer) => {
          const currentRequest = latestRequestByReviewer[reviewer.id];
          const isExpanded = expandedId === reviewer.id;
          const showContactOptions = contactOptionsId === reviewer.id;
          const showPlatformForm = platformFormId === reviewer.id;
          const whatsappMethod = reviewer.directContactMethods.find((method) => method.label === "WhatsApp");
          const otherDirectMethods = reviewer.directContactMethods.filter((method) => method.label !== "WhatsApp");
          const draftRequest = draftRequests[reviewer.id] || DEFAULT_CONTACT_REQUEST_DATA;

          return (
            <article
              key={reviewer.id}
              ref={(node) => {
                reviewerRefs.current[reviewer.id] = node;
              }}
              className="overflow-hidden rounded-[1.6rem] border border-[#e6ddd1] bg-[linear-gradient(180deg,#ffffff_0%,#fffdfa_100%)] shadow-[0_18px_36px_rgba(22,18,14,0.04)]"
            >
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
                        {getRequestStatusLabel(currentRequest.status)}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {reviewer.interests.slice(0, 4).map((interest) => (
                      <span key={interest} className="rounded-full border border-[#ece3d9] bg-[#fcfaf7] px-3 py-1 text-xs font-semibold text-[#62564a]">
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#8f857b]">Compatibilidad</p>
                  <p className="mt-1 text-2xl font-bold text-[#131316]">{reviewer.matchPercent}%</p>
                  <div className="mt-2 h-2.5 w-24 overflow-hidden rounded-full bg-[#f1e3d8]">
                    <div className="h-full rounded-full bg-[linear-gradient(90deg,#ff8a5b_0%,#ff6b35_100%)]" style={{ width: `${reviewer.matchPercent}%` }} />
                  </div>
                </div>
              </button>

              {isExpanded ? (
                <div className="border-t border-[#eee3d8] px-4 py-4">
                  <div className="mb-4 rounded-[1.2rem] border border-[#efe4d9] bg-[#fffaf6] px-4 py-3">
                    <p className="text-sm text-[#62626d]">
                      {reviewer.country || "Sin pais"} · {EXPERIENCE_LABELS[reviewer.experienceLevel]} · {AVAILABILITY_OPTIONS.find((item) => item.value === reviewer.availability)?.label}
                    </p>
                  </div>
                  {reviewer.note ? <p className="text-sm text-[#62626d]">{reviewer.note}</p> : <div className="h-2" />}

                  <div className="mt-4 rounded-[1.35rem] border border-[#eadfd6] bg-[linear-gradient(180deg,#fcfaf7_0%,#fff5ef_100%)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#131316]">Contacto</p>
                        <p className="mt-1 text-sm text-[#62626d]">
                          Primero elige por donde quieres contactar a este reviewer segun lo que haya autorizado en su perfil.
                        </p>
                      </div>
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#dc4f1f] shadow-sm">
                        <NotebookTabs className="h-5 w-5" />
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" className="btn-primary" onClick={() => openContactOptions(reviewer.id)}>
                        Contactar
                      </button>
                    </div>

                    {showContactOptions ? (
                      <div className="mt-4 space-y-3 rounded-[1.2rem] border border-[#e9ddd2] bg-white p-4">
                        <p className="text-sm font-semibold text-[#131316]">Elige una via</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={`btn-secondary ${showPlatformForm ? "border-[#ff6b35] text-[#dc4f1f]" : ""}`}
                            onClick={() => setPlatformFormId((current) => (current === reviewer.id ? null : reviewer.id))}
                          >
                            A traves de la pagina
                          </button>
                          {whatsappMethod ? (
                            <a
                              href={toHref(whatsappMethod.value)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center rounded-full bg-[#1f9d55] px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_32px_rgba(31,157,85,0.22)] transition hover:brightness-105"
                            >
                              WhatsApp
                            </a>
                          ) : null}
                          {otherDirectMethods.map((method) => (
                            <a key={`${reviewer.id}-${method.label}`} href={toHref(method.value)} target="_blank" rel="noreferrer" className="btn-secondary">
                              {method.label}
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {showPlatformForm ? (
                      <div className="mt-4 rounded-[1.2rem] border border-[#e9ddd2] bg-white p-4">
                        <p className="text-sm font-semibold text-[#131316]">Nueva oferta dentro de la plataforma</p>
                        <p className="mt-1 text-sm text-[#62626d]">Cada oferta se guarda por separado para que puedas manejar varias colaboraciones con el mismo reviewer.</p>
                        <div className="mt-4 grid gap-3">
                          <input
                            className="input"
                            value={draftRequest.productName}
                            onChange={(event) => updateDraftRequest(reviewer.id, { productName: event.target.value })}
                            placeholder="Producto o servicio"
                          />
                          <div className="grid gap-3 sm:grid-cols-2">
                            <select
                              className="input"
                              value={draftRequest.category}
                              onChange={(event) => updateDraftRequest(reviewer.id, { category: event.target.value })}
                            >
                              <option value="">Selecciona categoria</option>
                              {providerInterests.map((interest) => (
                                <option key={`${reviewer.id}-${interest}`} value={interest}>
                                  {interest}
                                </option>
                              ))}
                            </select>
                            <select
                              className="input"
                              value={draftRequest.intent}
                              onChange={(event) => updateDraftRequest(reviewer.id, { intent: event.target.value as ContactRequestData["intent"] })}
                            >
                              {CONTACT_REQUEST_INTENT_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <select
                              className="input"
                              value={draftRequest.timeline}
                              onChange={(event) => updateDraftRequest(reviewer.id, { timeline: event.target.value as ContactRequestData["timeline"] })}
                            >
                              {CONTACT_REQUEST_TIMELINE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <select
                              className="input"
                              value={draftRequest.preferredChannel}
                              onChange={(event) => updateDraftRequest(reviewer.id, { preferredChannel: event.target.value as ContactRequestData["preferredChannel"] })}
                            >
                              {CONTACT_REQUEST_CHANNEL_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <p className="mt-3 text-sm text-[#62626d]">
                          El reviewer vera estos detalles en su panel y podra aceptar, pedir mas informacion o dejarlo para despues.
                        </p>
                        <textarea
                          className="input mt-3 min-h-28 resize-none"
                          value={draftRequest.note}
                          onChange={(event) => updateDraftRequest(reviewer.id, { note: event.target.value })}
                          placeholder="Describe que esperas del reviewer, por que encaja contigo y cualquier detalle importante."
                        />
                        {currentRequest?.responseMessage ? (
                          <p className="mt-3 rounded-2xl border border-[#e6ddd1] bg-[#fffaf6] px-3 py-3 text-sm text-[#62564a]">
                            Ultima respuesta del reviewer: {currentRequest.responseMessage}
                          </p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn-primary"
                            disabled={isPending && pendingAction === reviewer.id}
                            onClick={() => submitRequest(reviewer.id)}
                          >
                            {isPending && pendingAction === reviewer.id
                              ? "Enviando..."
                              : requestLog.some((request) => request.reviewerId === reviewer.id)
                                ? "Enviar nueva oferta"
                                : "Enviar solicitud"}
                          </button>
                        </div>
                      </div>
                    ) : null}
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
