"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowUpRight, CircleHelp, CircleX, Copy, MessageCircleMore } from "lucide-react";
import { parseContactMethods } from "@/lib/provider-contact";
import { createClient } from "@/lib/supabase/client";
import { normalizeLanguage, providerContactsCopy, type AppLanguage } from "@/lib/i18n";

type ProviderContact = {
  id: string;
  title: string;
  network: string | null;
  url: string;
  notes: string | null;
  is_verified: boolean;
  avatar_data_url?: string | null;
  contact_methods?: string | null;
  source?: "admin" | "registered";
  source_label?: string | null;
  history_id?: number | null;
};

type ProviderContactGridProps = {
  contacts: ProviderContact[];
  initialContactedIds: string[];
  language: AppLanguage;
  reviewerId: string;
};

export function ProviderContactGrid({ contacts, initialContactedIds, language, reviewerId }: ProviderContactGridProps) {
  const copy = providerContactsCopy[normalizeLanguage(language)];
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedReportContactId, setSelectedReportContactId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "contacted">("pending");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isReportPending, startReportTransition] = useTransition();
  const contactedStorageKey = `provider-contacted:${reviewerId}`;
  const copyTipStorageKey = `provider-copy-tip:${reviewerId}`;
  const [dismissedSearchTip, setDismissedSearchTip] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(copyTipStorageKey) === "1";
  });
  const [contactedIds, setContactedIds] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return initialContactedIds;
    }

    try {
      const stored = window.localStorage.getItem(contactedStorageKey);
      if (!stored) {
        return initialContactedIds;
      }

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        return initialContactedIds;
      }

      return Array.from(new Set([...initialContactedIds, ...parsed.filter((item): item is string => typeof item === "string")]));
    } catch {
      return initialContactedIds;
    }
  });

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === selectedContactId) || null,
    [contacts, selectedContactId]
  );
  const selectedReportContact = useMemo(
    () => contacts.find((contact) => contact.id === selectedReportContactId) || null,
    [contacts, selectedReportContactId]
  );
  const methods = useMemo(
    () =>
      selectedContact
        ? parseContactMethods(selectedContact.contact_methods, selectedContact.url, selectedContact.network)
        : [],
    [selectedContact]
  );
  const pendingContacts = useMemo(
    () => contacts.filter((contact) => !contactedIds.includes(contact.id)),
    [contacts, contactedIds]
  );
  const contactedContacts = useMemo(
    () => contacts.filter((contact) => contactedIds.includes(contact.id)),
    [contacts, contactedIds]
  );
  const visibleContacts = activeTab === "pending" ? pendingContacts : contactedContacts;
  const copyContactedCount = useMemo(
    () =>
      contacts
        .filter((contact) => contactedIds.includes(contact.id))
        .filter((contact) => hasOnlyCopyMethods(contact)).length,
    [contactedIds, contacts]
  );
  const showSearchTip = copyContactedCount >= 5 && !dismissedSearchTip;
  const reportOptions = useMemo(
    () => [
      { value: "no_reply", label: copy.reportNoReply },
      { value: "not_provider", label: copy.reportNotProvider },
      { value: "trusted", label: copy.reportTrusted },
      { value: "scam", label: copy.reportScam },
      { value: "broken_contact", label: copy.reportBrokenContact },
    ],
    [copy.reportBrokenContact, copy.reportNoReply, copy.reportNotProvider, copy.reportScam, copy.reportTrusted]
  );

  function hasOnlyCopyMethods(contact: ProviderContact) {
    const contactMethods = parseContactMethods(contact.contact_methods, contact.url, contact.network);
    return contactMethods.length > 0 && contactMethods.every((method) => method.mode === "copy");
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.removeItem("provider-contacted");
    window.localStorage.setItem(contactedStorageKey, JSON.stringify(contactedIds));
  }, [contactedIds, contactedStorageKey]);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setFeedback(null);
    }, 2000);

    return () => window.clearTimeout(timeout);
  }, [feedback]);

  function markAsContacted(contactId: string) {
    setContactedIds((current) => (current.includes(contactId) ? current : [...current, contactId]));
  }

  function canReportContact(contact: ProviderContact) {
    return Number.isFinite(contact.history_id);
  }

  function buildWhatsappInviteMessage() {
    const inviteUrl = "https://verifyzon.com/?invite=provider-directory";
    return [
      "Hi, I am reaching out because your contact appears in the private Verifyzon directory.",
      "I am a reviewer and I would like to work with you.",
      "Verifyzon helps providers connect with reviewers with verified identity through a safer workflow.",
      `If you want to join Verifyzon and manage your presence there, start here: ${inviteUrl}`,
    ].join(" ");
  }

  function buildMethodHref(label: string, href: string) {
    if (label !== "WhatsApp") {
      return href;
    }

    try {
      const url = new URL(href);
      const message = buildWhatsappInviteMessage();
      if (!message) return href;
      url.searchParams.set("text", message);
      return url.toString();
    } catch {
      return href;
    }
  }

  function openMethod(contact: ProviderContact, method: (typeof methods)[number], href?: string) {
    setError(null);
    setFeedback(null);

    if (method.mode === "link" && href) {
      if (/^(tel:|mailto:)/i.test(href)) {
        window.location.href = href;
      } else {
        window.open(href, "_blank", "noopener,noreferrer");
      }
    }

    startTransition(async () => {
      if (contact.history_id) {
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          setError(copy.sessionError);
          return;
        }

        const { error: insertError } = await supabase.from("reviewer_contact_history").upsert({
          reviewer_id: user.id,
          provider_contact_id: contact.history_id,
          contacted_at: new Date().toISOString(),
        });

        if (insertError) {
          setError(insertError.message);
          return;
        }
      }

      markAsContacted(contact.id);
      setSelectedContactId(null);

      if (method.mode === "copy") {
        try {
          await navigator.clipboard.writeText(method.value);
          setFeedback(`${method.label}: ${method.value}`);
        } catch {
          setError(copy.sessionError);
        }
        return;
      }

      if (!href) {
        setError(copy.sessionError);
      }
    });
  }

  function isSocialReference(contact: ProviderContact) {
    const network = String(contact.network || "").toLowerCase();
    return network.includes("messenger") || network.includes("facebook");
  }

  function submitContactReport(contact: ProviderContact, reportType: string) {
    if (!contact.history_id) {
      setReportError(copy.reportSubmitError);
      return;
    }

    setReportError(null);
    startReportTransition(async () => {
      try {
        const response = await fetch("/api/provider-contact-reports", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            providerContactId: contact.history_id,
            reportType,
          }),
        });

        const data = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          throw new Error(data.error || copy.reportSubmitError);
        }

        setSelectedReportContactId(null);
        setFeedback(copy.reportSubmitSuccess);
      } catch (submitError) {
        setReportError(submitError instanceof Error ? submitError.message : copy.reportSubmitError);
      }
    });
  }

  return (
    <>
      <div className="mt-4 flex rounded-full border border-[#e8ddd2] bg-[#f8f3ed] p-1">
        <button
          type="button"
          onClick={() => setActiveTab("pending")}
          className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold transition ${
            activeTab === "pending" ? "bg-white text-[#131316] shadow-sm" : "text-[#7c7064]"
          }`}
        >
          {copy.pending} ({pendingContacts.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("contacted")}
          className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold transition ${
            activeTab === "contacted" ? "bg-white text-[#131316] shadow-sm" : "text-[#7c7064]"
          }`}
        >
          {copy.contacted} ({contactedContacts.length})
        </button>
      </div>

      <div className="mt-3 grid gap-3">
        {visibleContacts.map((contact) => (
          <article key={contact.id} className="rounded-[1.5rem] border border-[#eee5db] bg-[linear-gradient(180deg,#ffffff_0%,#fcfaf7_100%)] p-4">
            {contact.avatar_data_url && isSocialReference(contact) ? (
              <div className="mb-4 overflow-hidden rounded-[1.15rem] border border-[#eadfd6] bg-[#f5eee6]">
                <img
                  src={contact.avatar_data_url}
                  alt={contact.title}
                  className="h-[4.35rem] w-full object-contain object-left"
                />
              </div>
            ) : null}

            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {!isSocialReference(contact) ? (
                  contact.avatar_data_url ? (
                    <img
                      src={contact.avatar_data_url}
                      alt={contact.title}
                      className="h-12 w-12 rounded-full object-cover ring-1 ring-[#eadfd6]"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f4ece5] text-sm font-bold text-[#7c7064]">
                      {contact.title.slice(0, 1)}
                    </div>
                  )
                ) : null}
                <div>
                  <p className="font-semibold">{contact.title}</p>
                  <p className="text-xs text-[#62626d]">{contact.network || copy.undefinedNetwork}</p>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {contact.source_label ? (
                  <span className="rounded-full bg-[#f6f1ea] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#7c7064]">
                    {contact.source_label}
                  </span>
                ) : null}
                {contact.is_verified ? (
                  <span className="rounded-full bg-[#fff3ec] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#dc4f1f]">
                    {copy.verified}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedContactId(contact.id)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#dc4f1f]"
              >
                {activeTab === "pending"
                  ? hasOnlyCopyMethods(contact)
                    ? copy.copyUsername
                    : copy.contactProvider
                  : copy.contactAgain}
                {hasOnlyCopyMethods(contact) ? <Copy className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
              </button>

              {canReportContact(contact) ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedReportContactId(contact.id);
                    setReportError(null);
                  }}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#eadfd6] bg-[#fff8f2] text-[#b36b4d] transition hover:border-[#dc4f1f] hover:text-[#dc4f1f]"
                  aria-label={copy.reportHelp}
                  title={copy.reportHelp}
                >
                  <CircleHelp className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {!visibleContacts.length ? (
        <div className="mt-3 rounded-[1.5rem] border border-dashed border-[#e6ddd1] bg-[#fffdf9] p-5 text-sm text-[#62626d]">
          {activeTab === "pending"
            ? copy.noPending
            : copy.noContacted}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}
      {feedback ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div className="rounded-full bg-[#131316]/92 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur">
            {feedback} {copy.copiedPrefix.toLowerCase()}.
          </div>
        </div>
      ) : null}

      {selectedContact ? (
        <div className="fixed inset-0 z-30 bg-[#131316]/45 p-4 backdrop-blur-sm">
          <div className="mx-auto mt-16 w-full max-w-md rounded-[1.8rem] border border-[#e7ddd2] bg-white p-5 shadow-[0_26px_80px_rgba(17,17,17,0.18)]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {selectedContact.avatar_data_url ? (
                  <img
                    src={selectedContact.avatar_data_url}
                    alt={selectedContact.title}
                    className={`ring-1 ring-[#eadfd6] ${
                      isSocialReference(selectedContact)
                        ? "h-[3.6rem] w-[9.4rem] rounded-[1rem] bg-[#f5eee6] object-contain object-left"
                        : "h-14 w-14 rounded-full object-cover"
                    }`}
                  />
                ) : null}
                <div>
                <p className="text-sm font-semibold text-[#dc4f1f]">
                  {methods.length > 0 && methods.every((method) => method.mode === "copy")
                    ? copy.copyProviderTitle
                    : copy.contactProviderTitle}
                </p>
                <h3 className="mt-2 text-2xl font-bold">{selectedContact.title}</h3>
                <p className="mt-2 text-sm text-[#62626d]">
                  {methods.length > 0 && methods.every((method) => method.mode === "copy")
                    ? copy.copyProviderBody
                    : copy.contactProviderBody}
                </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedContactId(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e5e5df] text-[#62626d]"
              >
                <CircleX className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              {methods.map((method) => (
                <button
                  key={`${selectedContact.id}-${method.label}-${method.value}`}
                  type="button"
                  onClick={() =>
                    openMethod(
                      selectedContact,
                      method,
                      method.mode === "link" && method.href ? buildMethodHref(method.label, method.href) : undefined
                    )
                  }
                  disabled={isPending}
                  className="inline-flex items-center justify-between rounded-[1.4rem] border border-[#ebdfd2] bg-[#fcfaf7] px-4 py-4 text-left"
                >
                    <span className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff1e8] text-[#dc4f1f]">
                      <MessageCircleMore className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm text-[#62626d]">
                        {method.mode === "copy" ? copy.copyVia : copy.contactVia}
                      </span>
                      <span className="block font-semibold">{method.label}</span>
                    </span>
                  </span>
                  {method.mode === "copy" ? (
                    <Copy className="h-4 w-4 text-[#dc4f1f]" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-[#dc4f1f]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {selectedReportContact ? (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-[#131316]/45 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => {
            if (isReportPending) return;
            setSelectedReportContactId(null);
            setReportError(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-[1.8rem] border border-[#e7ddd2] bg-white p-5 shadow-[0_26px_80px_rgba(17,17,17,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#dc4f1f]">{copy.reportHelp}</p>
                <h3 className="mt-2 text-2xl font-bold text-[#131316]">{copy.reportTitle}</h3>
                <p className="mt-3 text-sm leading-7 text-[#62564a]">{copy.reportBody}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (isReportPending) return;
                  setSelectedReportContactId(null);
                  setReportError(null);
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e5e5df] text-[#62626d]"
              >
                <CircleX className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              {reportOptions.map((option) => (
                <button
                  key={`${selectedReportContact.id}-${option.value}`}
                  type="button"
                  disabled={isReportPending}
                  onClick={() => submitContactReport(selectedReportContact, option.value)}
                  className="rounded-[1.25rem] border border-[#eadfd6] bg-[#fcfaf7] px-4 py-4 text-left text-sm font-semibold text-[#131316] transition hover:border-[#dc4f1f] hover:bg-[#fff6f0] disabled:opacity-60"
                >
                  {option.label}
                </button>
              ))}
            </div>

            <p className="mt-4 text-xs leading-6 text-[#8f857b]">{copy.reviewQueueHint}</p>
            {reportError ? <p className="mt-3 text-sm font-semibold text-red-600">{reportError}</p> : null}
          </div>
        </div>
      ) : null}

      {showSearchTip ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#131316]/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[1.8rem] border border-[#eadfd6] bg-[linear-gradient(180deg,#fffdfa_0%,#fff7f1_100%)] p-6 shadow-[0_28px_90px_rgba(19,19,22,0.22)]">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#dc4f1f]">Search tip</p>
            <h3 className="mt-3 text-2xl font-bold text-[#131316]">Finding the right profile can take a moment</h3>
            <p className="mt-4 text-sm leading-7 text-[#62564a]">
              We understand it can be difficult to find users on Facebook. We recommend typing keywords next to the username and searching calmly through each profile until you find the right one.
            </p>
            <p className="mt-3 text-sm leading-7 text-[#62564a]">
              We work every day to improve this part of the service.
            </p>
            <button
              type="button"
              className="btn-primary mt-5 w-full sm:w-auto"
              onClick={() => {
                setDismissedSearchTip(true);
                if (typeof window !== "undefined") {
                  window.localStorage.setItem(copyTipStorageKey, "1");
                }
              }}
            >
              I understand
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
