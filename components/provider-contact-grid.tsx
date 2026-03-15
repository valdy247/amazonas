"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowUpRight, CircleX, MessageCircleMore } from "lucide-react";
import { parseContactMethods } from "@/lib/provider-contact";
import { createClient } from "@/lib/supabase/client";

type ProviderContact = {
  id: number;
  title: string;
  network: string | null;
  url: string;
  notes: string | null;
  is_verified: boolean;
  contact_methods?: string | null;
};

type ProviderContactGridProps = {
  contacts: ProviderContact[];
  initialContactedIds: number[];
};

export function ProviderContactGrid({ contacts, initialContactedIds }: ProviderContactGridProps) {
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "contacted">("pending");
  const [contactedIds, setContactedIds] = useState<number[]>(initialContactedIds);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === selectedContactId) || null,
    [contacts, selectedContactId]
  );
  const methods = useMemo(
    () =>
      selectedContact
        ? parseContactMethods(selectedContact.contact_methods, selectedContact.url, selectedContact.network)
        : [],
    [selectedContact]
  );
  const pendingContacts = useMemo(
    () => contacts.filter((contact) => !contactedIds.includes(contact.id)),
    [contacts, contactedIds]
  );
  const contactedContacts = useMemo(
    () => contacts.filter((contact) => contactedIds.includes(contact.id)),
    [contacts, contactedIds]
  );
  const visibleContacts = activeTab === "pending" ? pendingContacts : contactedContacts;

  function markAsContacted(contactId: number) {
    setContactedIds((current) => (current.includes(contactId) ? current : [...current, contactId]));
    setActiveTab("contacted");
  }

  function openMethod(contactId: number, href: string) {
    setError(null);

    startTransition(async () => {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("No se pudo validar tu sesion.");
        return;
      }

      const { error: insertError } = await supabase.from("reviewer_contact_history").upsert({
        reviewer_id: user.id,
        provider_contact_id: contactId,
        contacted_at: new Date().toISOString(),
      });

      if (insertError) {
        setError(insertError.message);
        return;
      }

      markAsContacted(contactId);
      setSelectedContactId(null);

      if (href.startsWith("tel:")) {
        window.location.href = href;
        return;
      }

      window.open(href, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <>
      <div className="mt-4 flex rounded-full border border-[#e8ddd2] bg-[#f8f3ed] p-1">
        <button
          type="button"
          onClick={() => setActiveTab("pending")}
          className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold transition ${
            activeTab === "pending" ? "bg-white text-[#131316] shadow-sm" : "text-[#7c7064]"
          }`}
        >
          Por contactar ({pendingContacts.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("contacted")}
          className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold transition ${
            activeTab === "contacted" ? "bg-white text-[#131316] shadow-sm" : "text-[#7c7064]"
          }`}
        >
          Contactados ({contactedContacts.length})
        </button>
      </div>

      <div className="mt-3 grid gap-3">
        {visibleContacts.map((contact) => (
          <article key={contact.id} className="rounded-[1.5rem] border border-[#eee5db] bg-[linear-gradient(180deg,#ffffff_0%,#fcfaf7_100%)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{contact.title}</p>
                <p className="text-xs text-[#62626d]">{contact.network || "Red no definida"}</p>
              </div>
              {contact.is_verified ? (
                <span className="rounded-full bg-[#fff3ec] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#dc4f1f]">
                  Verificado
                </span>
              ) : null}
            </div>
            {contact.notes ? <p className="mt-3 text-sm text-[#62626d]">{contact.notes}</p> : null}
            <button
              type="button"
              onClick={() => setSelectedContactId(contact.id)}
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#dc4f1f]"
            >
              {activeTab === "pending" ? "Contactar proveedor" : "Volver a contactar"}
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </article>
        ))}
      </div>

      {!visibleContacts.length ? (
        <div className="mt-3 rounded-[1.5rem] border border-dashed border-[#e6ddd1] bg-[#fffdf9] p-5 text-sm text-[#62626d]">
          {activeTab === "pending"
            ? "Todavia no hay proveedores pendientes por contactar."
            : "Aun no has abierto ningun contacto. Cuando abras uno aparecera aqui automaticamente."}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}

      {selectedContact ? (
        <div className="fixed inset-0 z-30 bg-[#131316]/45 p-4 backdrop-blur-sm">
          <div className="mx-auto mt-16 w-full max-w-md rounded-[1.8rem] border border-[#e7ddd2] bg-white p-5 shadow-[0_26px_80px_rgba(17,17,17,0.18)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#dc4f1f]">Contactar al proveedor</p>
                <h3 className="mt-2 text-2xl font-bold">{selectedContact.title}</h3>
                <p className="mt-2 text-sm text-[#62626d]">
                  Elige una via de contacto para abrir directamente el perfil o canal del proveedor.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedContactId(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e5e5df] text-[#62626d]"
              >
                <CircleX className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              {methods.map((method) => (
                <button
                  key={`${selectedContact.id}-${method.label}-${method.href}`}
                  type="button"
                  onClick={() => openMethod(selectedContact.id, method.href)}
                  disabled={isPending}
                  className="inline-flex items-center justify-between rounded-[1.4rem] border border-[#ebdfd2] bg-[#fcfaf7] px-4 py-4 text-left"
                >
                  <span className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff1e8] text-[#dc4f1f]">
                      <MessageCircleMore className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm text-[#62626d]">Contactar por</span>
                      <span className="block font-semibold">{method.label}</span>
                    </span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-[#dc4f1f]" />
                </button>
              ))}
            </div>

            {selectedContact.notes ? (
              <p className="mt-4 rounded-[1.25rem] bg-[#f8f4ef] p-4 text-sm text-[#62626d]">{selectedContact.notes}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
