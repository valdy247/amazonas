"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CONTACT_REQUEST_CHANNEL_OPTIONS,
  CONTACT_REQUEST_INTENT_OPTIONS,
  CONTACT_REQUEST_TIMELINE_OPTIONS,
  getRequestStatusLabel,
  normalizeContactRequestData,
} from "@/lib/contact-requests";

type ReviewerOpportunity = {
  id: number;
  providerId: string;
  providerName: string;
  providerCountry: string;
  providerInterests: string[];
  message: string;
  status: string;
  createdAt: string;
  responseMessage?: string | null;
  requestData?: unknown;
};

type ReviewerOpportunitiesProps = {
  opportunities: ReviewerOpportunity[];
};

export function ReviewerOpportunities({ opportunities }: ReviewerOpportunitiesProps) {
  const supabase = createClient();
  const [items, setItems] = useState(opportunities);
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>(
    Object.fromEntries(opportunities.map((item) => [item.id, item.responseMessage || ""]))
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateStatus(id: number, status: string) {
    setError(null);
    setPendingId(id);

    startTransition(async () => {
      const responseMessage = replyDrafts[id]?.trim() || null;
      const { error: updateError } = await supabase
        .from("reviewer_contact_requests")
        .update({
          status,
          response_message: responseMessage,
          updated_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) {
        setError(updateError.message);
        setPendingId(null);
        return;
      }

      if (status === "accepted" && responseMessage) {
        const { error: messageError } = await supabase.from("request_messages").insert({
          request_id: id,
          sender_id: (await supabase.auth.getUser()).data.user?.id,
          body: responseMessage,
        });

        if (messageError) {
          setError(messageError.message);
          setPendingId(null);
          return;
        }
      }

      setItems((current) => current.map((item) => (item.id === id ? { ...item, status, responseMessage } : item)));
      setPendingId(null);
    });
  }

  if (!items.length) {
    return (
      <section className="card p-5">
        <h2 className="text-xl font-bold">Oportunidades recibidas</h2>
        <p className="mt-2 text-sm text-[#62626d]">Cuando un provider te contacte desde la pagina, la solicitud aparecera aqui.</p>
      </section>
    );
  }

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Oportunidades recibidas</h2>
          <p className="mt-1 text-sm text-[#62626d]">Gestiona solicitudes internas, responde rapido y deja claro si te interesa colaborar.</p>
        </div>
        <span className="rounded-full bg-[#fff3ec] px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#dc4f1f]">
          {items.length} solicitudes
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const requestData = normalizeContactRequestData(item.requestData);
          const intentLabel = CONTACT_REQUEST_INTENT_OPTIONS.find((option) => option.value === requestData.intent)?.label || "Sin definir";
          const timelineLabel = CONTACT_REQUEST_TIMELINE_OPTIONS.find((option) => option.value === requestData.timeline)?.label || "Sin definir";
          const channelLabel = CONTACT_REQUEST_CHANNEL_OPTIONS.find((option) => option.value === requestData.preferredChannel)?.label || "Sin definir";

          return (
            <article key={item.id} className="rounded-[1.35rem] border border-[#e6ddd1] bg-[#fffdfa] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">{item.providerName}</h3>
                  <p className="mt-1 text-sm text-[#62626d]">{item.providerCountry || "Sin pais"} · {new Date(item.createdAt).toLocaleDateString()}</p>
                </div>
                <span className="rounded-full bg-[#fcf3ea] px-3 py-1 text-xs font-semibold text-[#62564a]">{getRequestStatusLabel(item.status)}</span>
              </div>

              {item.providerInterests.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.providerInterests.map((interest) => (
                    <span key={`${item.id}-${interest}`} className="rounded-full border border-[#ece3d9] bg-white px-3 py-1 text-xs font-semibold text-[#62564a]">
                      {interest}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-3 rounded-[1.2rem] border border-[#efe4d9] bg-white p-4">
                <p className="text-sm font-semibold text-[#131316]">Resumen de la solicitud</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {[
                    { label: "Producto", value: requestData.productName || "Sin definir" },
                    { label: "Categoria", value: requestData.category || "Sin definir" },
                    { label: "Objetivo", value: intentLabel },
                    { label: "Canal preferido", value: channelLabel },
                    { label: "Tiempo", value: timelineLabel },
                  ].map((fact) => (
                    <div key={`${item.id}-${fact.label}`} className="rounded-2xl border border-[#f1e7dd] bg-[#fffaf6] px-3 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8f857b]">{fact.label}</p>
                      <p className="mt-1 text-sm font-semibold text-[#131316]">{fact.value}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-sm text-[#62626d]">{requestData.note || item.message || "Sin mensaje adicional."}</p>
              </div>

              <textarea
                className="input mt-4 min-h-24 resize-none"
                value={replyDrafts[item.id] || ""}
                onChange={(event) => setReplyDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                placeholder="Puedes responder con detalles, pedir mas informacion o indicar tu disponibilidad."
              />

              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn-secondary" type="button" onClick={() => updateStatus(item.id, "read")} disabled={isPending && pendingId === item.id}>
                  {isPending && pendingId === item.id && item.status !== "accepted" && item.status !== "declined" ? "Guardando..." : "Necesito mas detalles"}
                </button>
                <button className="btn-primary" type="button" onClick={() => updateStatus(item.id, "accepted")} disabled={isPending && pendingId === item.id}>
                  Me interesa
                </button>
                <button
                  className="rounded-full border border-[#f0c8bb] px-4 py-2 text-sm font-semibold text-[#d14f28]"
                  type="button"
                  onClick={() => updateStatus(item.id, "declined")}
                  disabled={isPending && pendingId === item.id}
                >
                  No por ahora
                </button>
              </div>

              {item.responseMessage ? <p className="mt-3 text-sm text-[#62564a]">Tu ultima respuesta: {item.responseMessage}</p> : null}
            </article>
          );
        })}
      </div>

      {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}
    </section>
  );
}
