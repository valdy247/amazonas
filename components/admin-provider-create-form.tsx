"use client";

import { useActionState } from "react";
import { createProviderContactAction, type ProviderCreateFormState } from "@/app/admin/actions";
import { WhatsappCountrySelect } from "@/components/whatsapp-country-select";
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
          <div>
            <p className="text-sm font-semibold text-[#131316]">WhatsApp</p>
            <p className="mt-1 text-xs text-[#62626d]">Selecciona el país y escribe el número sin espacios para dar soporte mundial.</p>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,220px)_1fr]">
            <WhatsappCountrySelect name="whatsapp_prefix" options={whatsappPrefixOptions} defaultValue="us:+1" />
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
        <input className="input" name="instagram" placeholder="Instagram. Ej: instagram.com/usuario o usuario" spellCheck={false} autoCorrect="off" autoCapitalize="off" />
        <input className="input" name="messenger" placeholder="Messenger username o enlace" spellCheck={false} autoCorrect="off" autoCapitalize="off" />
        <input className="input" name="facebook" placeholder="Facebook username o enlace" spellCheck={false} autoCorrect="off" autoCapitalize="off" />
        <textarea className="input min-h-24" name="notes" placeholder="Notas" spellCheck={false} autoCorrect="off" autoCapitalize="off" />
        <p className="text-xs text-[#62626d]">Debes completar al menos uno: WhatsApp, Instagram, Messenger o Facebook.</p>
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
