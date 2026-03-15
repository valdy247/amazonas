"use client";

import { useMemo, useState, useTransition } from "react";
import { MessageCircleMore } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ConversationMessage = {
  id: number;
  senderId: string;
  body: string;
  createdAt: string;
};

type ConversationThread = {
  requestId: number;
  counterpartId: string;
  counterpartName: string;
  counterpartCountry: string;
  counterpartInterests: string[];
  messages: ConversationMessage[];
  lastActivityAt: string;
};

type CollaborationInboxProps = {
  currentUserId: string;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  threads: ConversationThread[];
};

export function CollaborationInbox({
  currentUserId,
  title,
  description,
  emptyTitle,
  emptyDescription,
  threads,
}: CollaborationInboxProps) {
  const supabase = createClient();
  const [items, setItems] = useState(threads);
  const [expandedId, setExpandedId] = useState<number | null>(threads[0]?.requestId ?? null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const sortedThreads = useMemo(
    () =>
      [...items].sort(
        (left, right) =>
          new Date(right.lastActivityAt).getTime() - new Date(left.lastActivityAt).getTime() ||
          right.counterpartName.localeCompare(left.counterpartName)
      ),
    [items]
  );

  function sendMessage(requestId: number) {
    const draft = drafts[requestId]?.trim() || "";
    if (!draft) {
      setError("Escribe un mensaje antes de enviarlo.");
      return;
    }

    setError(null);
    setPendingId(requestId);

    startTransition(async () => {
      const { data, error: insertError } = await supabase
        .from("request_messages")
        .insert({
          request_id: requestId,
          sender_id: currentUserId,
          body: draft,
        })
        .select("id, sender_id, body, created_at")
        .single();

      if (insertError) {
        setError(insertError.message);
        setPendingId(null);
        return;
      }

      const timestamp = new Date().toISOString();
      await supabase
        .from("reviewer_contact_requests")
        .update({
          updated_at: timestamp,
          last_activity_at: timestamp,
        })
        .eq("id", requestId);

      setItems((current) =>
        current.map((thread) =>
          thread.requestId === requestId
            ? {
                ...thread,
                lastActivityAt: timestamp,
                messages: [
                  ...thread.messages,
                  {
                    id: data.id as number,
                    senderId: String(data.sender_id),
                    body: String(data.body),
                    createdAt: String(data.created_at),
                  },
                ],
              }
            : thread
        )
      );
      setDrafts((current) => ({ ...current, [requestId]: "" }));
      setPendingId(null);
    });
  }

  if (!sortedThreads.length) {
    return (
      <section className="card p-5">
        <h2 className="text-xl font-bold">{emptyTitle}</h2>
        <p className="mt-2 text-sm text-[#62626d]">{emptyDescription}</p>
      </section>
    );
  }

  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="mt-1 text-sm text-[#62626d]">{description}</p>
        </div>
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff3ec] text-[#dc4f1f]">
          <MessageCircleMore className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {sortedThreads.map((thread) => {
          const isExpanded = expandedId === thread.requestId;

          return (
            <article key={thread.requestId} className="overflow-hidden rounded-[1.35rem] border border-[#e6ddd1] bg-[#fffdfa]">
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left"
                onClick={() => setExpandedId((current) => (current === thread.requestId ? null : thread.requestId))}
              >
                <div>
                  <p className="font-semibold text-[#131316]">{thread.counterpartName}</p>
                  <p className="mt-1 text-sm text-[#62626d]">{thread.counterpartCountry || "Sin pais"} · {thread.messages.length} mensajes</p>
                  {thread.counterpartInterests.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {thread.counterpartInterests.slice(0, 3).map((interest) => (
                        <span key={`${thread.requestId}-${interest}`} className="rounded-full border border-[#ece3d9] bg-white px-3 py-1 text-xs font-semibold text-[#62564a]">
                          {interest}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <span className="rounded-full bg-[#fff3ec] px-3 py-1 text-xs font-semibold text-[#dc4f1f]">
                  {new Date(thread.lastActivityAt).toLocaleDateString()}
                </span>
              </button>

              {isExpanded ? (
                <div className="border-t border-[#ece3d9] px-4 py-4">
                  <div className="space-y-3">
                    {thread.messages.map((message) => {
                      const isMine = message.senderId === currentUserId;

                      return (
                        <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[85%] rounded-[1.25rem] px-4 py-3 text-sm ${
                              isMine ? "bg-[#ff6b35] text-white" : "border border-[#ece3d9] bg-white text-[#62564a]"
                            }`}
                          >
                            <p>{message.body}</p>
                            <p className={`mt-2 text-[11px] ${isMine ? "text-white/70" : "text-[#8f857b]"}`}>
                              {new Date(message.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <textarea
                    className="input mt-4 min-h-24 resize-none"
                    value={drafts[thread.requestId] || ""}
                    onChange={(event) => setDrafts((current) => ({ ...current, [thread.requestId]: event.target.value }))}
                    placeholder="Escribe tu siguiente mensaje..."
                  />
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => sendMessage(thread.requestId)}
                      disabled={isPending && pendingId === thread.requestId}
                    >
                      {isPending && pendingId === thread.requestId ? "Enviando..." : "Enviar mensaje"}
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}
    </section>
  );
}
