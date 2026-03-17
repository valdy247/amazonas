"use client";

import { useActionState } from "react";
import { createAdminUserAction, type AdminActionState } from "@/app/admin/actions";

const idleAdminActionState: AdminActionState = {
  status: "idle",
  message: "",
};

export function AdminOptionsPanel() {
  const [state, action, pending] = useActionState(createAdminUserAction, idleAdminActionState);

  return (
    <div className="card p-4">
      <h2 className="font-bold">Opciones admin</h2>
      <p className="mt-1 text-sm text-[#62626d]">Gestiona permisos internos, administradores y accesos especiales.</p>
      <form action={action} noValidate className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start">
        <input className="input" name="email" placeholder="correo@dominio.com" type="email" required />
        <button className="btn-primary" type="submit" disabled={pending}>
          {pending ? "Asignando..." : "Asignar admin"}
        </button>
      </form>
      {state.status !== "idle" ? (
        <p className={`mt-3 text-sm font-semibold ${state.status === "success" ? "text-[#177a52]" : "text-[#c24d3a]"}`}>
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
