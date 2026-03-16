import Link from "next/link";
import { ArrowRight, CircleHelp, Instagram, Linkedin, ShieldCheck, Youtube } from "lucide-react";
import { landingCopy, type AppLanguage } from "@/lib/i18n";

type LandingFooterProps = {
  language: AppLanguage;
};

function getSocialLinks() {
  return [
    { label: "Instagram", href: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM || "", icon: Instagram },
    { label: "TikTok", href: process.env.NEXT_PUBLIC_SOCIAL_TIKTOK || "", icon: CircleHelp },
    { label: "Facebook", href: process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK || "", icon: CircleHelp },
    { label: "X", href: process.env.NEXT_PUBLIC_SOCIAL_X || "", icon: CircleHelp },
    { label: "YouTube", href: process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE || "", icon: Youtube },
    { label: "LinkedIn", href: process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN || "", icon: Linkedin },
  ];
}

export function LandingFooter({ language }: LandingFooterProps) {
  const copy = landingCopy[language];
  const socialLinks = getSocialLinks();

  return (
    <footer className="border-t border-[#eadfd6] bg-[linear-gradient(180deg,#fff8f3_0%,#fff2e7_100%)]">
      <div className="container-x py-8">
        <div className="rounded-[2rem] border border-[#f0d7ca] bg-white/80 p-5 shadow-[0_20px_60px_rgba(220,79,31,0.08)] backdrop-blur">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr_0.85fr_1fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#dc4f1f]">Amazona Review</p>
              <h2 className="mt-3 text-2xl font-bold text-[#131316]">Built on trust</h2>
              <p className="mt-3 text-sm text-[#62626d]">{copy.footerTagline}</p>
              <div className="mt-4 flex items-center gap-2 rounded-[1.2rem] border border-[#f1e1d6] bg-[#fff8f4] px-4 py-3 text-sm text-[#62564a]">
                <ShieldCheck className="h-4 w-4 text-[#dc4f1f]" />
                <span>{copy.footerTrustMessaging}</span>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-[#131316]">{copy.footerLegal}</p>
              <div className="mt-3 flex flex-col gap-2 text-sm">
                <Link href={`/privacy?lang=${language}`} className="text-[#62564a] transition hover:text-[#dc4f1f]">
                  {copy.footerPrivacy}
                </Link>
                <Link href={`/terms?lang=${language}`} className="text-[#62564a] transition hover:text-[#dc4f1f]">
                  {copy.footerTerms}
                </Link>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-[#131316]">{copy.footerSupport}</p>
              <p className="mt-3 text-sm text-[#62626d]">{copy.footerSupportBody}</p>
              <Link
                href={`/auth?mode=signin&lang=${language}`}
                className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#dc4f1f] transition hover:text-[#b84216]"
              >
                {copy.footerSupportLink}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div>
              <p className="text-sm font-semibold text-[#131316]">{copy.footerSocial}</p>
              <p className="mt-3 text-sm text-[#62626d]">{copy.footerSocialSoon}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {socialLinks.map((item) => {
                  const Icon = item.icon;
                  const isReady = Boolean(item.href);

                  if (!isReady) {
                    return (
                      <span
                        key={item.label}
                        className="inline-flex items-center gap-2 rounded-full border border-[#eadfd6] bg-[#fcfaf7] px-3 py-2 text-xs font-semibold text-[#8f857b]"
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {item.label}
                      </span>
                    );
                  }

                  return (
                    <a
                      key={item.label}
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-[#ffd2bf] bg-[#fff6f0] px-3 py-2 text-xs font-semibold text-[#dc4f1f] transition hover:bg-[#ffe8dc]"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {item.label}
                    </a>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 border-t border-[#f0e4da] pt-4 text-xs text-[#8f857b] sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 Amazona Review. {copy.footerReserved}</p>
            <p>{copy.footerTrustPayments} · {copy.footerTrustVerification}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
