"use client";

import { useActionState } from "react";
import { ChevronDown, Globe2 } from "lucide-react";
import { createProviderContactAction, type ProviderCreateFormState } from "@/app/admin/actions";
import type { WhatsappPrefixOption } from "@/lib/whatsapp-prefix-options";

type AdminProviderCreateFormProps = {
  whatsappPrefixOptions: readonly WhatsappPrefixOption[];
};

export function AdminProviderCreateForm({ whatsappPrefixOptions }: AdminProviderCreateFormProps) {
  const initialState: ProviderCreateFormState = { status: "idle", message: "" };
  const [state, formAction, isPending] = useActionState(createProviderContactAction, initialState);

  return (
    <details>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Agregar proveedor</h2>
          <p className="mt-1 text-sm text-[#62626d]">Toca para desplegar el formulario. El alias se generara automaticamente.</p>
        </div>
        <span className="rounded-full bg-[#fff2eb] px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#dc4f1f]">
          Nuevo
        </span>
      </summary>

      <form action={formAction} noValidate className="mt-4 grid gap-2">
        <div className="rounded-[1.2rem] border border-[#eadfd6] bg-[#fcfaf7] px-4 py-3 text-sm text-[#62564a]">
          El nombre visible se generara automaticamente como <span className="font-semibold text-[#131316]">Proveedor 101, 102, 103...</span>
        </div>
        <input className="input" name="email" placeholder="Correo del proveedor (opcional)" type="email" spellCheck={false} autoCorrect="off" autoCapitalize="off" />
        <div className="rounded-[1.35rem] border border-[#eadfd6] bg-[#fcfaf7] p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#131316]">WhatsApp</p>
              <p className="mt-1 text-xs text-[#62626d]">Selecciona el pais y escribe el numero sin espacios para dar soporte mundial.</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#dc4f1f] shadow-[0_10px_24px_rgba(220,79,31,0.08)]">
              <Globe2 className="h-3.5 w-3.5" />
              Cobertura mundial
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,220px)_1fr]">
            <div className="relative">
              <select
                className="input h-14 w-full appearance-none bg-white pl-4 pr-11 text-sm font-semibold text-[#131316] shadow-[0_12px_24px_rgba(18,18,23,0.05)]"
                name="whatsapp_prefix"
                defaultValue="us:+1"
              >
                {whatsappPrefixOptions.map((option) => (
                  <option key={`${option.label}-${option.value}`} value={option.value}>
                    {option.flag} {option.label} {option.value.split(":").slice(-1)[0]}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-[#8f857b]" />
            </div>
            <input
              className="input h-14"
              name="whatsapp_number"
              placeholder="786703994"
              inputMode="numeric"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
            />
          </div>
        </div>
        <input className="input" name="instagram" placeholder="Instagram. Ej: instagram.com/usuario o https://instagram.com/usuario" spellCheck={false} autoCorrect="off" autoCapitalize="off" />
        <input className="input" name="messenger" placeholder="Messenger. Ej: m.me/usuario o https://m.me/usuario" spellCheck={false} autoCorrect="off" autoCapitalize="off" />
        <textarea className="input min-h-24" name="notes" placeholder="Notas" spellCheck={false} autoCorrect="off" autoCapitalize="off" />
        <p className="text-xs text-[#62626d]">Debes completar al menos uno: WhatsApp, Instagram o Messenger.</p>
        <label className="flex items-center gap-2 text-sm text-[#62626d]">
          <input type="checkbox" name="is_verified" />
          <span>Marcar como verificado</span>
        </label>

        {state.status === "error" ? (
          <div className="rounded-[1.35rem] border border-[#f2cbc1] bg-[linear-gradient(180deg,#fff4ef_0%,#fffaf7_100%)] px-4 py-3 text-sm font-semibold text-[#c64b1e]">
            {state.message}
          </div>
        ) : null}

        {state.status === "success" ? (
          <div className="rounded-[1.35rem] border border-[#d7ead9] bg-[linear-gradient(180deg,#f4fff4_0%,#fbfffb_100%)] px-4 py-3 text-sm font-semibold text-[#1f7a4d]">
            {state.message}
          </div>
        ) : null}

        <button className="btn-primary" type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : "Guardar contacto"}
        </button>
      </form>
    </details>
  );
}
