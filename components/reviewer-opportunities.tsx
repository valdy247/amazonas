"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

type ReviewerOpportunity = {
  id: number;
  providerId: string;
  providerName: string;
  providerCountry: string;
  providerInterests: string[];
  message: string;
  status: string;
  createdAt: string;
};

type ReviewerOpportunitiesProps = {
  opportunities: ReviewerOpportunity[];
};

export function ReviewerOpportunities({ opportunities }: ReviewerOpportunitiesProps) {
  const supabase = createClient();
  const [items, setItems] = useState(opportunities);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateStatus(id: number, status: string) {
    setError(null);
    setPendingId(id);

    startTransition(async () => {
      const { error: updateError } = await supabase
        .from("reviewer_contact_requests")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) {
        setError(updateError.message);
        setPendingId(null);
        return;
      }

      setItems((current) => current.map((item) => (item.id === id ? { ...item, status } : item)));
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
          <p className="mt-1 text-sm text-[#62626d]">Gestiona solicitudes internas y marca las que te interesan.</p>
        </div>
        <span className="rounded-full bg-[#fff3ec] px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#dc4f1f]">
          {items.length} solicitudes
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-[1.35rem] border border-[#e6ddd1] bg-[#fffdfa] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold">{item.providerName}</h3>
                <p className="mt-1 text-sm text-[#62626d]">{item.providerCountry || "Sin pais"} · {new Date(item.createdAt).toLocaleDateString()}</p>
              </div>
              <span className="rounded-full bg-[#fcf3ea] px-3 py-1 text-xs font-semibold text-[#62564a]">{item.status}</span>
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
            <p className="mt-3 text-sm text-[#62626d]">{item.message || "Sin mensaje adicional."}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn-secondary" type="button" onClick={() => updateStatus(item.id, "read")} disabled={isPending && pendingId === item.id}>
                {isPending && pendingId === item.id && item.status !== "accepted" && item.status !== "declined" ? "Guardando..." : "Marcar leido"}
              </button>
              <button className="btn-primary" type="button" onClick={() => updateStatus(item.id, "accepted")} disabled={isPending && pendingId === item.id}>
                Aceptar
              </button>
              <button className="rounded-full border border-[#f0c8bb] px-4 py-2 text-sm font-semibold text-[#d14f28]" type="button" onClick={() => updateStatus(item.id, "declined")} disabled={isPending && pendingId === item.id}>
                Rechazar
              </button>
            </div>
          </article>
        ))}
      </div>

      {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}
    </section>
  );
}
