"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { deleteProviderContact, updateProviderContact } from "@/app/admin/actions";
import { WhatsappCountrySelect } from "@/components/whatsapp-country-select";
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
};

export function AdminProviderManager({
  contacts,
  whatsappPrefixOptions,
  duplicateGroups = [],
}: AdminProviderManagerProps) {
  const [query, setQuery] = useState("");
  const [openContactId, setOpenContactId] = useState<number | null>(contacts[0]?.id ?? null);
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
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
        contact.is_active ? "activo" : "inactivo",
        contact.is_verified ? "verificado" : "sin verificar",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!normalizedQuery) {
        return true;
      }

      return haystack.includes(normalizedQuery);
    });
  }, [contacts, deferredQuery, duplicateIdSet, duplicatesOnly]);

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-[1.2rem] border border-[#eadfd6] bg-[#fcfaf7] p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1">
            <label className="text-sm font-semibold text-[#131316]" htmlFor="provider-search">
              Buscar proveedor
            </label>
            <input
              id="provider-search"
              className="input mt-2"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Alias, WhatsApp, Instagram, Messenger, Facebook, email o nota"
            />
          </div>
          <label className="mt-7 flex items-center gap-2 text-sm text-[#62564a]">
            <input type="checkbox" checked={duplicatesOnly} onChange={(event) => setDuplicatesOnly(event.target.checked)} />
            <span>Solo duplicados</span>
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 text-sm text-[#62626d]">
        <span>{filteredContacts.length} coincidencias</span>
        {query || duplicatesOnly ? (
          <button
            className="font-semibold text-[#dc4f1f]"
            type="button"
            onClick={() => {
              setQuery("");
              setDuplicatesOnly(false);
            }}
          >
            Limpiar filtro
          </button>
        ) : null}
      </div>

      {duplicateGroups.length ? (
        <div className="rounded-[1.2rem] border border-[#f0d7ca] bg-[#fff8f4] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#131316]">Posibles duplicados</p>
              <p className="mt-1 text-xs text-[#62564a]">Agrupados por email o metodo de contacto comparable.</p>
            </div>
            <span className="rounded-full bg-[#fff2eb] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#dc4f1f]">
              {duplicateGroups.length} grupos
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
        filteredContacts.map((contact) => {
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
                    {contact.is_active ? "activo" : "inactivo"} · {contact.is_verified ? "verificado" : "sin verificar"}
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
                      Alias generado: <span className="font-semibold text-[#131316]">{contact.title}</span>
                    </div>
                    <input
                      className="input"
                      name="email"
                      defaultValue={contact.email || ""}
                      placeholder="Correo del proveedor (opcional)"
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
                    <textarea className="input min-h-24" name="notes" defaultValue={contact.notes || ""} placeholder="Notas" />
                    <div className="flex flex-wrap gap-4 text-sm text-[#62626d]">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" name="is_active" defaultChecked={contact.is_active} />
                        <span>Activo</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" name="is_verified" defaultChecked={contact.is_verified} />
                        <span>Verificado</span>
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className="btn-secondary" type="submit">
                        Actualizar contacto
                      </button>
                    </div>
                  </form>

                  <form action={deleteProviderContact} className="mt-3">
                    <input type="hidden" name="contact_id" value={contact.id} />
                    <button className="rounded-full border border-[#f0c8bb] px-4 py-2 text-sm font-semibold text-[#d14f28]" type="submit">
                      Eliminar contacto
                    </button>
                  </form>
                </div>
              ) : null}
            </article>
          );
        })
      ) : (
        <div className="rounded-[1.2rem] border border-dashed border-[#e2d8cc] bg-[#fffaf5] p-5 text-sm text-[#62626d]">
          No hay proveedores que coincidan con ese filtro.
        </div>
      )}
    </div>
  );
}

