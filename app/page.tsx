import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, Users } from "lucide-react";
import { SiteHeader } from "@/components/site-header";

export default async function Home() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="w-full border-b border-[#e5e5df] bg-white">
        <Image
          src="/hero.png"
          alt="Amazona Review"
          width={1800}
          height={1200}
          className="h-auto w-full object-contain"
          priority
        />
      </section>

      <main className="container-x py-6 sm:py-10">
        <section className="space-y-4">
          <span className="inline-flex rounded-full bg-[#fff3ec] px-3 py-1 text-xs font-bold text-[#dc4f1f]">
            Comunidad verificada
          </span>
          <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">Amazona Review</h1>
          <p className="text-sm text-[#62626d] sm:text-base">
            Conecta reseñadores y proveedores en un entorno con membresía, verificación KYC y reglas claras de transparencia.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/auth?mode=signup" className="btn-primary w-full sm:w-auto">
              Empezar ahora
            </Link>
            <Link href="/auth?mode=signin" className="btn-secondary w-full sm:w-auto">
              Ya tengo cuenta
            </Link>
          </div>
        </section>

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <article className="card p-4">
            <ShieldCheck className="h-5 w-5 text-[#ff6b35]" />
            <h2 className="mt-2 font-bold">Flujo legal</h2>
            <p className="mt-1 text-sm text-[#62626d]">Membresía, KYC y reglas claras de transparencia para proteger la comunidad.</p>
          </article>
          <article className="card p-4">
            <Users className="h-5 w-5 text-[#ff6b35]" />
            <h2 className="mt-2 font-bold">Roles claros</h2>
            <p className="mt-1 text-sm text-[#62626d]">Reseñadores y proveedores tienen experiencia distinta desde onboarding.</p>
          </article>
          <article className="card p-4">
            <ShieldCheck className="h-5 w-5 text-[#ff6b35]" />
            <h2 className="mt-2 font-bold">Comunidad verificada</h2>
            <p className="mt-1 text-sm text-[#62626d]">Acceso a contactos cuando el perfil tiene pago activo y verificación aprobada.</p>
          </article>
        </section>
      </main>
    </div>
  );
}
