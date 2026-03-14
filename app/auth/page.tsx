import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { createClient } from "@/lib/supabase/server";

export default async function AuthPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="container-x min-h-screen py-8">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Link href="/" className="btn-secondary">
            Volver al inicio
          </Link>
          <div className="flex gap-2 text-sm">
            <Link href="/auth?mode=signin" className="rounded-full border border-[#e5e5df] px-3 py-2">
              Iniciar sesion
            </Link>
            <Link href="/auth?mode=signup" className="rounded-full border border-[#e5e5df] px-3 py-2">
              Crear cuenta
            </Link>
          </div>
        </div>

        <AuthForm />
      </div>
    </main>
  );
}
