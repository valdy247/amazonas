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
  const [copied, setCopied] = useState(false);
  const isEnglish = language === "en";

  async function copyInvite() {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="rounded-[1.35rem] border border-[#eadfd6] bg-[#fffaf6] p-4">
      <button type="button" onClick={() => setOpen((current) => !current)} className="flex w-full items-center justify-between gap-3 text-left">
        <div>
          <p className="text-sm font-semibold text-[#131316]">{isEnglish ? "Earn more providers" : "Gana mas proveedores"}</p>
          <p className="mt-1 text-xs text-[#7c7064]">
            {providerLimit} / 150 {isEnglish ? "unlocked this month" : "desbloqueados este mes"}
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
              ? "Invite verified reviewers. Each valid referral unlocks 5 more providers."
              : "Invita reseñadores verificados. Cada referido valido desbloquea 5 proveedores mas."}
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
          <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => void copyInvite()}>
            <Copy className="h-4 w-4" />
            {copied ? (isEnglish ? "Copied" : "Copiado") : isEnglish ? "Copy invite link" : "Copiar enlace"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
