"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Headset, LifeBuoy, SendHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { languageToLocale, normalizeLanguage, supportCopy, type AppLanguage } from "@/lib/i18n";
import { SUPPORT_CATEGORIES, getSupportCategoryLabel, getSupportPriorityLabel, getSupportStatusLabel } from "@/lib/support";

type SupportThread = {
  id: number;
  userId: string;
  userName: string;
  userEmail: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  lastActivityAt: string;
  assignedAdminId?: string | null;
  assignedAdminName?: string | null;
  messages: Array<{
    id: number;
    senderId: string;
    senderName: string;
    body: string;
    sourceLanguage: AppLanguage;
    translations?: Record<string, string> | null;
    createdAt: string;
  }>;
};

type SupportCenterProps = {
  currentUserId: string;
  language: AppLanguage;
  isAdmin?: boolean;
  threads: SupportThread[];
};

export function SupportCenter({ currentUserId, language, isAdmin = false, threads }: SupportCenterProps) {
  const [supabase] = useState(() => createClient());
  const copy = supportCopy[language];
  const [items, setItems] = useState(threads);
  const [activeThreadId, setActiveThreadId] = useState<number | null>(threads[0]?.id ?? null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [newThreadSubject, setNewThreadSubject] = useState("");
  const [newThreadCategory, setNewThreadCategory] = useState("general");
  const [newThreadMessage, setNewThreadMessage] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showOriginalByMessageId, setShowOriginalByMessageId] = useState<Record<number, boolean>>({});
  const [isPending, startTransition] = useTransition();
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setItems(threads);
    setActiveThreadId((current) => {
      if (current && threads.some((thread) => thread.id === current)) {
        return current;
      }
      return threads[0]?.id ?? null;
    });
  }, [threads]);

  const sortedThreads = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return [...items]
      .filter((thread) => {
        if (statusFilter !== "all" && thread.status !== statusFilter) {
          return false;
        }
        if (priorityFilter !== "all" && thread.priority !== priorityFilter) {
          return false;
        }
        if (!normalizedQuery) {
          return true;
        }
        return [thread.subject, thread.userName, thread.userEmail, thread.category]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((left, right) => new Date(right.lastActivityAt).getTime() - new Date(left.lastActivityAt).getTime());
  }, [items, priorityFilter, searchQuery, statusFilter]);
  const activeThread = sortedThreads.find((thread) => thread.id === activeThreadId) || null;
  const showThreadPanel = isAdmin || Boolean(activeThread);

  function getRenderedMessage(message: SupportThread["messages"][number], isMine: boolean) {
    const translatedBody =
      !isMine && language !== message.sourceLanguage ? message.translations?.[language] || null : null;
    const showOriginal = Boolean(showOriginalByMessageId[message.id]);

    return {
      translatedBody,
      displayBody: translatedBody && !showOriginal ? translatedBody : message.body,
      showOriginalToggle: Boolean(translatedBody),
      showOriginal,
    };
  }

  function prependOrUpdateThread(thread: SupportThread) {
    setItems((current) => {
      const filtered = current.filter((item) => item.id !== thread.id);
      return [thread, ...filtered];
    });
    setActiveThreadId(thread.id);
  }

  async function syncThreads(showErrors = false) {
    const response = await fetch("/api/support/threads", {
      method: "GET",
      cache: "no-store",
    });

    const result = (await response.json()) as { data?: SupportThread[]; error?: string };
    if (!response.ok || !result.data) {
      if (showErrors) {
        setError(result.error || copy.changeStatus);
      }
      return;
    }

    setItems(result.data);
    setActiveThreadId((current) => {
      if (current && result.data?.some((thread) => thread.id === current)) {
        return current;
      }
      return result.data?.[0]?.id ?? null;
    });
  }

  async function createThread() {
    if (!newThreadSubject.trim() || !newThreadMessage.trim()) {
      setError(copy.firstMessage);
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const response = await fetch("/api/support/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: newThreadSubject,
          category: newThreadCategory,
          message: newThreadMessage,
        }),
      });

      const result = (await response.json()) as { data?: { id?: number }; error?: string };
      if (!response.ok || !result.data?.id) {
        setError(result.error || copy.creating);
        return;
      }

      prependOrUpdateThread({
        id: result.data.id,
        userId: currentUserId,
        userName: copy.userLabel,
        userEmail: "",
        subject: newThreadSubject.trim(),
        category: newThreadCategory,
        status: "open",
        priority: "normal",
        lastActivityAt: new Date().toISOString(),
        assignedAdminId: null,
        assignedAdminName: null,
        messages: [
          {
            id: Date.now(),
            senderId: currentUserId,
            senderName: copy.userLabel,
            body: newThreadMessage.trim(),
            sourceLanguage: language,
            translations: null,
            createdAt: new Date().toISOString(),
          },
        ],
      });
      setNewThreadSubject("");
      setNewThreadCategory("general");
      setNewThreadMessage("");
      setSuccess(copy.statusUpdated);
    });
  }

  async function sendMessage() {
    if (!activeThread || !draftMessage.trim()) {
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const response = await fetch("/api/support/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: activeThread.id,
          body: draftMessage,
        }),
      });

      const result = (await response.json()) as {
        data?: {
          id: number;
          sender_id: string;
          body: string;
          source_language?: string | null;
          translations?: Record<string, string> | null;
          created_at: string;
        };
        error?: string;
      };

      if (!response.ok || !result.data) {
        setError(result.error || copy.sending);
        return;
      }

      prependOrUpdateThread({
        ...activeThread,
        lastActivityAt: result.data.created_at,
        messages: [
          ...activeThread.messages,
          {
            id: result.data.id,
            senderId: result.data.sender_id,
            senderName: isAdmin ? copy.supportLabel : copy.userLabel,
            body: result.data.body,
            sourceLanguage: normalizeLanguage(result.data.source_language),
            translations: result.data.translations || null,
            createdAt: result.data.created_at,
          },
        ],
      });
      setDraftMessage("");
    });
  }

  async function updateThread(updates: { status?: string; priority?: string; assignToMe?: boolean }) {
    if (!isAdmin || !activeThread) {
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const response = await fetch("/api/support/threads/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: activeThread.id,
          ...updates,
        }),
      });

      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error || copy.changeStatus);
        return;
      }

      prependOrUpdateThread({
        ...activeThread,
        status: updates.status || activeThread.status,
        priority: updates.priority || activeThread.priority,
        assignedAdminId: updates.assignToMe ? currentUserId : activeThread.assignedAdminId,
        assignedAdminName: updates.assignToMe ? copy.supportLabel : activeThread.assignedAdminName,
        lastActivityAt: new Date().toISOString(),
      });
      setSuccess(copy.statusUpdated);
    });
  }

  useEffect(() => {
    const channel = supabase
      .channel(`support-center-${currentUserId}-${isAdmin ? "admin" : "user"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_threads" },
        () => {
          void syncThreads();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages" },
        (payload) => {
          const message = payload.new as {
            id: number;
            thread_id: number;
            sender_id: string;
            body: string;
            source_language?: string | null;
            translations?: Record<string, string> | null;
            created_at: string;
          };
          let threadExists = false;

          setItems((current) =>
            current.map((thread) => {
              if (thread.id !== Number(message.thread_id)) {
                return thread;
              }

              threadExists = true;
              if (thread.messages.some((item) => item.id === Number(message.id))) {
                return thread;
              }

              const isUserMessage = message.sender_id === thread.userId;
              return {
                ...thread,
                lastActivityAt: message.created_at,
                messages: [
                  ...thread.messages,
                  {
                    id: Number(message.id),
                    senderId: message.sender_id,
                    senderName: isUserMessage ? thread.userName || copy.userLabel : thread.assignedAdminName || copy.supportLabel,
                    body: message.body,
                    sourceLanguage: normalizeLanguage(message.source_language),
                    translations: message.translations || null,
                    createdAt: message.created_at,
                  },
                ],
              };
            })
          );

          if (!threadExists) {
            void syncThreads();
          }

          setActiveThreadId((current) => current ?? Number(message.thread_id));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "support_threads" },
        (payload) => {
          const thread = payload.new as {
            id: number;
            status?: string;
            priority?: string;
            last_activity_at?: string | null;
            assigned_admin_id?: string | null;
          };

          setItems((current) =>
            current.map((item) =>
              item.id !== Number(thread.id)
                ? item
                : {
                    ...item,
                    status: typeof thread.status === "string" ? thread.status : item.status,
                    priority: typeof thread.priority === "string" ? thread.priority : item.priority,
                    lastActivityAt: thread.last_activity_at || item.lastActivityAt,
                    assignedAdminId: typeof thread.assigned_admin_id === "string" ? thread.assigned_admin_id : item.assignedAdminId,
                    assignedAdminName:
                      typeof thread.assigned_admin_id === "string" && thread.assigned_admin_id
                        ? thread.assigned_admin_id === currentUserId
                          ? copy.supportLabel
                          : item.assignedAdminName || copy.supportLabel
                        : null,
                  }
            )
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [copy.changeStatus, copy.supportLabel, copy.userLabel, currentUserId, isAdmin, supabase]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void syncThreads();
      }
    }, 8000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeThreadId, activeThread?.messages.length]);

  return (
    <section className={`grid gap-4 ${showThreadPanel ? "lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)] xl:items-start" : ""}`}>
      <div className="rounded-[1.8rem] border border-[#eadfd6] bg-white p-4 shadow-[0_18px_36px_rgba(22,18,14,0.04)] xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-hidden">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#131316]">{isAdmin ? copy.manageTitle : copy.title}</h2>
            <p className="mt-1 text-sm text-[#62626d]">{isAdmin ? copy.manageBody : copy.body}</p>
          </div>
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff3ec] text-[#dc4f1f]">
            <LifeBuoy className="h-5 w-5" />
          </span>
        </div>

        {!isAdmin ? (
          <div className="mt-4 rounded-[1.3rem] border border-[#efe4d9] bg-[#fffaf6] p-4">
            <p className="text-sm font-semibold text-[#131316]">{copy.newThread}</p>
            <input className="input mt-3" value={newThreadSubject} onChange={(event) => setNewThreadSubject(event.target.value)} placeholder={copy.subjectPlaceholder} />
            <div className="mt-3 rounded-[1.2rem] border border-[#eadfd6] bg-white p-3">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8f857b]">{copy.category}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {SUPPORT_CATEGORIES.map((category) => {
                  const active = newThreadCategory === category;

                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setNewThreadCategory(category)}
                      className={`rounded-[1rem] border px-3 py-3 text-left text-sm font-semibold transition ${
                        active
                          ? "border-[#ff6b35] bg-[linear-gradient(135deg,#fff1ea_0%,#ffe4d6_100%)] text-[#131316] shadow-[0_12px_24px_rgba(255,107,53,0.12)]"
                          : "border-[#eadfd6] bg-[#fffaf6] text-[#62564a] hover:border-[#f0cbb8] hover:bg-[#fff3ec]"
                      }`}
                    >
                      {getSupportCategoryLabel(category, language)}
                    </button>
                  );
                })}
              </div>
            </div>
            <textarea
              className="mt-3 min-h-24 w-full rounded-[1.2rem] border border-[#eadfd6] bg-white px-4 py-3 text-sm text-[#131316] outline-none"
              value={newThreadMessage}
              onChange={(event) => setNewThreadMessage(event.target.value)}
              placeholder={copy.firstMessagePlaceholder}
            />
            <button type="button" className="btn-primary mt-3" onClick={createThread} disabled={isPending}>
              {isPending ? copy.creating : copy.createThread}
            </button>
          </div>
        ) : null}

        {isAdmin ? (
          <div className="mt-4 grid gap-2 rounded-[1.3rem] border border-[#efe4d9] bg-[#fffaf6] p-4">
            <input
              className="input"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={copy.searchPlaceholder}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">{copy.allStatuses}</option>
                <option value="open">{getSupportStatusLabel("open", language)}</option>
                <option value="in_progress">{getSupportStatusLabel("in_progress", language)}</option>
                <option value="resolved">{getSupportStatusLabel("resolved", language)}</option>
              </select>
              <select className="input" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
                <option value="all">{copy.allPriorities}</option>
                <option value="low">{getSupportPriorityLabel("low", language)}</option>
                <option value="normal">{getSupportPriorityLabel("normal", language)}</option>
                <option value="high">{getSupportPriorityLabel("high", language)}</option>
              </select>
            </div>
          </div>
        ) : null}

        <div className="mt-4 space-y-3 xl:max-h-[calc(100vh-18rem)] xl:overflow-y-auto xl:pr-1">
          {sortedThreads.length ? (
            sortedThreads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => setActiveThreadId(thread.id)}
                className={`w-full rounded-[1.2rem] border px-4 py-3 text-left transition ${
                  activeThreadId === thread.id ? "border-[#ffcfbe] bg-[#fff8f3]" : "border-[#eadfd6] bg-[#fffdfa]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-[#131316]">{thread.subject}</p>
                  <span className="rounded-full bg-[#f6f0e9] px-3 py-1 text-[11px] font-semibold text-[#62564a]">
                    {getSupportStatusLabel(thread.status, language)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#8f857b]">
                  <span>{isAdmin ? thread.userName || thread.userEmail : getSupportCategoryLabel(thread.category, language)}</span>
                  <span className="rounded-full bg-[#fff3dc] px-2 py-0.5 font-semibold text-[#b77212]">
                    {getSupportPriorityLabel(thread.priority, language)}
                  </span>
                </div>
              </button>
            ))
          ) : (
            <div className="rounded-[1.2rem] border border-dashed border-[#e2d8cc] bg-[#fffaf5] p-5 text-sm text-[#62626d]">
              <p className="font-semibold text-[#131316]">{copy.emptyTitle}</p>
              <p className="mt-1">{copy.emptyBody}</p>
            </div>
          )}
        </div>
      </div>

      {showThreadPanel ? (
        <div className="rounded-[1.8rem] border border-[#eadfd6] bg-white p-4 shadow-[0_18px_36px_rgba(22,18,14,0.04)] xl:min-h-[calc(100vh-3rem)] xl:p-5">
        {activeThread ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#efe5db] pb-4">
              <div>
                <p className="text-sm font-semibold text-[#dc4f1f]">{getSupportCategoryLabel(activeThread.category, language)}</p>
                <h3 className="mt-1 text-xl font-bold text-[#131316]">{activeThread.subject}</h3>
                <p className="mt-1 text-sm text-[#62626d]">
                  {isAdmin ? `${activeThread.userName || copy.userLabel} · ${activeThread.userEmail}` : getSupportStatusLabel(activeThread.status, language)}
                </p>
                {isAdmin ? (
                  <p className="mt-1 text-xs text-[#8f857b]">
                    {activeThread.assignedAdminId ? `${copy.assignedTo}: ${activeThread.assignedAdminName || copy.supportLabel}` : copy.unassigned}
                  </p>
                ) : null}
              </div>

              {isAdmin ? (
                <div className="flex flex-wrap items-center gap-2">
                  <select className="input max-w-[220px]" value={activeThread.status} onChange={(event) => void updateThread({ status: event.target.value })}>
                    <option value="open">{getSupportStatusLabel("open", language)}</option>
                    <option value="in_progress">{getSupportStatusLabel("in_progress", language)}</option>
                    <option value="resolved">{getSupportStatusLabel("resolved", language)}</option>
                  </select>
                  <select className="input max-w-[180px]" value={activeThread.priority} onChange={(event) => void updateThread({ priority: event.target.value })}>
                    <option value="low">{getSupportPriorityLabel("low", language)}</option>
                    <option value="normal">{getSupportPriorityLabel("normal", language)}</option>
                    <option value="high">{getSupportPriorityLabel("high", language)}</option>
                  </select>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => void updateThread({ assignToMe: true })}
                    disabled={activeThread.assignedAdminId === currentUserId}
                  >
                    {activeThread.assignedAdminId === currentUserId ? copy.assignedToMe : copy.assignToMe}
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-[#f6f0e9] px-3 py-1 text-xs font-semibold text-[#62564a]">
                    {getSupportStatusLabel(activeThread.status, language)}
                  </span>
                  <span className="rounded-full bg-[#fff3dc] px-3 py-1 text-xs font-semibold text-[#b77212]">
                    {getSupportPriorityLabel(activeThread.priority, language)}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-3 xl:max-h-[calc(100vh-20rem)] xl:overflow-y-auto xl:pr-2">
              {activeThread.messages.map((message) => {
                const isMine = message.senderId === currentUserId;
                const renderedMessage = getRenderedMessage(message, isMine);
                return (
                  <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[82%] rounded-[1.3rem] px-4 py-3 ${isMine ? "bg-[#ff6b35] text-white" : "bg-[#fff8f3] text-[#62564a]"}`}>
                      <p className="text-[11px] font-semibold opacity-80">{message.senderName}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{renderedMessage.displayBody}</p>
                      {renderedMessage.showOriginalToggle ? (
                        <button
                          type="button"
                          className="mt-2 text-[11px] font-semibold underline underline-offset-2 opacity-80"
                          onClick={() =>
                            setShowOriginalByMessageId((current) => ({
                              ...current,
                              [message.id]: !current[message.id],
                            }))
                          }
                        >
                          {renderedMessage.showOriginal ? copy.showTranslated : copy.showOriginal}
                        </button>
                      ) : null}
                      <p className="mt-2 text-[11px] opacity-70">{new Date(message.createdAt).toLocaleString(languageToLocale(language))}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomAnchorRef} />
            </div>

            <div className="mt-4 flex items-end gap-3 rounded-[1.5rem] border border-[#e8ddd2] bg-[#f8f3ed] p-3 xl:mt-5">
              <div className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-full bg-white text-[#62564a]">
                <Headset className="h-5 w-5" />
              </div>
              <textarea
                className="min-h-11 flex-1 resize-none border-none bg-transparent text-base text-[#131316] outline-none placeholder:text-[#8f857b]"
                style={{ fontSize: "16px" }}
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                placeholder={copy.writeMessage}
              />
              <button type="button" className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#ff6b35] text-white" onClick={sendMessage} disabled={isPending}>
                {isPending ? <span className="text-[10px] font-semibold">{copy.sending}</span> : <SendHorizontal className="h-4 w-4" />}
              </button>
            </div>
          </>
        ) : (
          <div className="rounded-[1.2rem] border border-dashed border-[#e2d8cc] bg-[#fffaf5] p-5 text-sm text-[#62626d]">
            <p className="font-semibold text-[#131316]">{copy.emptyTitle}</p>
            <p className="mt-1">{copy.emptyBody}</p>
          </div>
        )}

        {error ? <p className="mt-4 text-sm font-semibold text-red-600">{error}</p> : null}
        {success ? <p className="mt-4 text-sm font-semibold text-[#177a52]">{success}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
