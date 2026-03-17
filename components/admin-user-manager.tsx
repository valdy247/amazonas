"use client";

import { useActionState, useDeferredValue, useMemo, useState } from "react";
import { formatMembershipDate } from "@/lib/membership";
import {
  sendPasswordRecoveryForUserAction,
  updateMemberStatus,
  updateUserEmailAction,
  type AdminActionState,
} from "@/app/admin/actions";

type MemberRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  membershipStatus: string;
  membershipCurrentPeriodEndAt?: string | null;
  membershipCanceledAt?: string | null;
  membershipLastPaymentFailedAt?: string | null;
  membershipSquareCustomerId?: string | null;
  membershipSquareOrderId?: string | null;
  membershipSquareSubscriptionId?: string | null;
  kycStatus: string;
  kycReferenceId?: string | null;
  kycVerifiedFullName?: string | null;
  kycReviewNote?: string | null;
  kycReviewedAt?: string | null;
};

type AdminUserManagerProps = {
  members: MemberRow[];
};

const idleAdminActionState: AdminActionState = {
  status: "idle",
  message: "",
};

function getRoleMeta(role: string | null) {
  switch (role) {
    case "admin":
      return { label: "Admin", className: "bg-[#ffe8dc] text-[#c64b1e]" };
    case "provider":
      return { label: "Provider", className: "bg-[#efe7ff] text-[#6f4ad1]" };
    case "reviewer":
    case "tester":
      return { label: "Reseñador", className: "bg-[#e8f7f0] text-[#177a52]" };
    default:
      return { label: "Pendiente", className: "bg-[#f3efe9] text-[#62564a]" };
  }
}

function getMembershipMeta(status: string) {
  switch (status) {
    case "active":
      return { label: "Activa", className: "bg-[#e8f7f0] text-[#177a52]" };
    case "payment_processing":
      return { label: "Validando pago", className: "bg-[#fff3dc] text-[#b77212]" };
    case "payment_failed":
      return { label: "Cobro fallido", className: "bg-[#fff4e8] text-[#b55a10]" };
    case "canceled":
      return { label: "Cancelada", className: "bg-[#f3efe9] text-[#62564a]" };
    case "suspended":
      return { label: "Suspendida", className: "bg-[#fff1f1] text-[#c24d3a]" };
    default:
      return { label: "Pago pendiente", className: "bg-[#f3efe9] text-[#62564a]" };
  }
}

function getKycMeta(status: string) {
  switch (status) {
    case "approved":
      return { label: "Aprobado", className: "bg-[#e8f7f0] text-[#177a52]" };
    case "rejected":
      return { label: "Rechazado", className: "bg-[#fff1f1] text-[#c24d3a]" };
    case "in_review":
      return { label: "En revision", className: "bg-[#fff3dc] text-[#b77212]" };
    default:
      return { label: "Pendiente", className: "bg-[#f3efe9] text-[#62564a]" };
  }
}

function AdminAccountActions({ member }: { member: MemberRow }) {
  const [recoveryState, recoveryAction, recoveryPending] = useActionState(
    sendPasswordRecoveryForUserAction,
    idleAdminActionState
  );
  const [emailState, emailAction, emailPending] = useActionState(updateUserEmailAction, idleAdminActionState);

  return (
    <div className="mt-4 grid gap-3 rounded-[1.1rem] border border-[#efe5db] bg-[#fffaf6] p-3 sm:grid-cols-2">
      <form action={recoveryAction} className="flex flex-col gap-2">
        <input type="hidden" name="user_id" value={member.id} />
        <input type="hidden" name="email" value={member.email || ""} />
        <p className="text-sm font-semibold text-[#131316]">Recuperacion</p>
        <p className="text-xs text-[#62626d]">Envia un correo para que el usuario cambie su contrasena.</p>
        <button className="btn-secondary" type="submit" disabled={!member.email || recoveryPending}>
          {recoveryPending ? "Enviando..." : "Enviar recuperacion"}
        </button>
        {recoveryState.status !== "idle" ? (
          <p className={`text-xs ${recoveryState.status === "success" ? "text-[#177a52]" : "text-[#c24d3a]"}`}>
            {recoveryState.message}
          </p>
        ) : null}
      </form>

      <form action={emailAction} className="flex flex-col gap-2">
        <input type="hidden" name="user_id" value={member.id} />
        <p className="text-sm font-semibold text-[#131316]">Cambiar email</p>
        <input
          className="input"
          type="email"
          name="new_email"
          placeholder="nuevo@correo.com"
          defaultValue={member.email || ""}
          required
        />
        <button className="btn-secondary" type="submit" disabled={emailPending}>
          {emailPending ? "Guardando..." : "Cambiar email"}
        </button>
        {emailState.status !== "idle" ? (
          <p className={`text-xs ${emailState.status === "success" ? "text-[#177a52]" : "text-[#c24d3a]"}`}>
            {emailState.message}
          </p>
        ) : null}
      </form>
    </div>
  );
}

