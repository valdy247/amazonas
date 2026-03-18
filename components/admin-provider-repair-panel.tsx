"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { updateProviderContactAction, type AdminActionState } from "@/app/admin/actions";
import { buildProviderRepairSuggestion, type ProviderRepairSuggestion } from "@/lib/provider-repair";
import { getContactFieldValues } from "@/lib/provider-contact";

type ContactRow = {
  id: number;
  title: string;
  email?: string | null;
  network: string | null;
  url: string;
  notes?: string | null;
  is_active: boolean;
  is_verified: boolean;
  contact_methods?: string | null;
};

type AdminProviderRepairPanelProps = {
  contacts: ContactRow[];
};

type AiSuggestion = ProviderRepairSuggestion & { aiReason?: string };
const INITIAL_ACTION_STATE: AdminActionState = { status: "idle", message: "" };

export function AdminProviderRepairPanel({ contacts }: AdminProviderRepairPanelProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<Record<number, AiSuggestion>>({});
  const [isPending, startTransition] = useTransition();
  const [actionState, repairAction, isRepairPending] = useActionState(updateProviderContactAction, INITIAL_ACTION_STATE);

  const suggestions = useMemo(
    () =>
      contacts
        .map((contact) => ({
          contact,
          suggestion: buildProviderRepairSuggestion(contact),
        }))
        .filter((item): item is { contact: ContactRow; suggestion: ProviderRepairSuggestion } => Boolean(item.suggestion)),
    [contacts]
  );

  const openItem = suggestions.find((item) => item.contact.id === selectedId) || suggestions[0] || null;
  const selectedSuggestion = openItem ? aiSuggestions[openItem.contact.id] || openItem.suggestion : null;
  const whatsappPrefixMatch = selectedSuggestion?.whatsapp.match(/^\+\d{1,3}/);
  const whatsappPrefix = whatsappPrefixMatch?.[0] || "";
  const whatsappNumber = selectedSuggestion?.whatsapp.replace(/^\+\d{1,3}/, "") || "";

  function requestAi(contact: ContactRow) {
    startTransition(async () => {
      const response = await fetch("/api/admin/provider-repair/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: contact.title,
          email: contact.email,
          network: contact.network,
          url: contact.url,
          notes: contact.notes,
          contactMethods: contact.contact_methods,
        }),
      });
      const data = (await response.json()) as {
        suggestion?: {
          email?: string;
          whatsapp?: string;
          instagram?: string;
          messenger?: string;
          facebook?: string;
          reason?: string;
        };
      };

      if (!response.ok || !data.suggestion) {
        return;
      }

      setAiSuggestions((current) => ({
        ...current,
        [contact.id]: {
          contactId: contact.id,
          reason: "AI suggestion",
          severity: "warning",
          email: data.suggestion?.email || "",
          whatsapp: data.suggestion?.whatsapp || "",
          instagram: data.suggestion?.instagram || "",
          messenger: data.suggestion?.messenger || "",
          facebook: data.suggestion?.facebook || "",
          changedFields: ["email", "whatsapp", "instagram", "messenger", "facebook"].filter(
            (field) => Boolean((data.suggestion as Record<string, string | undefined>)?.[field])
          ),
          aiReason: data.suggestion?.reason || "",
        },
      }));
    });
  }

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="rounded-[1.2rem] border border-[#eadfd6] bg-[#fcfaf7] p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#131316]">Repair Center</p>
            <p className="mt-1 text-xs text-[#62564a]">Limpieza automatica y revision asistida para enlaces, emails, telefonos y duplicados.</p>
          </div>
          <span className="rounded-full bg-[#fff2eb] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#dc4f1f]">
            {suggestions.length} fixes
          </span>
        </div>

        <div className="mt-3 space-y-2">
          {suggestions.slice(0, 120).map(({ contact, suggestion }) => (
            <button
              key={contact.id}
              type="button"
              className={`w-full rounded-[1rem] px-3 py-3 text-left ${
                (selectedId ?? suggestions[0]?.contact.id) === contact.id ? "bg-white ring-1 ring-[#eadfd6]" : "bg-[#fff8f4]"
              }`}
              onClick={() => setSelectedId(contact.id)}
            >
              <p className="text-sm font-semibold text-[#131316]">{contact.title}</p>
              <p className="mt-1 text-xs text-[#62564a]">{suggestion.reason}</p>
            </button>
          ))}
        </div>
      </div>

      {openItem ? (
        <div className="rounded-[1.2rem] border border-[#eadfd6] bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-bold text-[#131316]">{openItem.contact.title}</h3>
              <p className="mt-1 text-sm text-[#62564a]">{openItem.suggestion.reason}</p>
            </div>
            <button className="btn-secondary" type="button" onClick={() => requestAi(openItem.contact)} disabled={isPending}>
              {isPending ? "Revisando..." : "Usar IA"}
            </button>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[1rem] bg-[#fcfaf7] p-3">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8f857b]">Actual</p>
              <div className="mt-3 space-y-2 text-sm text-[#62564a]">
                <div>Email: {openItem.contact.email || "—"}</div>
                {(() => {
                  const fields = getContactFieldValues(openItem.contact.contact_methods, openItem.contact.url, openItem.contact.network);
                  return (
                    <>
                      <div>WhatsApp: {fields.whatsapp || "—"}</div>
                      <div>Instagram: {fields.instagram || "—"}</div>
                      <div>Messenger: {fields.messenger || "—"}</div>
                      <div>Facebook: {fields.facebook || "—"}</div>
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="rounded-[1rem] bg-[#fff8f4] p-3">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#dc4f1f]">Sugerido</p>
              <div className="mt-3 space-y-2 text-sm text-[#62564a]">
                {(() => {
                  const suggestion = aiSuggestions[openItem.contact.id] || openItem.suggestion;
                  return (
                    <>
                      <div>Email: {suggestion.email || "—"}</div>
                      <div>WhatsApp: {suggestion.whatsapp || "—"}</div>
                      <div>Instagram: {suggestion.instagram || "—"}</div>
                      <div>Messenger: {suggestion.messenger || "—"}</div>
                      <div>Facebook: {suggestion.facebook || "—"}</div>
                      {"aiReason" in suggestion && suggestion.aiReason ? (
                        <div className="pt-2 text-xs text-[#8f857b]">IA: {suggestion.aiReason}</div>
                      ) : null}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          <form action={repairAction} className="mt-4 grid gap-2">
            <input type="hidden" name="contact_id" value={openItem.contact.id} />
            <input type="hidden" name="allow_duplicate_delete" value="on" />
            <input type="hidden" name="email" value={selectedSuggestion?.email || ""} readOnly />
            <input type="hidden" name="whatsapp_prefix" value={whatsappPrefix} readOnly />
            <input type="hidden" name="whatsapp_number" value={whatsappNumber} readOnly />
            <input type="hidden" name="instagram" value={selectedSuggestion?.instagram || ""} readOnly />
            <input type="hidden" name="messenger" value={selectedSuggestion?.messenger || ""} readOnly />
            <input type="hidden" name="facebook" value={selectedSuggestion?.facebook || ""} readOnly />
            <input type="hidden" name="notes" value={openItem.contact.notes || ""} readOnly />
            {openItem.contact.is_active ? <input type="hidden" name="is_active" value="on" /> : null}
            {openItem.contact.is_verified ? <input type="hidden" name="is_verified" value="on" /> : null}
            <button className="btn-primary w-full sm:w-auto" type="submit">
              {isRepairPending ? "Aplicando..." : "Aplicar reparacion"}
            </button>
          </form>
          <p className="mt-2 text-xs text-[#8f857b]">
            Si el valor limpio ya coincide con otro proveedor, este registro se eliminara automaticamente como duplicado.
          </p>
          {actionState.status === "success" ? (
            <p className="mt-3 text-sm font-semibold text-[#177a52]">{actionState.message}</p>
          ) : null}
          {actionState.status === "error" ? (
            <p className="mt-3 text-sm font-semibold text-[#c24d3a]">{actionState.message}</p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-[1.2rem] border border-dashed border-[#e2d8cc] bg-[#fffaf5] p-5 text-sm text-[#62626d]">
          No encontramos contactos que necesiten saneamiento automatico ahora mismo.
        </div>
      )}
    </div>
  );
}
