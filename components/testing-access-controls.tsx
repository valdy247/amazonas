"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type TestingAccessControlsProps = {
  stage: "payment" | "kyc" | "reset";
};

export function TestingAccessControls({ stage }: TestingAccessControlsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [activeAction, setActiveAction] = useState<string | null>(null);

  function run(action: string) {
    setError(null);
    setActiveAction(action);

    startTransition(async () => {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("No se pudo validar tu sesion.");
        setActiveAction(null);
        return;
      }

      const currentMeta = (user.user_metadata || {}) as Record<string, unknown>;
      let nextMeta: Record<string, unknown>;

      if (action === "paid" || action === "skip_payment") {
        nextMeta = {
          ...currentMeta,
          testing_payment_state: "active",
        };
      } else if (action === "approve_kyc") {
        nextMeta = {
          ...currentMeta,
          testing_kyc_state: "approved",
        };
      } else {
        nextMeta = {
          ...currentMeta,
          testing_payment_state: "pending_payment",
          testing_kyc_state: "pending",
        };
      }

      const { error: updateError } = await supabase.auth.updateUser({ data: nextMeta });

      if (updateError) {
        setError(updateError.message);
        setActiveAction(null);
        return;
      }

      setActiveAction(null);
      router.refresh();
    });
  }

  return (
    <div className="mt-3 grid gap-2">
      {stage === "payment" ? (
        <>
          <button className="btn-primary w-full" type="button" onClick={() => run("paid")} disabled={isPending}>
            {isPending && activeAction === "paid" ? "Guardando..." : "Ya pague"}
          </button>
          <button className="btn-secondary w-full" type="button" onClick={() => run("skip_payment")} disabled={isPending}>
            {isPending && activeAction === "skip_payment" ? "Guardando..." : "No voy a pagar por ahora"}
          </button>
        </>
      ) : null}

      {stage === "kyc" ? (
        <>
          <button className="btn-primary w-full" type="button" onClick={() => run("approve_kyc")} disabled={isPending}>
            {isPending && activeAction === "approve_kyc" ? "Guardando..." : "Aprobar KYC de prueba"}
          </button>
          <button className="btn-secondary w-full" type="button" onClick={() => run("reset")} disabled={isPending}>
            {isPending && activeAction === "reset" ? "Guardando..." : "Dejar KYC pendiente"}
          </button>
        </>
      ) : null}

      {stage === "reset" ? (
        <button className="btn-secondary w-full" type="button" onClick={() => run("reset")} disabled={isPending}>
          {isPending && activeAction === "reset" ? "Guardando..." : "Reiniciar flujo de prueba"}
        </button>
      ) : null}

      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
    </div>
  );
}
