import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";
import { hasAdminAccess } from "@/lib/admin";
import { getContactFieldValues } from "@/lib/provider-contact";
import { createAdminUser, createProviderContact, deleteProviderContact, updateMemberStatus, updateProviderContact } from "./actions";

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
  notes?: string | null;
  is_active: boolean;
  is_verified: boolean;
  contact_methods?: string | null;
};

const WHATSAPP_PREFIX_OPTIONS = [
  { flag: "🇺🇸", label: "USA", value: "+1" },
  { flag: "🇪🇸", label: "España", value: "+34" },
  { flag: "🇨🇺", label: "Cuba", value: "+53" },
  { flag: "🇲🇽", label: "México", value: "+52" },
  { flag: "🇨🇴", label: "Colombia", value: "+57" },
  { flag: "🇩🇴", label: "R. Dominicana", value: "+1" },
] as const;

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

  const withMethods = await supabase
    .from("provider_contacts")
    .select("id, title, network, url, notes, is_active, is_verified, contact_methods")
    .order("created_at", { ascending: false });

  const contacts = withMethods.error
    ? (
        await supabase
          .from("provider_contacts")
          .select("id, title, network, url, notes, is_active, is_verified")
          .order("created_at", { ascending: false })
      ).data?.map((contact) => ({ ...contact, contact_methods: null })) || []
    : withMethods.data || [];

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
              <input className="input" name="title" placeholder="Nombre del proveedor" spellCheck={false} autoCorrect="off" autoCapitalize="off" />
              <div className="rounded-[1.35rem] border border-[#eadfd6] bg-[#fcfaf7] p-3">
                <p className="text-sm font-semibold text-[#131316]">WhatsApp</p>
                <p className="mt-1 text-xs text-[#62626d]">Selecciona el prefijo internacional y escribe el numero sin espacios.</p>
                <div className="mt-3 grid grid-cols-[minmax(0,152px)_1fr] gap-2">
                  <select className="input bg-white" name="whatsapp_prefix" defaultValue="+1">
                    {WHATSAPP_PREFIX_OPTIONS.map((option) => (
                      <option key={`${option.label}-${option.value}`} value={option.value}>
                        {option.flag} {option.label} {option.value}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
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
              <button className="btn-primary" type="submit">Guardar contacto</button>
            </form>
          </div>

          <div className="card p-4">
            <h2 className="font-bold">Usuarios</h2>
            <div className="mt-3 space-y-3">
              {(members as ProfileRow[] | null)?.map((member) => (
                <article key={member.id} className="rounded-xl border border-[#e5e5df] p-3">
                  <p className="font-semibold">{member.full_name || "Sin nombre"}</p>
                  <p className="text-xs text-[#62626d]">{member.email} - rol: {member.role || "sin definir"}</p>
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
            <div className="mt-3 space-y-3">
              {(contacts as ContactRow[]).map((contact) => {
                const methods = getContactFieldValues(contact.contact_methods, contact.url, contact.network);
                const whatsappValue = methods.whatsapp;
                const prefixMatch = whatsappValue.match(/^\+\d{1,3}/);
                const whatsappPrefix = prefixMatch?.[0] || "+1";
                const whatsappNumber = whatsappValue.replace(/^\+\d{1,3}/, "");

                return (
                  <article key={contact.id} className="rounded-[1.35rem] border border-[#e5ddd3] bg-[#fffdfa] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{contact.title}</p>
                        <p className="text-xs text-[#62626d]">
                          {contact.is_active ? "activo" : "inactivo"} · {contact.is_verified ? "verificado" : "sin verificar"}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#f6f0e9] px-3 py-1 text-xs font-semibold text-[#62564a]">
                        #{contact.id}
                      </span>
                    </div>

                    <form action={updateProviderContact} className="mt-4 grid gap-2">
                      <input type="hidden" name="contact_id" value={contact.id} />
                      <input className="input" name="title" defaultValue={contact.title} placeholder="Nombre del proveedor" />
                      <div className="rounded-[1.2rem] border border-[#eadfd6] bg-[#fcfaf7] p-3">
                        <p className="text-sm font-semibold text-[#131316]">WhatsApp</p>
                        <div className="mt-3 grid grid-cols-[minmax(0,152px)_1fr] gap-2">
                          <select className="input bg-white" name="whatsapp_prefix" defaultValue={whatsappPrefix}>
                            {WHATSAPP_PREFIX_OPTIONS.map((option) => (
                              <option key={`${contact.id}-${option.label}-${option.value}`} value={option.value}>
                                {option.flag} {option.label} {option.value}
                              </option>
                            ))}
                            {!WHATSAPP_PREFIX_OPTIONS.some((option) => option.value === whatsappPrefix) ? (
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

                    <form action={deleteProviderContact} className="mt-2">
                      <input type="hidden" name="contact_id" value={contact.id} />
                      <button className="rounded-full border border-[#f0c8bb] px-4 py-2 text-sm font-semibold text-[#d14f28]" type="submit">
                        Eliminar contacto
                      </button>
                    </form>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
