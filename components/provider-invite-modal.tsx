"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CircleX, Sparkles } from "lucide-react";
import { landingCopy, type AppLanguage } from "@/lib/i18n";

type ProviderInviteModalProps = {
  language: AppLanguage;
};

export function ProviderInviteModal({ language }: ProviderInviteModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const copy = landingCopy[language];
  const isOpen = searchParams.get("invite") === "provider-directory";

  const signupHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("mode", "signup");
    params.set("lang", language);
    params.set("provider_invite", "1");
    return `/auth?${params.toString()}`;
  }, [language]);

  function closeModal() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("invite");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 bg-[#131316]/55 p-4 backdrop-blur-sm">
      <div className="mx-auto mt-16 w-full max-w-lg rounded-[2rem] border border-[#e8ddd4] bg-[linear-gradient(180deg,#fffdfa_0%,#fff7f1_100%)] p-6 shadow-[0_28px_90px_rgba(19,19,22,0.22)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#fff1e8] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#dc4f1f]">
              <Sparkles className="h-3.5 w-3.5" />
              {copy.providerInviteBadge}
            </span>
            <h2 className="mt-4 text-3xl font-extrabold text-[#131316]">{copy.providerInviteTitle}</h2>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#eadfd6] bg-white text-[#62626d]"
            aria-label={copy.providerInviteSecondary}
          >
            <CircleX className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-4 text-sm leading-7 text-[#62564a]">{copy.providerInviteBody}</p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href={signupHref} className="btn-primary w-full sm:w-auto">
            {copy.providerInvitePrimary}
          </Link>
          <button type="button" onClick={closeModal} className="btn-secondary w-full sm:w-auto">
            {copy.providerInviteSecondary}
          </button>
        </div>
      </div>
    </div>
  );
}
