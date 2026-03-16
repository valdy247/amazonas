"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { SendHorizontal, Sparkles, WandSparkles } from "lucide-react";
import { getInterestLabel } from "@/lib/onboarding";
import { normalizeLanguage, providerCampaignCopy, type AppLanguage } from "@/lib/i18n";

type CampaignReviewer = {
  id: string;
  fullName: string;
  firstName: string;
  interestKeys: string[];
  matchPercent: number;
  isVerified: boolean;
};

type ProviderCampaignStudioProps = {
  reviewers: CampaignReviewer[];
  providerInterests: string[];
  language: AppLanguage;
};

export function ProviderCampaignStudio({ reviewers, providerInterests, language }: ProviderCampaignStudioProps) {
  const currentLanguage = normalizeLanguage(language);
  const copy = providerCampaignCopy[currentLanguage];
  const [selectedInterest, setSelectedInterest] = useState<string>("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isImproving, startImproving] = useTransition();

  const filteredReviewers = useMemo(
    () =>
      selectedInterest === "all"
        ? reviewers
        : reviewers.filter((reviewer) => reviewer.interestKeys.includes(selectedInterest)),
    [reviewers, selectedInterest]
  );

  async function improveWithAi() {
    const trimmed = message.trim();
    if (!trimmed) {
      setError(copy.emptyMessage);
      return;
    }

    setError(null);
    setSuccess(null);

    startImproving(async () => {
      const response = await fetch("/api/chat/campaign-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, language: currentLanguage }),
      });

      const result = (await response.json()) as { data?: { message?: string }; error?: string };
      if (!response.ok || !result.data?.message) {
        setError(result.error || copy.aiError);
        return;
      }

      setMessage(result.data.message);
    });
  }

  async function sendCampaign() {
    const trimmed = message.trim();
    if (!trimmed) {
      setError(copy.emptyMessage);
      return;
    }

    if (!filteredReviewers.length) {
      setError(copy.noReviewers);
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const response = await fetch("/api/chat/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewerIds: filteredReviewers.map((reviewer) => reviewer.id),
          message: trimmed,
          category: selectedInterest === "all" ? "" : selectedInterest,
        }),
      });

      const result = (await response.json()) as { data?: { sentCount?: number }; error?: string };
      if (!response.ok) {
        setError(result.error || copy.sendError);
        return;
      }

      setSuccess(copy.sentOk);
      setMessage("");
    });
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#ecd8cb] bg-[radial-gradient(circle_at_top_left,#fff8f4_0%,#fff1e6_42%,#fffdfb_100%)] p-5 shadow-[0_28px_70px_rgba(220,79,31,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#dc4f1f]">{copy.badge}</p>
          <h2 className="mt-2 text-3xl font-bold text-[#131316]">{copy.title}</h2>
          <p className="mt-2 max-w-2xl text-sm text-[#62626d]">{copy.body}</p>
        </div>
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#dc4f1f] shadow-sm">
          <Sparkles className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-5 rounded-[1.6rem] border border-white/80 bg-white/80 p-4 backdrop-blur">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8f857b]">{copy.audienceLabel}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedInterest("all")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              selectedInterest === "all" ? "bg-[#ff6b35] text-white" : "border border-[#eadfd6] bg-white text-[#62564a]"
            }`}
          >
            {copy.sendToAll}
          </button>
          {providerInterests.map((interest) => (
            <button
              key={interest}
              type="button"
              onClick={() => setSelectedInterest(interest)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                selectedInterest === interest ? "bg-[#ff6b35] text-white" : "border border-[#eadfd6] bg-white text-[#62564a]"
              }`}
            >
              {getInterestLabel(interest, currentLanguage)}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-[1.4rem] border border-[#efe4d9] bg-[#fffaf6] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8f857b]">{copy.selectedAudience}</p>
              <p className="mt-2 text-xl font-bold text-[#131316]">
                {filteredReviewers.length} <span className="text-base font-semibold text-[#8f857b]">{copy.recipients}</span>
              </p>
            </div>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#dc4f1f] shadow-sm">
              <SendHorizontal className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-3 text-sm text-[#62626d]">
            {selectedInterest === "all" ? copy.audienceSummaryAll : copy.audienceSummaryFiltered}
          </p>
        </div>

        <div className="mt-4 rounded-[1.4rem] border border-[#efe4d9] bg-white p-4">
          <label className="text-sm font-semibold text-[#131316]" htmlFor="campaign-message">
            {copy.messageLabel}
          </label>
          <textarea
            id="campaign-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={5}
            className="mt-3 min-h-[140px] w-full rounded-[1.2rem] border border-[#eadfd6] bg-[#fffdfb] px-4 py-3 text-sm text-[#131316] outline-none transition focus:border-[#ffb18d] focus:ring-2 focus:ring-[#ffd7c5]"
            placeholder={copy.messagePlaceholder}
          />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" className="btn-secondary" onClick={improveWithAi} disabled={isImproving || isPending}>
              <WandSparkles className="h-4 w-4" />
              {isImproving ? copy.improving : copy.improveWithAi}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={sendCampaign}
              disabled={isPending || isImproving || !filteredReviewers.length}
            >
              {isPending ? copy.sendingCampaign : `${copy.sendCampaign} ${filteredReviewers.length}`}
            </button>
            <Link href="/dashboard?section=messages" className="text-sm font-semibold text-[#dc4f1f]">
              {copy.openMessages}
            </Link>
          </div>

          {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}
          {success ? <p className="mt-3 text-sm font-semibold text-[#1f7a4d]">{success}</p> : null}
        </div>
      </div>
    </section>
  );
}
