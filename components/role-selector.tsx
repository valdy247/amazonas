"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Role = "tester" | "provider";

export function RoleSelector() {
  const [role, setRole] = useState<Role>("tester");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleContinue() {
    if (!acceptTerms) {
      setError("Debes aceptar términos y política.");
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("No se pudo validar la sesión.");
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ role, accepted_terms_at: new Date().toISOString() })
      .eq("id", user.id);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="card space-y-5 p-4">
      <h1 className="text-2xl font-bold">Selecciona tu perfil</h1>
      <p className="text-sm text-[#62626d]">Esto define la experiencia inicial dentro de la plataforma.</p>

      <div className="grid gap-3">
        <button
          type="button"
          onClick={() => setRole("tester")}
          className={`rounded-2xl border p-4 text-left ${role === "tester" ? "border-[#ff6b35] bg-[#fff3ec]" : "border-[#e5e5df]"}`}
        >
          <p className="font-semibold">Soy Tester</p>
          <p className="text-sm text-[#62626d]">Quiero probar productos y acceder a contactos verificados.</p>
        </button>
        <button
          type="button"
          onClick={() => setRole("provider")}
          className={`rounded-2xl border p-4 text-left ${role === "provider" ? "border-[#ff6b35] bg-[#fff3ec]" : "border-[#e5e5df]"}`}
        >
          <p className="font-semibold">Soy Proveedor</p>
          <p className="text-sm text-[#62626d]">Quiero enviar productos a testers verificados.</p>
        </button>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
        <span>Acepto términos, privacidad y reglas de cumplimiento.</span>
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button type="button" onClick={handleContinue} disabled={loading} className="btn-primary w-full">
        {loading ? "Guardando..." : "Continuar"}
      </button>
    </div>
  );
}


