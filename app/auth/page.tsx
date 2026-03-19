import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { createClient } from "@/lib/supabase/server";
import { authPageCopy, normalizeLanguage } from "@/lib/i18n";

export default async function AuthPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const language = normalizeLanguage(typeof resolvedSearchParams.lang === "string" ? resolvedSearchParams.lang : undefined);
  const copy = authPageCopy[language];
  const mode = typeof resolvedSearchParams.mode === "string" ? resolvedSearchParams.mode : "signin";
  const confirmRequired = resolvedSearchParams.confirm_required === "1";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && user.email_confirmed_at && mode !== "recovery") {
    redirect("/dashboard");
  }

  return (
    <main className="container-x min-h-screen py-8">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Link href={`/?lang=${language}`} className="btn-secondary">
            {copy.backHome}
          </Link>
          <div className="flex gap-2 text-sm">
            <Link href={`/auth?mode=signin&lang=${language}`} className="rounded-full border border-[#e5e5df] px-3 py-2">
              {copy.signIn}
            </Link>
            <Link href={`/auth?mode=signup&lang=${language}`} className="rounded-full border border-[#e5e5df] px-3 py-2">
              {copy.createAccount}
            </Link>
          </div>
        </div>

        <AuthForm />
        {confirmRequired ? (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {language === "en"
              ? "Confirm your email before using your account."
              : "Debes confirmar tu correo antes de usar tu cuenta."}
          </p>
        ) : null}
      </div>
    </main>
  );
}
