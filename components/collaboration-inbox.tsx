"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, ImagePlus, MessageCircleMore, SendHorizontal, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ConversationMessage = {
  id: number;
  senderId: string;
  body: string;
  createdAt: string;
  imageUrl?: string | null;
  imagePath?: string | null;
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

type DraftMedia = {
  file: File;
  previewUrl: string;
};

export function CollaborationInbox({
  currentUserId,
  title,
  description,
  emptyTitle,
  emptyDescription,
  threads,
}: CollaborationInboxProps) {
  const [supabase] = useState(() => createClient());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState(threads);
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  const [viewedThreadIds, setViewedThreadIds] = useState<number[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [mediaDrafts, setMediaDrafts] = useState<Record<number, DraftMedia | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const sortedThreads = useMemo(
    () =>
      [...items].sort(
        (left, right) =>
          new Date(right.lastActivityAt).getTime() - new Date(left.lastActivityAt).getTime() ||
          left.counterpartName.localeCompare(right.counterpartName)
      ),
    [items]
  );

  const activeThread = sortedThreads.find((thread) => thread.requestId === activeThreadId) || null;

  useEffect(() => {
    setItems(threads);
  }, [threads]);

  useEffect(() => {
    if (!activeThread) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, [activeThread]);

  useEffect(() => {
    const channel = supabase
      .channel(`request-messages-${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "request_messages" },
        (payload) => {
          const message = payload.new as {
            id: number;
            request_id: number;
            sender_id: string;
            body: string;
            created_at: string;
            image_url?: string | null;
            image_path?: string | null;
          };

          setItems((current) =>
            current.map((thread) => {
              if (thread.requestId !== Number(message.request_id)) {
                return thread;
              }

              if (thread.messages.some((item) => item.id === Number(message.id))) {
                return thread;
              }

              return {
                ...thread,
                lastActivityAt: String(message.created_at),
                messages: [
                  ...thread.messages,
                  {
                    id: Number(message.id),
                    senderId: String(message.sender_id),
                    body: String(message.body || ""),
                    createdAt: String(message.created_at),
                    imageUrl: typeof message.image_url === "string" ? message.image_url : null,
                    imagePath: typeof message.image_path === "string" ? message.image_path : null,
                  },
                ],
              };
            })
          );
          if (String(message.sender_id) !== currentUserId) {
            setViewedThreadIds((current) => current.filter((item) => item !== Number(message.request_id)));
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, supabase]);

  useEffect(() => {
    return () => {
      Object.values(mediaDrafts).forEach((item) => {
        if (item?.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, [mediaDrafts]);

  function openChat(threadId: number) {
    setActiveThreadId(threadId);
    setError(null);
    setViewedThreadIds((current) => (current.includes(threadId) ? current : [...current, threadId]));
  }

  function closeChat() {
    setActiveThreadId(null);
  }

  function selectImage(threadId: number) {
    setActiveThreadId(threadId);
    fileInputRef.current?.click();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const threadId = activeThreadId;

    if (!file || !threadId) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Solo puedes adjuntar imagenes.");
      return;
    }

    const previousPreview = mediaDrafts[threadId]?.previewUrl;
    if (previousPreview) {
      URL.revokeObjectURL(previousPreview);
    }

    setError(null);
    const previewUrl = URL.createObjectURL(file);
    setMediaDrafts((current) => ({ ...current, [threadId]: { file, previewUrl } }));
    event.target.value = "";
  }

  async function uploadMedia(requestId: number, file: File) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const filePath = `${requestId}/${currentUserId}-${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("request-message-media").upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

    if (uploadError) {
      throw new Error("No se pudo subir la imagen. Verifica el bucket request-message-media en Supabase.");
    }

    const { data } = supabase.storage.from("request-message-media").getPublicUrl(filePath);
    return { filePath, publicUrl: data.publicUrl };
  }

  function clearMediaDraft(requestId: number) {
    const previewUrl = mediaDrafts[requestId]?.previewUrl;
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setMediaDrafts((current) => ({ ...current, [requestId]: undefined }));
  }

  function sendMessage(requestId: number) {
    const draft = drafts[requestId]?.trim() || "";
    const mediaDraft = mediaDrafts[requestId];

    if (!draft && !mediaDraft) {
      setError("Escribe un mensaje o adjunta una imagen antes de enviarlo.");
      return;
    }

    setError(null);
    setPendingId(requestId);

    startTransition(async () => {
      try {
        let imageUrl: string | null = null;
        let imagePath: string | null = null;

        if (mediaDraft?.file) {
          const uploadResult = await uploadMedia(requestId, mediaDraft.file);
          imageUrl = uploadResult.publicUrl;
          imagePath = uploadResult.filePath;
        }

        const { data, error: insertError } = await supabase
          .from("request_messages")
          .insert({
            request_id: requestId,
            sender_id: currentUserId,
            body: draft,
            image_url: imageUrl,
            image_path: imagePath,
          })
          .select("id, sender_id, body, created_at, image_url, image_path")
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
                  messages: thread.messages.some((item) => item.id === Number(data.id))
                    ? thread.messages
                    : [
                        ...thread.messages,
                        {
                          id: Number(data.id),
                          senderId: String(data.sender_id),
                          body: String(data.body || ""),
                          createdAt: String(data.created_at),
                          imageUrl: typeof data.image_url === "string" ? data.image_url : null,
                          imagePath: typeof data.image_path === "string" ? data.image_path : null,
                        },
                      ],
                }
              : thread
          )
        );
        setDrafts((current) => ({ ...current, [requestId]: "" }));
        clearMediaDraft(requestId);
        setPendingId(null);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "No se pudo enviar el mensaje.");
        setPendingId(null);
      }
    });
  }

  if (!sortedThreads.length) {
    return (
      <section className="rounded-[1.8rem] border border-[#e8ddd2] bg-white p-5 shadow-[0_18px_36px_rgba(22,18,14,0.04)]">
        <h2 className="text-xl font-bold">{emptyTitle}</h2>
        <p className="mt-2 text-sm text-[#62626d]">{emptyDescription}</p>
      </section>
    );
  }

  return (
    <>
      <section className="overflow-hidden rounded-[1.9rem] border border-[#e8ddd2] bg-white shadow-[0_24px_60px_rgba(22,18,14,0.06)]">
        <div className="border-b border-[#efe5db] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">{title}</h2>
              <p className="mt-1 text-sm text-[#62626d]">{description}</p>
            </div>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff3ec] text-[#dc4f1f]">
              <MessageCircleMore className="h-5 w-5" />
            </span>
          </div>
        </div>

        <div className="divide-y divide-[#efe5db]">
          {sortedThreads.map((thread) => {
            const lastMessage = thread.messages[thread.messages.length - 1];
            const preview = lastMessage?.body || (lastMessage?.imageUrl ? "Te enviaron una imagen" : "Toca para abrir el chat");
            const isUnread = Boolean(lastMessage && lastMessage.senderId !== currentUserId && !viewedThreadIds.includes(thread.requestId));

            return (
              <button
                key={thread.requestId}
                type="button"
                onClick={() => openChat(thread.requestId)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-[#fff9f5]"
              >
                <span className="inline-flex h-12 w-12 flex-none items-center justify-center rounded-full bg-[linear-gradient(135deg,#ff8a5b_0%,#ff6b35_100%)] text-base font-bold text-white">
                  {thread.counterpartName.charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-3">
                    <span className="truncate text-base font-semibold text-[#131316]">{thread.counterpartName}</span>
                    <span className="text-xs text-[#8f857b]">{new Date(thread.lastActivityAt).toLocaleDateString()}</span>
                  </span>
                  <span className="mt-1 flex items-center gap-2">
                    {isUnread ? <span className="h-2.5 w-2.5 rounded-full bg-[#ff3b30]" /> : null}
                    <span className="truncate text-sm text-[#62626d]">{preview}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {activeThread ? (
        <div className="fixed inset-0 z-40 overflow-hidden bg-[#17120d]/35 backdrop-blur-sm [overscroll-behavior:none]">
          <div className="mx-auto flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-[#f8f3ed]">
            <div className="flex items-center justify-between border-b border-[#eadfd6] bg-white px-4 py-3">
              <div className="flex items-center gap-3">
                <button type="button" onClick={closeChat} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f7f1ea] text-[#131316]">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <p className="font-semibold text-[#131316]">{activeThread.counterpartName}</p>
                  <p className="text-xs text-[#8f857b]">{activeThread.counterpartCountry || "Sin pais"}</p>
                </div>
              </div>
              <button type="button" onClick={closeChat} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f7f1ea] text-[#131316]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 [overscroll-behavior:contain]">
              <div className="space-y-3">
                {activeThread.messages.length ? (
                  activeThread.messages.map((message) => {
                    const isMine = message.senderId === currentUserId;

                    return (
                      <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[82%] rounded-[1.4rem] px-4 py-3 ${
                            isMine ? "bg-[#ff6b35] text-white" : "bg-white text-[#62564a] shadow-[0_10px_24px_rgba(22,18,14,0.06)]"
                          }`}
                        >
                          {message.imageUrl ? (
                            <div className="overflow-hidden rounded-[1rem]">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={message.imageUrl} alt="Imagen enviada en la conversacion" className="mb-3 max-h-72 w-full rounded-[1rem] object-cover" />
                            </div>
                          ) : null}
                          {message.body ? <p className="whitespace-pre-wrap text-sm">{message.body}</p> : null}
                          <p className={`mt-2 text-[11px] ${isMine ? "text-white/70" : "text-[#8f857b]"}`}>
                            {new Date(message.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-[1.4rem] border border-dashed border-[#e8ddd2] bg-white px-4 py-5 text-center text-sm text-[#8f857b]">
                    Aun no hay mensajes. Escribe el primero.
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-[#eadfd6] bg-white px-4 py-3">
              {mediaDrafts[activeThread.requestId] ? (
                <div className="mb-3 flex items-center justify-between rounded-[1.2rem] border border-[#e8ddd2] bg-[#fffaf6] px-4 py-3">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mediaDrafts[activeThread.requestId]?.previewUrl} alt="Vista previa" className="h-12 w-12 rounded-xl object-cover" />
                    <div>
                      <p className="text-sm font-semibold text-[#131316]">Imagen lista para enviar</p>
                      <p className="text-xs text-[#8f857b]">{mediaDrafts[activeThread.requestId]?.file.name}</p>
                    </div>
                  </div>
                  <button type="button" className="text-sm font-semibold text-[#dc4f1f]" onClick={() => clearMediaDraft(activeThread.requestId)}>
                    Quitar
                  </button>
                </div>
              ) : null}

              <div className="flex items-end gap-3 rounded-[1.6rem] border border-[#e8ddd2] bg-[#f8f3ed] p-3">
                <button
                  type="button"
                  className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-full bg-white text-[#62564a]"
                  onClick={() => selectImage(activeThread.requestId)}
                >
                  <ImagePlus className="h-5 w-5" />
                </button>
                <textarea
                  className="min-h-11 flex-1 resize-none border-none bg-transparent text-sm text-[#131316] outline-none placeholder:text-[#8f857b]"
                  value={drafts[activeThread.requestId] || ""}
                  onChange={(event) => setDrafts((current) => ({ ...current, [activeThread.requestId]: event.target.value }))}
                  placeholder="Escribe un mensaje..."
                />
                <button
                  type="button"
                  className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#ff6b35] text-white shadow-[0_14px_32px_rgba(255,107,53,0.2)]"
                  onClick={() => sendMessage(activeThread.requestId)}
                  disabled={isPending && pendingId === activeThread.requestId}
                >
                  <SendHorizontal className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
    </>
  );
}
