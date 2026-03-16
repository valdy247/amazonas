import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, ShieldCheck, Sparkles, Users } from "lucide-react";
import { LandingFooter } from "@/components/landing-footer";
import { ProviderInviteModal } from "@/components/provider-invite-modal";
import { SiteHeader } from "@/components/site-header";
import { landingCopy } from "@/lib/i18n";

export default function Home() {
  const language = "en";
  const copy = landingCopy[language];

  return (
    <div className="min-h-screen">
      <SiteHeader language={language} />
      <Suspense fallback={null}>
        <ProviderInviteModal language={language} />
      </Suspense>

      <main className="container-x py-6 sm:py-10">
        <section className="overflow-hidden rounded-[2.3rem] border border-[#eadfd6] bg-[radial-gradient(circle_at_top_left,#fff7f1_0%,#fffdfb_45%,#ffffff_100%)] px-5 py-8 shadow-[0_26px_70px_rgba(24,20,16,0.06)] sm:px-8 sm:py-10">
          <div className="mx-auto max-w-4xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#fff1e8] px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#dc4f1f]">
              <Sparkles className="h-3.5 w-3.5" />
              {copy.verifiedCommunity}
            </span>
            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.24em] text-[#9b6a52]">
              Verified reviewer network for safer brand collaborations
            </p>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight text-[#131316] sm:text-6xl">
              {copy.headline}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-[#62564a] sm:text-base">
              {copy.body}
            </p>

            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href={`/auth?mode=signup&lang=${language}`} className="btn-primary w-full sm:w-auto">
                {copy.startNow}
              </Link>
              <Link href={`/auth?mode=signin&lang=${language}`} className="btn-secondary w-full sm:w-auto">
                {copy.alreadyHaveAccount}
              </Link>
            </div>

            <div className="mt-8 grid gap-3 text-left sm:grid-cols-3">
              <article className="rounded-[1.5rem] border border-[#eee4db] bg-white/90 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8f857b]">KYC</p>
                <p className="mt-2 text-sm font-semibold text-[#131316]">Verified identity</p>
                <p className="mt-1 text-sm text-[#6a6158]">Profiles are designed to feel safer before any collaboration starts.</p>
              </article>
              <article className="rounded-[1.5rem] border border-[#eee4db] bg-white/90 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8f857b]">Messaging</p>
                <p className="mt-2 text-sm font-semibold text-[#131316]">Cross-language communication</p>
                <p className="mt-1 text-sm text-[#6a6158]">Providers and reviewers can talk naturally even when they use different languages.</p>
              </article>
              <article className="rounded-[1.5rem] border border-[#eee4db] bg-white/90 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8f857b]">Trust</p>
                <p className="mt-2 text-sm font-semibold text-[#131316]">Clear collaboration rules</p>
                <p className="mt-1 text-sm text-[#6a6158]">The platform is structured around transparency, identity checks, and cleaner contact flows.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <article className="rounded-[1.8rem] border border-[#eadfd6] bg-white p-5 shadow-[0_18px_36px_rgba(22,18,14,0.04)]">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#dc4f1f]">For reviewers</p>
            <h2 className="mt-3 text-2xl font-bold text-[#131316]">Build trust before the first collaboration</h2>
            <p className="mt-3 text-sm leading-7 text-[#62564a]">
              Join with a cleaner profile, pass identity verification, and talk to providers in a more controlled environment before sharing personal details.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full bg-[#fff5ef] px-3 py-2 text-xs font-semibold text-[#b85a2e]">ID verification</span>
              <span className="rounded-full bg-[#fff5ef] px-3 py-2 text-xs font-semibold text-[#b85a2e]">Private messaging</span>
              <span className="rounded-full bg-[#fff5ef] px-3 py-2 text-xs font-semibold text-[#b85a2e]">Safer contact flow</span>
            </div>
          </article>

          <article className="rounded-[1.8rem] border border-[#eadfd6] bg-white p-5 shadow-[0_18px_36px_rgba(22,18,14,0.04)]">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#dc4f1f]">For providers</p>
            <h2 className="mt-3 text-2xl font-bold text-[#131316]">Reach verified reviewers with less friction</h2>
            <p className="mt-3 text-sm leading-7 text-[#62564a]">
              Discover verified reviewer profiles, send campaigns, and open conversations in one place without relying on messy outreach or scattered channels.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full bg-[#fff5ef] px-3 py-2 text-xs font-semibold text-[#b85a2e]">Campaign tools</span>
              <span className="rounded-full bg-[#fff5ef] px-3 py-2 text-xs font-semibold text-[#b85a2e]">Cross-language chat</span>
              <span className="rounded-full bg-[#fff5ef] px-3 py-2 text-xs font-semibold text-[#b85a2e]">Verified audience</span>
            </div>
          </article>
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

        <section className="mt-8 rounded-[2rem] border border-[#eadfd6] bg-[linear-gradient(135deg,#15120f_0%,#241a12_100%)] px-5 py-7 text-white shadow-[0_24px_70px_rgba(22,18,14,0.18)] sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#ff9c72]">Ready to join Verifyzon?</p>
              <h2 className="mt-3 text-3xl font-bold">Start with a cleaner, more trusted collaboration workflow.</h2>
              <p className="mt-3 text-sm leading-7 text-white/72">
                Create your account, complete the setup, and move into a platform built around verification, clearer messaging, and stronger trust signals.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href={`/auth?mode=signup&lang=${language}`} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#ff6b35] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#ff7c4e]">
                Create account
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href={`/terms?lang=${language}`} className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white/82 transition hover:border-white/30 hover:text-white">
                Review terms
              </Link>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter language={language} />
    </div>
  );
}
