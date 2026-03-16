import Link from "next/link";
import { ArrowRight, CircleHelp, Instagram, Linkedin, Youtube } from "lucide-react";
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
    <footer className="border-t border-[#1f1b17] bg-[linear-gradient(180deg,#17120e_0%,#221912_100%)] text-white">
      <div className="container-x py-8">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.24)] backdrop-blur">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr_0.85fr_1fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#ff9c72]">Amazona Review</p>
              <h2 className="mt-3 text-2xl font-bold text-white">Built on trust</h2>
              <p className="mt-3 text-sm text-white/70">{copy.footerTagline}</p>
            </div>

            <div>
              <p className="text-sm font-semibold text-white">{copy.footerLegal}</p>
              <div className="mt-3 flex flex-col gap-2 text-sm">
                <Link href={`/privacy?lang=${language}`} className="text-white/70 transition hover:text-[#ff9c72]">
                  {copy.footerPrivacy}
                </Link>
                <Link href={`/terms?lang=${language}`} className="text-white/70 transition hover:text-[#ff9c72]">
                  {copy.footerTerms}
                </Link>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-white">{copy.footerSupport}</p>
              <p className="mt-3 text-sm text-white/70">{copy.footerSupportBody}</p>
              <Link
                href={`/auth?mode=signin&lang=${language}`}
                className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#ff9c72] transition hover:text-[#ffb894]"
              >
                {copy.footerSupportLink}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div>
              <p className="text-sm font-semibold text-white">{copy.footerSocial}</p>
              <p className="mt-3 text-sm text-white/70">{copy.footerSocialSoon}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {socialLinks.map((item) => {
                  const Icon = item.icon;
                  const isReady = Boolean(item.href);

                  if (!isReady) {
                    return (
                      <span
                        key={item.label}
                        className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3 py-2 text-xs font-semibold text-white/60"
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
                      className="inline-flex items-center gap-2 rounded-full border border-[#ff9c72]/40 bg-[#ff9c72]/10 px-3 py-2 text-xs font-semibold text-[#ffb894] transition hover:bg-[#ff9c72]/16"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {item.label}
                    </a>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 border-t border-white/10 pt-4 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 Amazona Review. {copy.footerReserved}</p>
            <p>{copy.footerTrustPayments} · {copy.footerTrustVerification}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
