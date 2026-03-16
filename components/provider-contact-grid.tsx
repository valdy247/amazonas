"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowUpRight, CircleX, MessageCircleMore } from "lucide-react";
import { parseContactMethods } from "@/lib/provider-contact";
import { createClient } from "@/lib/supabase/client";
import { normalizeLanguage, providerContactsCopy, type AppLanguage } from "@/lib/i18n";

type ProviderContact = {
  id: string;
  title: string;
  network: string | null;
  url: string;
  notes: string | null;
  is_verified: boolean;
  contact_methods?: string | null;
  source?: "admin" | "registered";
  source_label?: string | null;
  history_id?: number | null;
};

type ProviderContactGridProps = {
  contacts: ProviderContact[];
  initialContactedIds: string[];
  language: AppLanguage;
};

export function ProviderContactGrid({ contacts, initialContactedIds, language }: ProviderContactGridProps) {
  const copy = providerContactsCopy[normalizeLanguage(language)];
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "contacted">("pending");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const contactedStorageKey = "provider-contacted";
  const [contactedIds, setContactedIds] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return initialContactedIds;
    }

    try {
      const stored = window.localStorage.getItem(contactedStorageKey);
      if (!stored) {
        return initialContactedIds;
      }

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        return initialContactedIds;
      }

      return Array.from(new Set([...initialContactedIds, ...parsed.filter((item): item is string => typeof item === "string")]));
    } catch {
      return initialContactedIds;
    }
  });

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(contactedStorageKey, JSON.stringify(contactedIds));
  }, [contactedIds]);

  function markAsContacted(contactId: string) {
    setContactedIds((current) => (current.includes(contactId) ? current : [...current, contactId]));
    setActiveTab("contacted");
  }

  function buildWhatsappInviteMessage() {
    if (typeof window === "undefined") return "";
    const inviteUrl = `${window.location.origin}/?invite=provider-directory`;
    return copy.whatsappTemplate.replace("{inviteUrl}", inviteUrl);
  }

  function buildMethodHref(label: string, href: string) {
    if (label !== "WhatsApp") {
      return href;
    }

    try {
      const url = new URL(href);
      const message = buildWhatsappInviteMessage();
      if (!message) return href;
      url.searchParams.set("text", message);
      return url.toString();
    } catch {
      return href;
    }
  }

  function openMethod(contact: ProviderContact, href: string) {
    setError(null);

    startTransition(async () => {
      if (contact.history_id) {
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          setError(copy.sessionError);
          return;
        }

        const { error: insertError } = await supabase.from("reviewer_contact_history").upsert({
          reviewer_id: user.id,
          provider_contact_id: contact.history_id,
          contacted_at: new Date().toISOString(),
        });

        if (insertError) {
          setError(insertError.message);
          return;
        }
      }

      markAsContacted(contact.id);
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
          {copy.pending} ({pendingContacts.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("contacted")}
          className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold transition ${
            activeTab === "contacted" ? "bg-white text-[#131316] shadow-sm" : "text-[#7c7064]"
          }`}
        >
          {copy.contacted} ({contactedContacts.length})
        </button>
      </div>

      <div className="mt-3 grid gap-3">
        {visibleContacts.map((contact) => (
          <article key={contact.id} className="rounded-[1.5rem] border border-[#eee5db] bg-[linear-gradient(180deg,#ffffff_0%,#fcfaf7_100%)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{contact.title}</p>
                <p className="text-xs text-[#62626d]">{contact.network || copy.undefinedNetwork}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {contact.source_label ? (
                  <span className="rounded-full bg-[#f6f1ea] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#7c7064]">
                    {contact.source_label}
                  </span>
                ) : null}
                {contact.is_verified ? (
                  <span className="rounded-full bg-[#fff3ec] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#dc4f1f]">
                    {copy.verified}
                  </span>
                ) : null}
              </div>
            </div>
            {contact.notes ? <p className="mt-3 text-sm text-[#62626d]">{contact.notes}</p> : null}
            <button
              type="button"
              onClick={() => setSelectedContactId(contact.id)}
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#dc4f1f]"
            >
              {activeTab === "pending" ? copy.contactProvider : copy.contactAgain}
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </article>
        ))}
      </div>

      {!visibleContacts.length ? (
        <div className="mt-3 rounded-[1.5rem] border border-dashed border-[#e6ddd1] bg-[#fffdf9] p-5 text-sm text-[#62626d]">
          {activeTab === "pending"
            ? copy.noPending
            : copy.noContacted}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}

      {selectedContact ? (
        <div className="fixed inset-0 z-30 bg-[#131316]/45 p-4 backdrop-blur-sm">
          <div className="mx-auto mt-16 w-full max-w-md rounded-[1.8rem] border border-[#e7ddd2] bg-white p-5 shadow-[0_26px_80px_rgba(17,17,17,0.18)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#dc4f1f]">{copy.contactProviderTitle}</p>
                <h3 className="mt-2 text-2xl font-bold">{selectedContact.title}</h3>
                <p className="mt-2 text-sm text-[#62626d]">{copy.contactProviderBody}</p>
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
                  onClick={() => openMethod(selectedContact, buildMethodHref(method.label, method.href))}
                  disabled={isPending}
                  className="inline-flex items-center justify-between rounded-[1.4rem] border border-[#ebdfd2] bg-[#fcfaf7] px-4 py-4 text-left"
                >
                  <span className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff1e8] text-[#dc4f1f]">
                      <MessageCircleMore className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm text-[#62626d]">{copy.contactVia}</span>
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
