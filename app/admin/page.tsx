import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";
import { hasAdminAccess } from "@/lib/admin";
import { createAdminUser, createProviderContact, updateMemberStatus } from "./actions";

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
};

type MembershipRow = {
  user_id: string;
  status: string;
};

type KycRow = {
  user_id: string;
  status: string;
};

type ContactRow = {
  id: number;
  title: string;
  network: string | null;
  url: string;
  is_active: boolean;
};

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: profile } = await supabase.from("profiles").select("role, email").eq("id", user.id).single();
  const isAdmin = hasAdminAccess(profile?.role, profile?.email || user.email);

  if (!isAdmin) {
    redirect("/dashboard");
  }

  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .order("created_at", { ascending: false })
    .limit(30);

  const memberIds = (members ?? []).map((m) => m.id);

  const { data: memberships } = await supabase
    .from("memberships")
    .select("user_id, status")
    .in("user_id", memberIds);

  const { data: kycRows } = await supabase
    .from("kyc_checks")
    .select("user_id, status")
    .in("user_id", memberIds);

  const membershipByUser = new Map((memberships as MembershipRow[] | null)?.map((m) => [m.user_id, m.status]) ?? []);
  const kycByUser = new Map((kycRows as KycRow[] | null)?.map((k) => [k.user_id, k.status]) ?? []);

  const { data: contacts } = await supabase
    .from("provider_contacts")
    .select("id, title, network, url, is_active")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="container-x space-y-6 py-6">
        <section className="card p-4">
          <h1 className="text-2xl font-bold">Panel admin</h1>
          <p className="mt-1 text-sm text-[#62626d]">Gestiona admins, estados de miembros y contactos de proveedores.</p>
        </section>

        <section className="grid gap-4">
          <div className="card p-4">
            <h2 className="font-bold">Crear admin</h2>
            <form action={createAdminUser} noValidate className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input className="input" name="email" placeholder="correo@dominio.com" />
              <button className="btn-primary" type="submit">Asignar admin</button>
            </form>
          </div>

          <div className="card p-4">
            <h2 className="font-bold">Agregar contacto</h2>
            <form action={createProviderContact} noValidate className="mt-3 grid gap-2">
              <input className="input" name="title" placeholder="Nombre proveedor" spellCheck={false} autoCorrect="off" autoCapitalize="off" />
              <input className="input" name="network" placeholder="Instagram / WhatsApp / Telegram" spellCheck={false} autoCorrect="off" autoCapitalize="off" />
              <input className="input" name="url" placeholder="https://..." spellCheck={false} autoCorrect="off" autoCapitalize="off" />
              <textarea className="input min-h-24" name="notes" placeholder="Notas" spellCheck={false} autoCorrect="off" autoCapitalize="off" />
              <button className="btn-primary" type="submit">Guardar contacto</button>
            </form>
          </div>

          <div className="card p-4">
            <h2 className="font-bold">Usuarios</h2>
            <div className="mt-3 space-y-3">
              {(members as ProfileRow[] | null)?.map((member) => (
                <article key={member.id} className="rounded-xl border border-[#e5e5df] p-3">
                  <p className="font-semibold">{member.full_name || "Sin nombre"}</p>
                  <p className="text-xs text-[#62626d]">{member.email} • rol: {member.role || "sin definir"}</p>
                  <form action={updateMemberStatus} className="mt-2 grid gap-2 sm:grid-cols-4 sm:items-center">
                    <input type="hidden" name="user_id" value={member.id} />
                    <select className="input" name="membership_status" defaultValue={membershipByUser.get(member.id) || "pending_payment"}>
                      <option value="pending_payment">pending_payment</option>
                      <option value="paid">paid</option>
                      <option value="active">active</option>
                      <option value="suspended">suspended</option>
                    </select>
                    <select className="input" name="kyc_status" defaultValue={kycByUser.get(member.id) || "pending"}>
                      <option value="pending">pending</option>
                      <option value="in_review">in_review</option>
                      <option value="approved">approved</option>
                      <option value="rejected">rejected</option>
                    </select>
                    <button className="btn-secondary" type="submit">Actualizar</button>
                  </form>
                </article>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <h2 className="font-bold">Contactos activos</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {(contacts as ContactRow[] | null)?.map((contact) => (
                <li key={contact.id}>
                  {contact.title} - {contact.network || "sin red"} - {contact.is_active ? "activo" : "inactivo"}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
