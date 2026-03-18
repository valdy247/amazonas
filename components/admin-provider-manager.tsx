"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { createProviderContactAdminReport, deleteProviderContact, updateProviderContact } from "@/app/admin/actions";
import { WhatsappCountrySelect } from "@/components/whatsapp-country-select";
import { type AppLanguage } from "@/lib/i18n";
import { getContactFieldValues } from "@/lib/provider-contact";
import type { WhatsappPrefixOption } from "@/lib/whatsapp-prefix-options";

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

type DuplicateGroup = {
  key: string;
  reason: string;
  contactIds: number[];
  labels: string[];
};

type AdminProviderManagerProps = {
  contacts: ContactRow[];
  whatsappPrefixOptions: readonly WhatsappPrefixOption[];
  duplicateGroups?: DuplicateGroup[];
  language: AppLanguage;
};

const PROVIDER_MANAGER_COPY = {
  es: {
    searchProvider: "Buscar proveedor",
    searchPlaceholder: "Alias, WhatsApp, Instagram, Messenger, Facebook, email o nota",
    duplicatesOnly: "Solo duplicados",
    matches: "coincidencias",
    clearFilter: "Limpiar filtro",
    possibleDuplicates: "Posibles duplicados",
    duplicateHelp: "Agrupados por email o método de contacto comparable.",
    groups: "grupos",
    active: "activo",
    inactive: "inactivo",
    verified: "verificado",
    unverified: "sin verificar",
    generatedAlias: "Alias generado",
    providerEmail: "Correo del proveedor (opcional)",
    notes: "Notas",
    markForReview: "Marcar para revisión",
    reviewHelp: "Si un admin marca un contacto, entra directo al panel de revisión aunque aún no tenga 5 reportes de reseñadores.",
    noReply: "No contesta",
    notProvider: "No es proveedor",
    trusted: "Es confiable",
    scam: "Scam",
    brokenContact: "Contacto dañado",
    activeToggle: "Activo",
    verifiedToggle: "Verificado",
    updateContact: "Actualizar contacto",
    deleteContact: "Eliminar contacto",
    showMore: "Ver más 10",
    noProviders: "No hay proveedores que coincidan con ese filtro.",
  },
  en: {
    searchProvider: "Search provider",
    searchPlaceholder: "Alias, WhatsApp, Instagram, Messenger, Facebook, email, or note",
    duplicatesOnly: "Duplicates only",
    matches: "matches",
    clearFilter: "Clear filter",
    possibleDuplicates: "Possible duplicates",
    duplicateHelp: "Grouped by email or comparable contact method.",
    groups: "groups",
    active: "active",
    inactive: "inactive",
    verified: "verified",
    unverified: "not verified",
    generatedAlias: "Generated alias",
    providerEmail: "Provider email (optional)",
    notes: "Notes",
    markForReview: "Mark for review",
    reviewHelp: "If an admin flags a contact, it goes straight to the review queue even without 5 reviewer reports yet.",
    noReply: "No reply",
    notProvider: "Not a provider",
    trusted: "Trusted",
    scam: "Scam",
    brokenContact: "Broken contact",
    activeToggle: "Active",
    verifiedToggle: "Verified",
    updateContact: "Update contact",
    deleteContact: "Delete contact",
    showMore: "Show 10 more",
    noProviders: "No providers match that filter.",
  },
} as const;

