"use client";

import { useMemo, useState, useTransition } from "react";
import { Headset, LifeBuoy, SendHorizontal } from "lucide-react";
import { supportCopy, type AppLanguage } from "@/lib/i18n";
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
  const [isPending, startTransition] = useTransition();

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

  function prependOrUpdateThread(thread: SupportThread) {
    setItems((current) => {
      const filtered = current.filter((item) => item.id !== thread.id);
      return [thread, ...filtered];
    });
    setActiveThreadId(thread.id);
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
        data?: { id: number; sender_id: string; body: string; created_at: string };
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

  return (
    <section className={`grid gap-4 ${showThreadPanel ? "lg:grid-cols-[320px_minmax(0,1fr)]" : ""}`}>
      <div className="rounded-[1.8rem] border border-[#eadfd6] bg-white p-4 shadow-[0_18px_36px_rgba(22,18,14,0.04)]">
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
            <select className="input mt-3" value={newThreadCategory} onChange={(event) => setNewThreadCategory(event.target.value)}>
              {SUPPORT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {getSupportCategoryLabel(category, language)}
                </option>
              ))}
            </select>
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
              placeholder="Buscar por asunto, usuario o correo"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">Todos los estados</option>
                <option value="open">{getSupportStatusLabel("open", language)}</option>
                <option value="in_progress">{getSupportStatusLabel("in_progress", language)}</option>
                <option value="resolved">{getSupportStatusLabel("resolved", language)}</option>
              </select>
              <select className="input" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
                <option value="all">Todas las prioridades</option>
                <option value="low">{getSupportPriorityLabel("low", language)}</option>
                <option value="normal">{getSupportPriorityLabel("normal", language)}</option>
                <option value="high">{getSupportPriorityLabel("high", language)}</option>
              </select>
            </div>
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
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
        <div className="rounded-[1.8rem] border border-[#eadfd6] bg-white p-4 shadow-[0_18px_36px_rgba(22,18,14,0.04)]">
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

            <div className="mt-4 space-y-3">
              {activeThread.messages.map((message) => {
                const isMine = message.senderId === currentUserId;
                return (
                  <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[82%] rounded-[1.3rem] px-4 py-3 ${isMine ? "bg-[#ff6b35] text-white" : "bg-[#fff8f3] text-[#62564a]"}`}>
                      <p className="text-[11px] font-semibold opacity-80">
                        {isMine ? (isAdmin ? copy.supportLabel : copy.userLabel) : isAdmin ? copy.userLabel : copy.supportLabel}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{message.body}</p>
                      <p className="mt-2 text-[11px] opacity-70">{new Date(message.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex items-end gap-3 rounded-[1.5rem] border border-[#e8ddd2] bg-[#f8f3ed] p-3">
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
