"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";

type ContactRow = {
  id: number;
  title: string;
  email?: string | null;
  network: string | null;
  url: string;
  notes?: string | null;
  contact_methods?: string | null;
};

type HealthItem = {
  field: "email" | "whatsapp" | "instagram" | "messenger" | "facebook";
  label: string;
  value: string;
  status: "healthy" | "warning" | "broken";
  note: string;
};

type HealthResult = {
  contactId: number;
  checkedAt: string;
  overallStatus: "healthy" | "warning" | "broken";
  summary: string;
  items: HealthItem[];
};

type Props = {
  contacts: ContactRow[];
};

function statusClasses(status: HealthResult["overallStatus"] | HealthItem["status"]) {
  if (status === "healthy") return "bg-[#eef9f0] text-[#177a52]";
  if (status === "broken") return "bg-[#fff1f1] text-[#c24d3a]";
  return "bg-[#fff7ea] text-[#b8731b]";
}

export function AdminProviderHealthPanel({ contacts }: Props) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(contacts[0]?.id ?? null);
  const [results, setResults] = useState<Record<number, HealthResult>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const deferredQuery = useDeferredValue(query);

  const filteredContacts = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (!normalized) return true;
      return [contact.title, contact.email, contact.network, contact.url, contact.notes, contact.contact_methods]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [contacts, deferredQuery]);

  const selectedContact = filteredContacts.find((contact) => contact.id === selectedId) || filteredContacts[0] || null;
  const selectedResult = selectedContact ? results[selectedContact.id] || null : null;

  function runCheck(contactId: number) {
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/provider-health/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId }),
        });
        const data = (await response.json()) as { error?: string; result?: HealthResult };
        if (!response.ok || !data.result) {
          throw new Error(data.error || "No se pudo ejecutar el chequeo.");
        }

        setResults((current) => ({
          ...current,
          [contactId]: data.result as HealthResult,
        }));
        setSelectedId(contactId);
      } catch (checkError) {
        setError(checkError instanceof Error ? checkError.message : "No se pudo ejecutar el chequeo.");
      }
    });
  }

  function runVisibleChecks() {
    setError(null);
    startTransition(async () => {
      for (const contact of filteredContacts.slice(0, 40)) {
        try {
          const response = await fetch("/api/admin/provider-health/check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contactId: contact.id }),
          });
          const data = (await response.json()) as { result?: HealthResult };
          if (response.ok && data.result) {
            setResults((current) => ({
              ...current,
              [contact.id]: data.result as HealthResult,
            }));
          }
        } catch {
          // Keep batch checks resilient.
        }
      }
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="rounded-[1.2rem] border border-[#eadfd6] bg-[#fcfaf7] p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#131316]">Health Check</p>
            <p className="mt-1 text-xs text-[#62564a]">Chequeo tecnico de enlaces y plausibilidad de contacto. No confirma registro real en WhatsApp.</p>
          </div>
          <button className="btn-secondary" type="button" onClick={runVisibleChecks} disabled={isPending || !filteredContacts.length}>
            {isPending ? "Revisando..." : "Chequear visibles"}
          </button>
        </div>

        <div className="mt-3">
          <input
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar proveedor, red, email o enlace"
          />
        </div>

        <div className="mt-3 space-y-2">
          {filteredContacts.slice(0, 120).map((contact) => {
            const result = results[contact.id];
            const isSelected = (selectedId ?? filteredContacts[0]?.id) === contact.id;

            return (
              <button
                key={contact.id}
                type="button"
                onClick={() => setSelectedId(contact.id)}
                className={`w-full rounded-[1rem] px-3 py-3 text-left ${isSelected ? "bg-white ring-1 ring-[#eadfd6]" : "bg-[#fff8f4]"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#131316]">{contact.title}</p>
                    <p className="mt-1 text-xs text-[#62564a]">{contact.network || "Sin red"} · #{contact.id}</p>
                  </div>
                  {result ? (
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${statusClasses(result.overallStatus)}`}>
                      {result.overallStatus}
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedContact ? (
        <div className="rounded-[1.2rem] border border-[#eadfd6] bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-[#131316]">{selectedContact.title}</h2>
              <p className="mt-1 text-sm text-[#62564a]">{selectedContact.network || "Sin red"} · #{selectedContact.id}</p>
              <p className="mt-2 break-all text-xs text-[#8f857b]">{selectedContact.url}</p>
            </div>
            <button className="btn-primary" type="button" onClick={() => runCheck(selectedContact.id)} disabled={isPending}>
              {isPending ? "Revisando..." : "Correr chequeo"}
            </button>
          </div>

          {selectedResult ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-[1rem] border border-[#eadfd6] bg-[#fcfaf7] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-[#131316]">{selectedResult.summary}</p>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${statusClasses(selectedResult.overallStatus)}`}>
                    {selectedResult.overallStatus}
                  </span>
                </div>
                <p className="mt-2 text-xs text-[#8f857b]">Ultimo chequeo: {new Date(selectedResult.checkedAt).toLocaleString()}</p>
              </div>

              <div className="grid gap-3">
                {selectedResult.items.map((item) => (
                  <div key={`${selectedResult.contactId}-${item.field}`} className="rounded-[1rem] border border-[#eadfd6] bg-[#fffaf7] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold text-[#131316]">{item.label}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${statusClasses(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-2 break-all text-sm text-[#62564a]">{item.value}</p>
                    <p className="mt-2 text-xs text-[#8f857b]">{item.note}</p>
                  </div>
                ))}
              </div>

              {selectedResult.overallStatus !== "healthy" ? (
                <a href="/admin?section=providers#repair-center" className="inline-flex text-sm font-semibold text-[#dc4f1f]">
                  Abrir saneamiento
                </a>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 rounded-[1rem] border border-dashed border-[#eadfd6] bg-[#fffaf7] p-5 text-sm text-[#62564a]">
              Corre el chequeo tecnico para ver si el enlace responde, si el email es valido y si el WhatsApp parece plausible.
            </div>
          )}

          {error ? <p className="mt-3 text-sm font-semibold text-[#c24d3a]">{error}</p> : null}
        </div>
      ) : (
        <div className="rounded-[1.2rem] border border-dashed border-[#e2d8cc] bg-[#fffaf5] p-5 text-sm text-[#62626d]">
          No hay contactos disponibles para revisar.
        </div>
      )}
    </div>
  );
}
