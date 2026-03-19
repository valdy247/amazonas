"use client";

import { useState } from "react";
import { ChevronDown, Copy } from "lucide-react";
import type { AppLanguage } from "@/lib/i18n";

type ReviewerReferralCardProps = {
  language: AppLanguage;
  referralCode: string;
  referralLink: string;
  rewardedCountThisMonth: number;
  providerLimit: number;
  totalQualifiedReferrals: number;
  eligibleForRewards: boolean;
};

export function ReviewerReferralCard({
  language,
  referralCode,
  referralLink,
  rewardedCountThisMonth,
  providerLimit,
  totalQualifiedReferrals,
  eligibleForRewards,
}: ReviewerReferralCardProps) {
  const [open, setOpen] = useState(false);
  const [shared, setShared] = useState(false);
  const [copied, setCopied] = useState(false);
  const isEnglish = language === "en";

  async function shareInvite() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: isEnglish ? "Join Verifyzon" : "Unete a Verifyzon",
          text: isEnglish
            ? "Join Verifyzon through my link to get access to more than 150 monthly providers."
            : "Unete a travez de mi enlace a Verifyzon para tener acceso a mas de 150 proveedores mensuales",
          url: referralLink,
        });
        setShared(true);
        window.setTimeout(() => setShared(false), 1800);
      } catch {
        setShared(false);
      }
    } else {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <div className="rounded-[1.35rem] border border-[#eadfd6] bg-[#fffaf6] p-4">
      <button type="button" onClick={() => setOpen((current) => !current)} className="flex w-full items-center justify-between gap-3 text-left">
        <div>
          <p className="text-sm font-semibold text-[#131316]">{isEnglish ? "Earn more providers" : "Gana mas proveedores"}</p>
          <p className="mt-1 text-xs text-[#7c7064]">
            {providerLimit} / 200 {isEnglish ? "available this month" : "disponibles este mes"}
          </p>
        </div>
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#dc4f1f] transition ${open ? "rotate-180" : ""}`}>
          <ChevronDown className="h-4 w-4" />
        </span>
      </button>

      {open ? (
        <div className="mt-4 space-y-3 text-sm text-[#62564a]">
          <p>
            {isEnglish
              ? "Your base access is 150 providers per month. Each valid referral unlocks 5 more, up to 50 extra providers."
              : "Tu acceso base es de 150 proveedores por mes. Cada referido valido desbloquea 5 mas, hasta ganar 50 proveedores extra."}
          </p>
          <p>
            {isEnglish
              ? `Rewarded this month: ${rewardedCountThisMonth}/10`
              : `Premiados este mes: ${rewardedCountThisMonth}/10`}
          </p>
          <p>
            {isEnglish
              ? `Total valid referrals: ${totalQualifiedReferrals}`
              : `Referidos validos totales: ${totalQualifiedReferrals}`}
          </p>
          {!eligibleForRewards ? (
            <p className="text-xs text-[#8f857b]">
              {isEnglish
                ? "Rewards activate once your own membership and KYC are approved."
                : "Las recompensas se activan cuando tu propia membresia y KYC esten aprobados."}
            </p>
          ) : null}
          <div className="rounded-[1rem] border border-[#eadfd6] bg-white px-3 py-3 text-sm font-semibold text-[#131316]">
            {isEnglish ? "Referral code" : "Codigo de referido"}: {referralCode}
          </div>
          <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => void shareInvite()}>
            <Copy className="h-4 w-4" />
            {shared
              ? isEnglish ? "Shared" : "Compartido"
              : copied
                ? isEnglish ? "Copied" : "Copiado"
                : isEnglish ? "Share invite link" : "Compartir enlace"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
