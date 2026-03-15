"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { deleteProviderContact, updateProviderContact } from "@/app/admin/actions";
import { getContactFieldValues } from "@/lib/provider-contact";

type ContactRow = {
  id: number;
  title: string;
  network: string | null;
  url: string;
  notes?: string | null;
  is_active: boolean;
  is_verified: boolean;
  contact_methods?: string | null;
};

type WhatsappPrefixOption = {
  flag: string;
  label: string;
  value: string;
};

type AdminProviderManagerProps = {
  contacts: ContactRow[];
  whatsappPrefixOptions: readonly WhatsappPrefixOption[];
};

export function AdminProviderManager({ contacts, whatsappPrefixOptions }: AdminProviderManagerProps) {
  const [query, setQuery] = useState("");
  const [openContactId, setOpenContactId] = useState<number | null>(contacts[0]?.id ?? null);
  const deferredQuery = useDeferredValue(query);

  const filteredContacts = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return contacts;
    }

    return contacts.filter((contact) => {
      const methods = getContactFieldValues(contact.contact_methods, contact.url, contact.network);
      const haystack = [
        contact.title,
        contact.network,
        contact.url,
        contact.notes,
        methods.whatsapp,
        methods.instagram,
        methods.messenger,
        contact.is_active ? "activo" : "inactivo",
        contact.is_verified ? "verificado" : "sin verificar",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [contacts, deferredQuery]);

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-[1.2rem] border border-[#eadfd6] bg-[#fcfaf7] p-3">
        <label className="text-sm font-semibold text-[#131316]" htmlFor="provider-search">
          Buscar proveedor
        </label>
        <input
          id="provider-search"
          className="input mt-2"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nombre, WhatsApp, Instagram, Messenger o nota"
        />
      </div>

      <div className="flex items-center justify-between gap-3 text-sm text-[#62626d]">
        <span>{filteredContacts.length} coincidencias</span>
        {query ? (
          <button
            className="font-semibold text-[#dc4f1f]"
            type="button"
            onClick={() => setQuery("")}
          >
            Limpiar filtro
          </button>
        ) : null}
      </div>

      {filteredContacts.length ? (
        filteredContacts.map((contact) => {
          const methods = getContactFieldValues(contact.contact_methods, contact.url, contact.network);
          const whatsappValue = methods.whatsapp;
          const prefixMatch = whatsappValue.match(/^\+\d{1,3}/);
          const whatsappPrefix = prefixMatch?.[0] || "+1";
          const whatsappNumber = whatsappValue.replace(/^\+\d{1,3}/, "");
          const isOpen = openContactId === contact.id;

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
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#f6f0e9] px-3 py-1 text-xs font-semibold text-[#62564a]">
                    #{contact.id}
                  </span>
                  <span className="text-lg text-[#8f857b]">{isOpen ? "−" : "+"}</span>
                </div>
              </button>

              {isOpen ? (
                <div className="border-t border-[#efe5db] px-4 py-4">
                  <form action={updateProviderContact} className="grid gap-2">
                    <input type="hidden" name="contact_id" value={contact.id} />
                    <input className="input" name="title" defaultValue={contact.title} placeholder="Nombre del proveedor" />
                    <div className="rounded-[1.2rem] border border-[#eadfd6] bg-[#fcfaf7] p-3">
                      <p className="text-sm font-semibold text-[#131316]">WhatsApp</p>
                      <div className="mt-3 grid grid-cols-[minmax(0,152px)_1fr] gap-2">
                        <select className="input bg-white" name="whatsapp_prefix" defaultValue={whatsappPrefix}>
                          {whatsappPrefixOptions.map((option) => (
                            <option key={`${contact.id}-${option.label}-${option.value}`} value={option.value}>
                              {option.flag} {option.label} {option.value}
                            </option>
                          ))}
                          {!whatsappPrefixOptions.some((option) => option.value === whatsappPrefix) ? (
                            <option value={whatsappPrefix}>{whatsappPrefix}</option>
                          ) : null}
                        </select>
                        <input
                          className="input"
                          name="whatsapp_number"
                          defaultValue={whatsappNumber}
                          placeholder="786703994"
                          inputMode="numeric"
                        />
                      </div>
                    </div>
                    <input className="input" name="instagram" defaultValue={methods.instagram} placeholder="Instagram" />
                    <input className="input" name="messenger" defaultValue={methods.messenger} placeholder="Messenger" />
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
                      <button className="btn-secondary" type="submit">Actualizar contacto</button>
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
