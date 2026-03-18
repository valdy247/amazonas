"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
  const [showRemovalForm, setShowRemovalForm] = useState(false);
  const [contactChannel, setContactChannel] = useState<"whatsapp" | "messenger" | "facebook">("whatsapp");
  const [contactValue, setContactValue] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  async function submitRemovalRequest() {
    setRequestError(null);
    setRequestSuccess(null);

    if (!contactValue.trim()) {
      setRequestError(
        contactChannel === "whatsapp" ? "Please enter your WhatsApp number." : "Please paste your profile link."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/directory-removal-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contactChannel,
          contactValue: contactValue.trim(),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not submit the request.");
      }

      setContactValue("");
      setRequestSuccess(copy.providerInviteSuccess);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Could not submit the request.");
    } finally {
      setIsSubmitting(false);
    }
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

        <div className="mt-5 rounded-[1.5rem] border border-[#eadfd6] bg-white/80 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8f857b]">{copy.providerInviteBenefitsTitle}</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-[#62564a]">
            <li>• {copy.providerInviteBenefitOne}</li>
            <li>• {copy.providerInviteBenefitTwo}</li>
            <li>• {copy.providerInviteBenefitThree}</li>
          </ul>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href={signupHref} className="btn-primary w-full sm:w-auto">
            {copy.providerInvitePrimary}
          </Link>
          <button type="button" onClick={closeModal} className="btn-secondary w-full sm:w-auto">
            {copy.providerInviteSecondary}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowRemovalForm((current) => !current)}
          className="mt-5 text-sm font-semibold text-[#dc4f1f] underline underline-offset-4"
        >
          {copy.providerInviteRemoveLink}
        </button>

        {showRemovalForm ? (
          <div className="mt-4 rounded-[1.5rem] border border-[#eadfd6] bg-white p-4">
            <h3 className="text-lg font-bold text-[#131316]">{copy.providerInviteRemoveTitle}</h3>
            <p className="mt-2 text-sm leading-6 text-[#62564a]">{copy.providerInviteRemoveBody}</p>

            <div className="mt-4">
              <label className="text-sm font-semibold text-[#131316]">{copy.providerInviteChannelLabel}</label>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {[
                  { value: "whatsapp", label: copy.providerInviteWhatsapp },
                  { value: "messenger", label: copy.providerInviteMessenger },
                  { value: "facebook", label: copy.providerInviteFacebook },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setContactChannel(option.value as "whatsapp" | "messenger" | "facebook")}
                    className={`rounded-[1rem] border px-3 py-3 text-sm font-semibold transition ${
                      contactChannel === option.value
                        ? "border-[#dc4f1f] bg-[#fff3ec] text-[#dc4f1f]"
                        : "border-[#eadfd6] bg-[#fcfaf7] text-[#62564a]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <label className="text-sm font-semibold text-[#131316]">
                {contactChannel === "whatsapp" ? copy.providerInvitePhoneLabel : copy.providerInviteProfileLabel}
              </label>
              <input
                value={contactValue}
                onChange={(event) => setContactValue(event.target.value)}
                className="input mt-2"
                placeholder={
                  contactChannel === "whatsapp"
                    ? copy.providerInvitePhonePlaceholder
                    : copy.providerInviteProfilePlaceholder
                }
              />
            </div>

            {requestError ? <p className="mt-3 text-sm font-semibold text-[#c24d3a]">{requestError}</p> : null}
            {requestSuccess ? <p className="mt-3 text-sm font-semibold text-[#177a52]">{requestSuccess}</p> : null}

            <button
              type="button"
              onClick={submitRemovalRequest}
              disabled={isSubmitting}
              className="btn-primary mt-4 w-full sm:w-auto"
            >
              {isSubmitting ? copy.providerInviteSubmitting : copy.providerInviteSubmit}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
