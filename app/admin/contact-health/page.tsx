import { redirect } from "next/navigation";
import { AdminProviderHealthPanel } from "@/components/admin-provider-health-panel";
import { SiteHeader } from "@/components/site-header";
import { hasAdminAccess } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

type ContactRow = {
  id: number;
  title: string;
  email?: string | null;
  network: string | null;
  url: string;
  notes?: string | null;
  contact_methods?: string | null;
};

export default async function AdminContactHealthPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: profile } = await supabase.from("profiles").select("role, email").eq("id", user.id).single();
  if (!hasAdminAccess(profile?.role, profile?.email || user.email)) {
    redirect("/dashboard");
  }

  let contacts: ContactRow[] = [];
  const withMethods = await supabase
    .from("provider_contacts")
    .select("id, title, email, network, url, notes, contact_methods")
    .order("created_at", { ascending: false });

  if (!withMethods.error) {
    contacts = (withMethods.data || []) as ContactRow[];
  } else {
    const fallback = await supabase
      .from("provider_contacts")
      .select("id, title, email, network, url, notes")
      .order("created_at", { ascending: false });
    contacts = ((fallback.data || []) as Array<Omit<ContactRow, "contact_methods">>).map((contact) => ({
      ...contact,
      contact_methods: null,
    }));
  }

  return (
    <div className="min-h-screen">
      <SiteHeader
        menuItems={[
          { href: "/dashboard", label: "Inicio" },
          { href: "/admin?section=providers", label: "Proveedores" },
          { href: "/admin/contact-health", label: "Salud contactos" },
          { href: "/admin?section=providers#repair-center", label: "Saneamiento" },
          { href: "/admin?section=metrics", label: "Metricas" },
          { href: "/admin?section=support", label: "Soporte" },
        ]}
      />

      <main className="container-x space-y-6 pt-8 pb-6">
        <section className="rounded-[1.8rem] border border-[#1f1b17] bg-[linear-gradient(135deg,#201915_0%,#2c221a_55%,#3f2a1d_100%)] px-5 pb-5 pt-10 text-white shadow-[0_26px_80px_rgba(35,22,13,0.22)]">
          <p className="text-xs uppercase tracking-[0.24em] text-white/55">Contact Health</p>
          <h1 className="mt-2 text-3xl font-bold">Salud tecnica de contactos</h1>
          <p className="mt-2 max-w-3xl text-sm text-white/70">
            Esta pagina revisa si los enlaces responden, si los emails tienen formato correcto y si los numeros de WhatsApp parecen plausibles. No confirma registro real dentro de WhatsApp.
          </p>
        </section>

        <section className="card p-4">
          <AdminProviderHealthPanel contacts={contacts} />
        </section>
      </main>
    </div>
  );
}
