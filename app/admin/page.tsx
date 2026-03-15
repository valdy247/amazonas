import Link from "next/link";
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
  { flag: "US", label: "USA", value: "+1" },
  { flag: "ES", label: "Espana", value: "+34" },
  { flag: "CU", label: "Cuba", value: "+53" },
  { flag: "MX", label: "Mexico", value: "+52" },
  { flag: "CO", label: "Colombia", value: "+57" },
  { flag: "DO", label: "R. Dominicana", value: "+1" },
] as const;

const ADMIN_SECTIONS = [
  { id: "providers", label: "Proveedores" },
  { id: "users", label: "Usuarios" },
  { id: "options", label: "Opciones" },
] as const;

type AdminPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
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

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const requestedSection = Array.isArray(resolvedSearchParams.section)
    ? resolvedSearchParams.section[0]
    : resolvedSearchParams.section;
  const activeSection = ADMIN_SECTIONS.some((section) => section.id === requestedSection) ? requestedSection : "providers";

  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .order("created_at", { ascending: false })
    .limit(30);

  const memberIds = (members ?? []).map((member) => member.id);

  const { data: memberships } = await supabase.from("memberships").select("user_id, status").in("user_id", memberIds);
  const { data: kycRows } = await supabase.from("kyc_checks").select("user_id, status").in("user_id", memberIds);

  const membershipByUser = new Map((memberships as MembershipRow[] | null)?.map((item) => [item.user_id, item.status]) ?? []);
  const kycByUser = new Map((kycRows as KycRow[] | null)?.map((item) => [item.user_id, item.status]) ?? []);

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
        <section className="overflow-hidden rounded-[1.8rem] border border-[#1f1b17] bg-[linear-gradient(135deg,#201915_0%,#2c221a_55%,#3f2a1d_100%)] p-5 text-white shadow-[0_26px_80px_rgba(35,22,13,0.22)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-white/55">Control Center</p>
              <h1 className="mt-2 text-3xl font-bold">Panel admin</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/70">
                La lista de proveedores ahora vive en su propia seccion para que no quede escondida debajo del resto del panel.
              </p>
            </div>
            <details className="relative sm:hidden">
              <summary className="flex h-12 w-12 cursor-pointer list-none items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-xl text-white">
                ≡
              </summary>
              <div className="absolute right-0 top-14 z-20 min-w-56 rounded-[1.2rem] border border-white/12 bg-[#1e1713] p-2 shadow-2xl">
                {ADMIN_SECTIONS.map((section) => (
                  <Link
                    key={section.id}
                    href={`/admin?section=${section.id}`}
                    className={`block rounded-[0.95rem] px-3 py-3 text-sm font-semibold ${
                      activeSection === section.id ? "bg-[#ff6b35] text-white" : "text-white/78"
                    }`}
                  >
                    {section.label}
                  </Link>
                ))}
              </div>
            </details>
          </div>

          <div className="mt-5 hidden flex-wrap gap-2 sm:flex">
            {ADMIN_SECTIONS.map((section) => (
              <Link
                key={section.id}
                href={`/admin?section=${section.id}`}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeSection === section.id
                    ? "bg-[#ff6b35] text-white"
                    : "border border-white/12 bg-white/8 text-white/75"
                }`}
              >
                {section.label}
              </Link>
            ))}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.4rem] border border-white/10 bg-white/6 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/50">Proveedores</p>
              <p className="mt-2 text-2xl font-bold">{contacts.length}</p>
              <p className="mt-1 text-sm text-white/68">Contactos cargados en el sistema.</p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/6 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/50">Usuarios</p>
              <p className="mt-2 text-2xl font-bold">{members?.length || 0}</p>
              <p className="mt-1 text-sm text-white/68">Ultimos perfiles visibles para gestion.</p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/6 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/50">Vista actual</p>
              <p className="mt-2 text-2xl font-bold">{ADMIN_SECTIONS.find((section) => section.id === activeSection)?.label}</p>
              <p className="mt-1 text-sm text-white/68">Usa el menu para cambiar de modulo.</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4">
          {activeSection === "providers" ? (
            <>
              <div className="card p-4">
                <h2 className="font-bold">Agregar proveedor</h2>
                <p className="mt-1 text-sm text-[#62626d]">Crea un contacto nuevo y define las vias que vera el reviewer.</p>
                <form action={createProviderContact} noValidate className="mt-4 grid gap-2">
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
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-bold">Lista de proveedores</h2>
                    <p className="mt-1 text-sm text-[#62626d]">Aqui se ven y se editan todos los contactos cargados.</p>
                  </div>
                  <span className="rounded-full bg-[#fff2eb] px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#dc4f1f]">
                    {contacts.length} contactos
                  </span>
                </div>
                {contacts.length ? (
                  <div className="mt-4 space-y-3">
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
                ) : (
                  <div className="mt-4 rounded-[1.2rem] border border-dashed border-[#e2d8cc] bg-[#fffaf5] p-5 text-sm text-[#62626d]">
                    No hay contactos de proveedores cargados todavia.
                  </div>
                )}
              </div>
            </>
          ) : null}

          {activeSection === "users" ? (
            <div className="card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold">Usuarios</h2>
                  <p className="mt-1 text-sm text-[#62626d]">Actualiza membresia y KYC sin perder tiempo buscando la seccion correcta.</p>
                </div>
                <span className="rounded-full bg-[#fff2eb] px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#dc4f1f]">
                  {members?.length || 0} visibles
                </span>
              </div>
              <div className="mt-4 space-y-3">
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
          ) : null}

          {activeSection === "options" ? (
            <div className="card p-4">
              <h2 className="font-bold">Opciones admin</h2>
              <p className="mt-1 text-sm text-[#62626d]">Gestiona permisos internos y accesos especiales.</p>
              <form action={createAdminUser} noValidate className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input className="input" name="email" placeholder="correo@dominio.com" />
                <button className="btn-primary" type="submit">Asignar admin</button>
              </form>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
