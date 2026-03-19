"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { createProviderContactAdminReport } from "@/app/admin/actions";
import { type AppLanguage } from "@/lib/i18n";
import { getContactFieldValues } from "@/lib/provider-contact";

type ContactRow = {
  id: number;
  title: string;
  network: string | null;
  url: string;
  notes?: string | null;
  contact_methods?: string | null;
};

type LinkReviewItem = {
  field: "instagram" | "messenger" | "facebook";
  label: string;
  value: string;
  finalUrl: string;
  status: "healthy" | "warning" | "broken";
  note: string;
};

type LinkReviewResult = {
  contactId: number;
  checkedAt: string;
  overallStatus: "healthy" | "warning" | "broken";
  summary: string;
  items: LinkReviewItem[];
};

type Props = {
  contacts: ContactRow[];
  language: AppLanguage;
};

const LINK_REVIEW_COPY = {
  es: {
    title: "Revision visual de enlaces",
    body: "Abre enlaces sociales y detecta si terminan en contenido no disponible, login o restriccion.",
    searchPlaceholder: "Buscar proveedor, Facebook, Messenger o Instagram",
    runVisible: "Revisar visibles",
    running: "Revisando...",
    runSingle: "Abrir y revisar",
    noContacts: "No hay contactos sociales para revisar.",
    noResult: "Corre la revision visual para detectar enlaces caidos o restringidos.",
    markBroken: "Mandar a revision por contacto dañado",
    openRepair: "Abrir saneamiento",
    finalUrl: "Destino final",
    checkedAt: "Ultima revision",
  },
  en: {
    title: "Visual link review",
    body: "Opens social links and detects unavailable-content, login, or restricted outcomes.",
    searchPlaceholder: "Search provider, Facebook, Messenger, or Instagram",
    runVisible: "Review visible",
    running: "Reviewing...",
    runSingle: "Open and review",
    noContacts: "There are no social contacts to review.",
    noResult: "Run the visual review to detect broken or restricted links.",
    markBroken: "Send to review as broken contact",
    openRepair: "Open repair",
    finalUrl: "Final destination",
    checkedAt: "Last review",
  },
} as const;

function statusClasses(status: LinkReviewResult["overallStatus"] | LinkReviewItem["status"]) {
  if (status === "healthy") return "bg-[#eef9f0] text-[#177a52]";
  if (status === "broken") return "bg-[#fff1f1] text-[#c24d3a]";
  return "bg-[#fff7ea] text-[#b8731b]";
}

export function AdminProviderLinkReviewPanel({ contacts, language }: Props) {
  const copy = LINK_REVIEW_COPY[language];
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [results, setResults] = useState<Record<number, LinkReviewResult>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const deferredQuery = useDeferredValue(query);

  const socialContacts = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();

    return contacts.filter((contact) => {
      const fields = getContactFieldValues(contact.contact_methods, contact.url, contact.network);
      const hasSocial = Boolean(fields.instagram || fields.messenger || fields.facebook);
      if (!hasSocial) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      return [contact.title, contact.network, contact.url, contact.notes, contact.contact_methods, fields.instagram, fields.messenger, fields.facebook]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [contacts, deferredQuery]);

  const selectedContact = socialContacts.find((contact) => contact.id === selectedId) || socialContacts[0] || null;
  const selectedResult = selectedContact ? results[selectedContact.id] || null : null;

  function runCheck(contactId: number) {
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/provider-health/link-review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId }),
        });
        const data = (await response.json()) as { error?: string; result?: LinkReviewResult };
        if (!response.ok || !data.result) {
          throw new Error(data.error || "No se pudo ejecutar la revision visual.");
        }

        setResults((current) => ({
          ...current,
          [contactId]: data.result as LinkReviewResult,
        }));
        setSelectedId(contactId);
      } catch (checkError) {
        setError(checkError instanceof Error ? checkError.message : "No se pudo ejecutar la revision visual.");
      }
    });
  }

  function runVisibleChecks() {
    setError(null);
    startTransition(async () => {
      for (const contact of socialContacts.slice(0, 20)) {
        try {
          const response = await fetch("/api/admin/provider-health/link-review", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contactId: contact.id }),
          });
          const data = (await response.json()) as { result?: LinkReviewResult };
          if (response.ok && data.result) {
            setResults((current) => ({
              ...current,
              [contact.id]: data.result as LinkReviewResult,
            }));
          }
        } catch {
          // Keep batch review resilient.
        }
      }
    });
  }

  if (!socialContacts.length) {
    return (
      <div className="rounded-[1.2rem] border border-dashed border-[#e2d8cc] bg-[#fffaf5] p-5 text-sm text-[#62626d]">
        {copy.noContacts}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="rounded-[1.2rem] border border-[#eadfd6] bg-[#fcfaf7] p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#131316]">{copy.title}</p>
            <p className="mt-1 text-xs text-[#62564a]">{copy.body}</p>
          </div>
          <button className="btn-secondary" type="button" onClick={runVisibleChecks} disabled={isPending}>
            {isPending ? copy.running : copy.runVisible}
          </button>
        </div>

        <div className="mt-3">
          <input
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.searchPlaceholder}
          />
        </div>

        <div className="mt-3 space-y-2">
          {socialContacts.slice(0, 80).map((contact) => {
            const result = results[contact.id];
            const isSelected = (selectedId ?? socialContacts[0]?.id) === contact.id;

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
              <h3 className="font-bold text-[#131316]">{selectedContact.title}</h3>
              <p className="mt-1 text-sm text-[#62564a]">{selectedContact.network || "Sin red"} · #{selectedContact.id}</p>
            </div>
            <button className="btn-primary" type="button" onClick={() => runCheck(selectedContact.id)} disabled={isPending}>
              {isPending ? copy.running : copy.runSingle}
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
                <p className="mt-2 text-xs text-[#8f857b]">
                  {copy.checkedAt}: {new Date(selectedResult.checkedAt).toLocaleString()}
                </p>
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
                    {item.finalUrl && item.finalUrl !== item.value ? (
                      <p className="mt-2 break-all text-xs text-[#8f857b]">
                        {copy.finalUrl}: {item.finalUrl}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>

              {selectedResult.overallStatus === "broken" ? (
                <form action={createProviderContactAdminReport} className="flex flex-wrap items-center gap-3">
                  <input type="hidden" name="contact_id" value={selectedContact.id} />
                  <input type="hidden" name="report_type" value="broken_contact" />
                  <button className="btn-secondary" type="submit">
                    {copy.markBroken}
                  </button>
                  <a href="/admin?section=quality#repair-center" className="text-sm font-semibold text-[#dc4f1f]">
                    {copy.openRepair}
                  </a>
                </form>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 rounded-[1rem] border border-dashed border-[#eadfd6] bg-[#fffaf7] p-5 text-sm text-[#62564a]">
              {copy.noResult}
            </div>
          )}

          {error ? <p className="mt-3 text-sm font-semibold text-[#c24d3a]">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
