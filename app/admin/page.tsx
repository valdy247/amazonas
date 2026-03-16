import { redirect } from "next/navigation";
import { AdminProviderCreateForm } from "@/components/admin-provider-create-form";
import { AdminProviderManager } from "@/components/admin-provider-manager";
import { AdminSectionNav } from "@/components/admin-section-nav";
import { AdminUserManager } from "@/components/admin-user-manager";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";
import { hasAdminAccess } from "@/lib/admin";
import { createAdminUser } from "./actions";

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
  email?: string | null;
  network: string | null;
  url: string;
  notes?: string | null;
  is_active: boolean;
  is_verified: boolean;
  contact_methods?: string | null;
};

const WHATSAPP_PREFIX_OPTIONS = [
  { flag: "US", label: "USA", value: "us:+1" },
  { flag: "ES", label: "Espana", value: "+34" },
  { flag: "CU", label: "Cuba", value: "+53" },
  { flag: "MX", label: "Mexico", value: "+52" },
  { flag: "CO", label: "Colombia", value: "+57" },
  { flag: "DO", label: "R. Dominicana", value: "do:+1" },
] as const;

const ADMIN_SECTIONS = [
  { id: "providers", label: "Proveedores" },
  { id: "users", label: "Usuarios" },
  { id: "options", label: "Opciones" },
] as const;

const ADMIN_EXTRA_SECTIONS = [{ id: "metrics", label: "Metricas" }] as const;

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
  const availableSections = [...ADMIN_SECTIONS, ...ADMIN_EXTRA_SECTIONS];
  const activeSection: string = availableSections.some((section) => section.id === requestedSection) ? String(requestedSection) : "providers";

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
  const reviewerCount = (members || []).filter((member) => member.role === "reviewer" || member.role === "tester").length;
  const providerCount = (members || []).filter((member) => member.role === "provider").length;

  let contacts: ContactRow[] = [];

  const withMethods = await supabase
    .from("provider_contacts")
    .select("id, title, email, network, url, notes, is_active, is_verified, contact_methods")
    .order("created_at", { ascending: false });

  if (withMethods.error) {
    const withVerification = await supabase
      .from("provider_contacts")
      .select("id, title, network, url, notes, is_active, is_verified")
      .order("created_at", { ascending: false });

    if (withVerification.error) {
      const withNotes = await supabase
        .from("provider_contacts")
        .select("id, title, network, url, notes, is_active")
        .order("created_at", { ascending: false });

      if (withNotes.error) {
        const fallback = await supabase
          .from("provider_contacts")
          .select("id, title, network, url, is_active")
          .order("created_at", { ascending: false });

        contacts = (fallback.data || []).map((contact) => ({
          ...contact,
          email: null,
          notes: null,
          is_verified: false,
          contact_methods: null,
        })) as ContactRow[];
      } else {
        contacts = (withNotes.data || []).map((contact) => ({
          ...contact,
          email: null,
          is_verified: false,
          contact_methods: null,
        })) as ContactRow[];
      }
    } else {
      contacts = (withVerification.data || []).map((contact) => ({
        ...contact,
        email: null,
        contact_methods: null,
      })) as ContactRow[];
    }
  } else {
    contacts = (withMethods.data || []) as ContactRow[];
  }

  return (
    <div className="min-h-screen">
      <SiteHeader
        menuItems={[
          { href: "/dashboard", label: "Inicio" },
          { href: "/admin?section=metrics", label: "Metricas" },
          { href: "/profile", label: "Editar perfil" },
        ]}
      />
      <main className="container-x space-y-7 pt-8 pb-6">
        <section className="pt-3">
          <AdminSectionNav sections={ADMIN_SECTIONS} activeSection={activeSection} />
        </section>

        <section className="rounded-[1.8rem] border border-[#1f1b17] bg-[linear-gradient(135deg,#201915_0%,#2c221a_55%,#3f2a1d_100%)] px-5 pb-5 pt-10 text-white shadow-[0_26px_80px_rgba(35,22,13,0.22)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-white/55">Control Center</p>
              <h1 className="mt-2 text-3xl font-bold">Panel admin</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/70">
                La lista de proveedores ahora vive en su propia seccion para que no quede escondida debajo del resto del panel.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4">
          {activeSection === "providers" ? (
            <>
              <div className="card p-4">
                <AdminProviderCreateForm whatsappPrefixOptions={WHATSAPP_PREFIX_OPTIONS} />
              </div>

              <div className="card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-bold">Lista de proveedores</h2>
                    <p className="mt-1 text-sm text-[#62626d]">Solo ves el nombre al inicio. Toca un proveedor para abrir su ficha y editarlo.</p>
                  </div>
                  <span className="rounded-full bg-[#fff2eb] px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#dc4f1f]">
                    {contacts.length} contactos
                  </span>
                </div>
                {contacts.length ? (
                  <AdminProviderManager contacts={contacts} whatsappPrefixOptions={WHATSAPP_PREFIX_OPTIONS} />
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
              <AdminUserManager
                members={((members as ProfileRow[] | null) || []).map((member) => ({
                  id: member.id,
                  full_name: member.full_name,
                  email: member.email,
                  role: member.role,
                  membershipStatus: membershipByUser.get(member.id) || "pending_payment",
                  kycStatus: kycByUser.get(member.id) || "pending",
                }))}
              />
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

          {activeSection === "metrics" ? (
            <div className="card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold">Metricas</h2>
                  <p className="mt-1 text-sm text-[#62626d]">Resumen rapido del estado actual del panel admin.</p>
                </div>
                <span className="rounded-full bg-[#fff2eb] px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#dc4f1f]">
                  Vista interna
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.4rem] border border-[#eadfd6] bg-[#fffaf7] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#8f857b]">Proveedores</p>
                  <p className="mt-2 text-3xl font-bold text-[#131316]">{contacts.length}</p>
                  <p className="mt-1 text-sm text-[#62626d]">Contactos cargados en el sistema.</p>
                </div>
                <div className="rounded-[1.4rem] border border-[#eadfd6] bg-[#fffaf7] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#8f857b]">Reseñadores</p>
                  <p className="mt-2 text-3xl font-bold text-[#131316]">{reviewerCount}</p>
                  <p className="mt-1 text-sm text-[#62626d]">Perfiles visibles de reseñadores en la lista actual.</p>
                </div>
                <div className="rounded-[1.4rem] border border-[#eadfd6] bg-[#fffaf7] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#8f857b]">Providers</p>
                  <p className="mt-2 text-3xl font-bold text-[#131316]">{providerCount}</p>
                  <p className="mt-1 text-sm text-[#62626d]">Perfiles visibles de providers en la lista actual.</p>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