export function AdminUserManager({ members }: AdminUserManagerProps) {
  const [query, setQuery] = useState("");
  const [openUserId, setOpenUserId] = useState<string | null>(members[0]?.id ?? null);
  const deferredQuery = useDeferredValue(query);

  const filteredMembers = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return members;
    }

    return members.filter((member) =>
      [member.full_name, member.email, member.role, member.membershipStatus, member.kycStatus]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [deferredQuery, members]);

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-[1.2rem] border border-[#eadfd6] bg-[#fcfaf7] p-3">
        <label className="text-sm font-semibold text-[#131316]" htmlFor="user-search">
          Buscar usuario
        </label>
        <input
          id="user-search"
          className="input mt-2"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nombre, correo o rol"
        />
      </div>

      <div className="flex items-center justify-between gap-3 text-sm text-[#62626d]">
        <span>{filteredMembers.length} coincidencias</span>
        {query ? (
          <button className="font-semibold text-[#dc4f1f]" type="button" onClick={() => setQuery("")}>
            Limpiar filtro
          </button>
        ) : null}
      </div>

      {filteredMembers.length ? (
        filteredMembers.map((member) => {
          const isOpen = openUserId === member.id;
          const roleMeta = getRoleMeta(member.role);
          const membershipMeta = getMembershipMeta(member.membershipStatus);
          const kycMeta = getKycMeta(member.kycStatus);

          return (
            <article key={member.id} className="overflow-hidden rounded-[1.35rem] border border-[#e5ddd3] bg-[#fffdfa]">
              <button
                className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                type="button"
                onClick={() => setOpenUserId((current) => (current === member.id ? null : member.id))}
              >
                <div>
                  <p className="font-semibold">{member.full_name || "Sin nombre"}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-[#62626d]">{member.email || "Sin correo"}</span>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${roleMeta.className}`}>
                      {roleMeta.label}
                    </span>
                    <span className="rounded-full bg-[#f6f0e9] px-3 py-1 text-[11px] font-semibold text-[#62564a]">
                      ID: {member.id.slice(0, 8)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${membershipMeta.className}`}>
                    {membershipMeta.label}
                  </span>
                  <span className="text-lg text-[#8f857b]">{isOpen ? "-" : "+"}</span>
                </div>
              </button>

              {isOpen ? (
                <div className="border-t border-[#efe5db] px-4 py-4">
                  <div className="mb-3 flex flex-wrap gap-2 text-xs font-semibold text-[#62564a]">
                    <span className={`rounded-full px-3 py-1 ${roleMeta.className}`}>Rol: {roleMeta.label}</span>
                    <span className={`rounded-full px-3 py-1 ${membershipMeta.className}`}>Membresia: {membershipMeta.label}</span>
                    <span className={`rounded-full px-3 py-1 ${kycMeta.className}`}>KYC: {kycMeta.label}</span>
                  </div>

                  <div className="mb-4 grid gap-2 rounded-[1.1rem] border border-[#efe5db] bg-[#fffaf6] p-3 text-sm text-[#62564a]">
                    <p>
                      <span className="font-semibold text-[#131316]">User ID:</span> {member.id}
                    </p>
                    <p>
                      <span className="font-semibold text-[#131316]">Customer ID:</span>{" "}
                      {member.membershipSquareCustomerId || "Sin customer"}
                    </p>
                    <p>
                      <span className="font-semibold text-[#131316]">Order ID:</span>{" "}
                      {member.membershipSquareOrderId || "Sin order"}
                    </p>
                    <p>
                      <span className="font-semibold text-[#131316]">Subscription ID:</span>{" "}
                      {member.membershipSquareSubscriptionId || "Sin subscription"}
                    </p>
                    <p>
                      <span className="font-semibold text-[#131316]">Fin de periodo:</span>{" "}
                      {formatMembershipDate(member.membershipCurrentPeriodEndAt, "es") || "Sin fecha"}
                    </p>
                    <p>
                      <span className="font-semibold text-[#131316]">Cancelada en:</span>{" "}
                      {formatMembershipDate(member.membershipCanceledAt, "es") || "No cancelada"}
                    </p>
                    <p>
                      <span className="font-semibold text-[#131316]">Ultimo fallo de cobro:</span>{" "}
                      {formatMembershipDate(member.membershipLastPaymentFailedAt, "es") || "Sin fallos"}
                    </p>
                    <p>
                      <span className="font-semibold text-[#131316]">Referencia KYC:</span>{" "}
                      {member.kycReferenceId || "Sin referencia"}
                    </p>
                    <p>
                      <span className="font-semibold text-[#131316]">Nombre verificado:</span>{" "}
                      {member.kycVerifiedFullName || "Aun no disponible"}
                    </p>
                    <p>
                      <span className="font-semibold text-[#131316]">Revision KYC:</span>{" "}
                      {member.kycReviewedAt || "Sin fecha"}
                    </p>
                    {member.kycReviewNote ? (
                      <p>
                        <span className="font-semibold text-[#131316]">Nota de revision:</span> {member.kycReviewNote}
                      </p>
                    ) : null}
                  </div>

                  <form action={updateMemberStatus} className="grid gap-3 rounded-[1.1rem] border border-[#efe5db] bg-[#fffaf6] p-3">
                    <input type="hidden" name="user_id" value={member.id} />
                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="grid gap-1 text-sm text-[#62564a]">
                        <span className="font-semibold text-[#131316]">Membresia</span>
                        <select className="input" name="membership_status" defaultValue={member.membershipStatus}>
                          <option value="pending_payment">Pago pendiente</option>
                          <option value="payment_processing">Validando pago</option>
                          <option value="active">Activa</option>
                          <option value="payment_failed">Cobro fallido</option>
                          <option value="canceled">Cancelada</option>
                          <option value="suspended">Suspendida</option>
                        </select>
                      </label>
                      <label className="grid gap-1 text-sm text-[#62564a]">
                        <span className="font-semibold text-[#131316]">Estado KYC</span>
                        <select className="input" name="kyc_status" defaultValue={member.kycStatus}>
                          <option value="pending">Pendiente</option>
                          <option value="in_review">En revision</option>
                          <option value="approved">Aprobado</option>
                          <option value="rejected">Rechazado</option>
                        </select>
                      </label>
                      <label className="grid gap-1 text-sm text-[#62564a] sm:col-span-1">
                        <span className="font-semibold text-[#131316]">Nota de revision</span>
                        <textarea
                          className="input min-h-24"
                          name="kyc_review_note"
                          defaultValue={member.kycReviewNote || ""}
                          placeholder="Explica si hubo mismatch, fraude, reintento o aprobacion manual."
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className="btn-secondary" type="submit">
                        Guardar decision
                      </button>
                    </div>
                  </form>

                  <AdminAccountActions member={member} />
                </div>
              ) : null}
            </article>
          );
        })
      ) : (
        <div className="rounded-[1.2rem] border border-dashed border-[#e2d8cc] bg-[#fffaf5] p-5 text-sm text-[#62626d]">
          No hay usuarios que coincidan con ese filtro.
        </div>
      )}
    </div>
  );
}
