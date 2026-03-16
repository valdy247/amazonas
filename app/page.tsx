import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, Users } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { landingCopy, normalizeLanguage } from "@/lib/i18n";

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const language = normalizeLanguage(typeof resolvedSearchParams.lang === "string" ? resolvedSearchParams.lang : undefined);
  const copy = landingCopy[language];

  return (
    <div className="min-h-screen">
      <SiteHeader language={language} />

      <section className="w-full border-b border-[#e5e5df] bg-white">
        <Image src="/hero.png" alt="Amazona Review" width={1800} height={1200} className="h-auto w-full object-contain" priority />
      </section>

      <main className="container-x py-6 sm:py-10">
        <section className="space-y-4">
          <span className="inline-flex rounded-full bg-[#fff3ec] px-3 py-1 text-xs font-bold text-[#dc4f1f]">{copy.verifiedCommunity}</span>
          <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">{copy.headline}</h1>
          <p className="text-sm text-[#62626d] sm:text-base">{copy.body}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href={`/auth?mode=signup&lang=${language}`} className="btn-primary w-full sm:w-auto">
              {copy.startNow}
            </Link>
            <Link href={`/auth?mode=signin&lang=${language}`} className="btn-secondary w-full sm:w-auto">
              {copy.alreadyHaveAccount}
            </Link>
          </div>
        </section>

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <article className="card p-4">
            <ShieldCheck className="h-5 w-5 text-[#ff6b35]" />
            <h2 className="mt-2 font-bold">{copy.legalFlowTitle}</h2>
            <p className="mt-1 text-sm text-[#62626d]">{copy.legalFlowBody}</p>
          </article>
          <article className="card p-4">
            <Users className="h-5 w-5 text-[#ff6b35]" />
            <h2 className="mt-2 font-bold">{copy.clearRolesTitle}</h2>
            <p className="mt-1 text-sm text-[#62626d]">{copy.clearRolesBody}</p>
          </article>
          <article className="card p-4">
            <ShieldCheck className="h-5 w-5 text-[#ff6b35]" />
            <h2 className="mt-2 font-bold">{copy.verifiedNetworkTitle}</h2>
            <p className="mt-1 text-sm text-[#62626d]">{copy.verifiedNetworkBody}</p>
          </article>
        </section>
      </main>
    </div>
  );
}