export function AdminProviderManager({
  contacts,
  whatsappPrefixOptions,
  duplicateGroups = [],
  language,
}: AdminProviderManagerProps) {
  const copy = PROVIDER_MANAGER_COPY[language];
  const [query, setQuery] = useState("");
  const [openContactId, setOpenContactId] = useState<number | null>(contacts[0]?.id ?? null);
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const deferredQuery = useDeferredValue(query);

  const duplicateIdSet = useMemo(() => new Set(duplicateGroups.flatMap((group) => group.contactIds)), [duplicateGroups]);

  const filteredContacts = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return contacts.filter((contact) => {
      if (duplicatesOnly && !duplicateIdSet.has(contact.id)) {
        return false;
      }

      const methods = getContactFieldValues(contact.contact_methods, contact.url, contact.network);
      const haystack = [
        contact.title,
        contact.email,
        contact.network,
        contact.url,
        contact.notes,
        methods.whatsapp,
        methods.instagram,
        methods.messenger,
        methods.facebook,
        contact.is_active ? copy.active : copy.inactive,
        contact.is_verified ? copy.verified : copy.unverified,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!normalizedQuery) {
        return true;
      }

      return haystack.includes(normalizedQuery);
    });
  }, [contacts, copy.active, copy.inactive, copy.unverified, copy.verified, deferredQuery, duplicateIdSet, duplicatesOnly]);

  const visibleContacts = filteredContacts.slice(0, visibleCount);
  const hasMoreContacts = filteredContacts.length > visibleCount;

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-[1.2rem] border border-[#eadfd6] bg-[#fcfaf7] p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1">
            <label className="text-sm font-semibold text-[#131316]" htmlFor="provider-search">
              {copy.searchProvider}
            </label>
            <input
              id="provider-search"
              className="input mt-2"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setVisibleCount(10);
              }}
              placeholder={copy.searchPlaceholder}
            />
          </div>
          <label className="mt-7 flex items-center gap-2 text-sm text-[#62564a]">
            <input
              type="checkbox"
              checked={duplicatesOnly}
              onChange={(event) => {
                setDuplicatesOnly(event.target.checked);
                setVisibleCount(10);
              }}
            />
            <span>{copy.duplicatesOnly}</span>
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 text-sm text-[#62626d]">
        <span>{filteredContacts.length} {copy.matches}</span>
        {query || duplicatesOnly ? (
          <button
            className="font-semibold text-[#dc4f1f]"
            type="button"
            onClick={() => {
              setQuery("");
              setDuplicatesOnly(false);
              setVisibleCount(10);
            }}
          >
            {copy.clearFilter}
          </button>
        ) : null}
      </div>

      {duplicateGroups.length ? (
        <div className="rounded-[1.2rem] border border-[#f0d7ca] bg-[#fff8f4] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#131316]">{copy.possibleDuplicates}</p>
              <p className="mt-1 text-xs text-[#62564a]">{copy.duplicateHelp}</p>
            </div>
            <span className="rounded-full bg-[#fff2eb] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#dc4f1f]">
              {duplicateGroups.length} {copy.groups}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {duplicateGroups.slice(0, 8).map((group) => (
              <button
                key={group.key}
                type="button"
                className="w-full rounded-[1rem] bg-white px-3 py-3 text-left"
                onClick={() => {
                  setDuplicatesOnly(true);
                  setOpenContactId(group.contactIds[0] || null);
                }}
              >
                <p className="text-sm font-semibold text-[#131316]">{group.reason}</p>
                <p className="mt-1 text-xs text-[#62564a]">{group.labels.join(" · ")}</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {filteredContacts.length ? (
        <>
          {visibleContacts.map((contact) => {
            const methods = getContactFieldValues(contact.contact_methods, contact.url, contact.network);
            const whatsappValue = methods.whatsapp;
            const prefixMatch = whatsappValue.match(/^\+\d{1,3}/);
            const whatsappPrefix = prefixMatch?.[0] || "+1";
            const whatsappNumber = whatsappValue.replace(/^\+\d{1,3}/, "");
            const selectedPrefixValue =
              whatsappPrefixOptions.find((option) => option.value.endsWith(whatsappPrefix))?.value || "us:+1";
            const isOpen = openContactId === contact.id;
            const duplicateMatch = duplicateGroups.find((group) => group.contactIds.includes(contact.id));

            return (
              <article key={contact.id} className="overflow-hidden rounded-[1.35rem] border border-[#e5ddd3] bg-[#fffdfa]">
                <button
                  className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                  type="button"
                  onClick={() => setOpenContactId((current) => (current === contact.id ? null : contact.id))}
                >
                  <div>
                    <p className="font-semibold">{contact.title}</p>
                    <p className="mt-1 text-xs text-[#62626d]">
                      {contact.is_active ? copy.active : copy.inactive} · {contact.is_verified ? copy.verified : copy.unverified}
                    </p>
                    {duplicateMatch ? <p className="mt-2 text-xs font-semibold text-[#c24d3a]">{duplicateMatch.reason}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#f6f0e9] px-3 py-1 text-xs font-semibold text-[#62564a]">#{contact.id}</span>
                    <span className="text-lg text-[#8f857b]">{isOpen ? "-" : "+"}</span>
                  </div>
                </button>

                {isOpen ? (
                  <div className="border-t border-[#efe5db] px-4 py-4">
                    <form action={updateProviderContact} className="grid gap-2">
                      <input type="hidden" name="contact_id" value={contact.id} />
                      <div className="rounded-[1.2rem] border border-[#eadfd6] bg-[#fcfaf7] px-4 py-3 text-sm text-[#62564a]">
                        {copy.generatedAlias}: <span className="font-semibold text-[#131316]">{contact.title}</span>
                      </div>
                      <input
                        className="input"
                        name="email"
                        defaultValue={contact.email || ""}
                        placeholder={copy.providerEmail}
                        type="email"
                      />
                      <div className="rounded-[1.2rem] border border-[#eadfd6] bg-[#fcfaf7] p-3">
                        <p className="text-sm font-semibold text-[#131316]">WhatsApp</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,220px)_1fr]">
                          <WhatsappCountrySelect
                            name="whatsapp_prefix"
                            options={whatsappPrefixOptions}
                            defaultValue={selectedPrefixValue}
                          />
                          <input
                            className="input h-14"
                            name="whatsapp_number"
                            defaultValue={whatsappNumber}
                            placeholder="786703994"
                            inputMode="numeric"
                          />
                        </div>
                      </div>
                      <input className="input" name="instagram" defaultValue={methods.instagram} placeholder="Instagram" />
                      <input className="input" name="messenger" defaultValue={methods.messenger} placeholder="Messenger" />
                      <input className="input" name="facebook" defaultValue={methods.facebook} placeholder="Facebook" />
                      <textarea className="input min-h-24" name="notes" defaultValue={contact.notes || ""} placeholder={copy.notes} />
                      <div className="flex flex-wrap gap-4 text-sm text-[#62626d]">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" name="is_active" defaultChecked={contact.is_active} />
                          <span>{copy.activeToggle}</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" name="is_verified" defaultChecked={contact.is_verified} />
                          <span>{copy.verifiedToggle}</span>
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button className="btn-secondary" type="submit">
                          {copy.updateContact}
                        </button>
                      </div>
                    </form>

                    <div className="mt-4 rounded-[1.2rem] border border-[#eadfd6] bg-[#fcfaf7] p-3">
                      <p className="text-sm font-semibold text-[#131316]">{copy.markForReview}</p>
                      <p className="mt-1 text-xs text-[#62564a]">{copy.reviewHelp}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {[
                          { value: "no_reply", label: copy.noReply },
                          { value: "not_provider", label: copy.notProvider },
                          { value: "trusted", label: copy.trusted },
                          { value: "scam", label: copy.scam },
                          { value: "broken_contact", label: copy.brokenContact },
                        ].map((option) => (
                          <form key={`${contact.id}-${option.value}`} action={createProviderContactAdminReport}>
                            <input type="hidden" name="contact_id" value={contact.id} />
                            <input type="hidden" name="report_type" value={option.value} />
                            <button
                              className="rounded-full border border-[#eadfd6] bg-white px-3 py-2 text-xs font-semibold text-[#62564a] transition hover:border-[#dc4f1f] hover:text-[#dc4f1f]"
                              type="submit"
                            >
                              {option.label}
                            </button>
                          </form>
                        ))}
                      </div>
                    </div>

                    <form action={deleteProviderContact} className="mt-3">
                      <input type="hidden" name="contact_id" value={contact.id} />
                      <button className="rounded-full border border-[#f0c8bb] px-4 py-2 text-sm font-semibold text-[#d14f28]" type="submit">
                        {copy.deleteContact}
                      </button>
                    </form>
                  </div>
                ) : null}
              </article>
            );
          })}
          {hasMoreContacts ? (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                className="rounded-full border border-[#eadfd6] bg-white px-5 py-2 text-sm font-semibold text-[#62564a] transition hover:border-[#dc4f1f] hover:text-[#dc4f1f]"
                onClick={() => setVisibleCount((current) => Math.min(filteredContacts.length, current + 10))}
              >
                {copy.showMore}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="rounded-[1.2rem] border border-dashed border-[#e2d8cc] bg-[#fffaf5] p-5 text-sm text-[#62626d]">
          {copy.noProviders}
        </div>
      )}
    </div>
  );
}
