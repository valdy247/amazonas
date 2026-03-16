"use client";

import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, CheckCheck, EllipsisVertical, ImagePlus, MessageCircleMore, SendHorizontal, Star, Trash2, X } from "lucide-react";
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
  requestData?: Record<string, unknown> | null;
  requestMeta?: {
    category: string;
    productName: string;
    note: string;
  };
  messages: ConversationMessage[];
  lastActivityAt: string;
};

type CollaborationInboxProps = {
  currentUserId: string;
  currentUserRole: "provider" | "reviewer";
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  threads: ConversationThread[];
  initialThreadId?: number | null;
  categorySuggestions?: string[];
  quickReplies?: string[];
};

type DraftMedia = {
  file: File;
  previewUrl: string;
};

function getSeenMessageIdForRole(requestData: Record<string, unknown> | null | undefined, role: "provider" | "reviewer") {
  if (!requestData) {
    return 0;
  }

  const key = role === "provider" ? "providerLastSeenMessageId" : "reviewerLastSeenMessageId";
  const value = requestData[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function setSeenMessageIdForRole(requestData: Record<string, unknown> | null | undefined, role: "provider" | "reviewer", seenMessageId: number) {
  return {
    ...(requestData || {}),
    [role === "provider" ? "providerLastSeenMessageId" : "reviewerLastSeenMessageId"]: seenMessageId,
  };
}

function getLastIncomingMessageIdForThread(thread: ConversationThread, currentUserId: string) {
  const lastIncoming = [...thread.messages].reverse().find((message) => message.senderId !== currentUserId);
  return lastIncoming?.id ?? null;
}

function getThreadPreferenceKey(role: "provider" | "reviewer", key: "favorite" | "hidden") {
  return `${role}${key === "favorite" ? "Favorite" : "Hidden"}`;
}

function getThreadPreference(requestData: Record<string, unknown> | null | undefined, role: "provider" | "reviewer", key: "favorite" | "hidden") {
  if (!requestData) {
    return false;
  }

  return requestData[getThreadPreferenceKey(role, key)] === true;
}

function setThreadPreference(
  requestData: Record<string, unknown> | null | undefined,
  role: "provider" | "reviewer",
  key: "favorite" | "hidden",
  value: boolean
) {
  return {
    ...(requestData || {}),
    [getThreadPreferenceKey(role, key)]: value,
  };
}

export function CollaborationInbox({
  currentUserId,
  currentUserRole,
  title,
  description,
  emptyTitle,
  emptyDescription,
  threads,
  initialThreadId = null,
  categorySuggestions = [],
  quickReplies = [],
}: CollaborationInboxProps) {
  const [supabase] = useState(() => createClient());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState(threads);
  const [activeThreadId, setActiveThreadId] = useState<number | null>(initialThreadId);
  const [seenMessageIds, setSeenMessageIds] = useState<Record<number, number>>(() =>
    Object.fromEntries(threads.map((thread) => [thread.requestId, getSeenMessageIdForRole(thread.requestData, currentUserRole)]))
  );
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [metaDrafts, setMetaDrafts] = useState<Record<number, { category: string; productName: string }>>(
    Object.fromEntries(
      threads.map((thread) => [
        thread.requestId,
        {
          category: thread.requestMeta?.category || categorySuggestions[0] || "",
          productName: thread.requestMeta?.productName || "",
        },
      ])
    )
  );
  const [mediaDrafts, setMediaDrafts] = useState<Record<number, DraftMedia | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [menuThreadId, setMenuThreadId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement | null>(null);

  const sortedThreads = useMemo(
    () =>
      [...items]
        .filter((thread) => !getThreadPreference(thread.requestData, currentUserRole, "hidden"))
        .sort((left, right) => {
          const favoriteDiff =
            Number(getThreadPreference(right.requestData, currentUserRole, "favorite")) -
            Number(getThreadPreference(left.requestData, currentUserRole, "favorite"));
          if (favoriteDiff !== 0) {
            return favoriteDiff;
          }

          return (
          new Date(right.lastActivityAt).getTime() - new Date(left.lastActivityAt).getTime() ||
          left.counterpartName.localeCompare(right.counterpartName)
          );
        }),
    [currentUserRole, items]
  );

  const activeThread = sortedThreads.find((thread) => thread.requestId === activeThreadId) || null;
  const currentUserHasSentMessage = Boolean(
    activeThread && activeThread.messages.some((message) => message.senderId === currentUserId)
  );
  const providerHasSentMessage = Boolean(
    activeThread && activeThread.messages.some((message) => message.senderId === currentUserId)
  );

  useEffect(() => {
    if (!activeThread) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
    };
  }, [activeThread]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuThreadId(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  const markThreadAsSeen = useCallback(async (threadId: number, explicitSeenMessageId?: number) => {
    const thread = items.find((item) => item.requestId === threadId);
    if (!thread) {
      return;
    }

    const lastIncomingMessageId = explicitSeenMessageId || getLastIncomingMessageIdForThread(thread, currentUserId);
    if (!lastIncomingMessageId || (seenMessageIds[threadId] || 0) >= lastIncomingMessageId) {
      return;
    }

    const nextRequestData = setSeenMessageIdForRole(thread.requestData, currentUserRole, lastIncomingMessageId);

    setSeenMessageIds((current) => ({
      ...current,
      [threadId]: lastIncomingMessageId,
    }));

    setItems((current) =>
      current.map((item) =>
        item.requestId === threadId
          ? {
              ...item,
              requestData: nextRequestData,
            }
          : item
      )
    );

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("chat-seen-updated", {
          detail: {
            userId: currentUserId,
            threadId,
            seenMessageId: lastIncomingMessageId,
          },
        })
      );
    }

    await supabase.from("reviewer_contact_requests").update({ request_data: nextRequestData }).eq("id", threadId);
  }, [currentUserId, currentUserRole, items, seenMessageIds, supabase]);

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

          if (String(message.sender_id) !== currentUserId && activeThreadId === Number(message.request_id)) {
            void markThreadAsSeen(Number(message.request_id), Number(message.id));
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeThreadId, currentUserId, markThreadAsSeen, supabase]);

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
    void markThreadAsSeen(threadId);
  }

  function closeChat() {
    setActiveThreadId(null);
  }

  async function updateThreadRequestData(threadId: number, updater: (current: Record<string, unknown> | null | undefined) => Record<string, unknown>) {
    const thread = items.find((item) => item.requestId === threadId);
    if (!thread) {
      return;
    }

    const nextRequestData = updater(thread.requestData);
    setItems((current) =>
      current.map((item) =>
        item.requestId === threadId
          ? {
              ...item,
              requestData: nextRequestData,
            }
          : item
      )
    );
    await supabase.from("reviewer_contact_requests").update({ request_data: nextRequestData }).eq("id", threadId);
  }

  async function toggleFavorite(threadId: number) {
    setMenuThreadId(null);
    await updateThreadRequestData(threadId, (current) =>
      setThreadPreference(current, currentUserRole, "favorite", !getThreadPreference(current, currentUserRole, "favorite"))
    );
  }

  async function hideThread(threadId: number) {
    setMenuThreadId(null);
    if (activeThreadId === threadId) {
      closeChat();
    }
    await updateThreadRequestData(threadId, (current) => setThreadPreference(current, currentUserRole, "hidden", true));
  }

  async function markAsReadFromMenu(threadId: number) {
    setMenuThreadId(null);
    await markThreadAsSeen(threadId);
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
    const filePath = `${requestId}/${currentUserId}-${file.lastModified}-${safeName}`;
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

  function sendQuickReply(requestId: number, message: string) {
    setDrafts((current) => ({ ...current, [requestId]: message }));
    setError(null);
    window.requestAnimationFrame(() => {
      sendMessage(requestId, message);
    });
  }

  function updateMetaDraft(requestId: number, patch: Partial<{ category: string; productName: string }>) {
    setMetaDrafts((current) => ({
      ...current,
      [requestId]: {
        category: current[requestId]?.category || categorySuggestions[0] || "",
        productName: current[requestId]?.productName || "",
        ...patch,
      },
    }));
  }

  function sendMessage(requestId: number, directBody?: string) {
    const draft = (directBody ?? drafts[requestId] ?? "").trim();
    const mediaDraft = mediaDrafts[requestId];
    const metaDraft = metaDrafts[requestId];
    const activeThreadData = items.find((thread) => thread.requestId === requestId)?.requestData;
    const shouldAttachProviderIntro =
      currentUserRole === "provider" &&
      !(activeThreadData && (activeThreadData as { introSent?: unknown }).introSent === true) &&
      Boolean(metaDraft?.category?.trim() || metaDraft?.productName?.trim());
    const providerIntro =
      shouldAttachProviderIntro
        ? [
            metaDraft?.category?.trim() ? `Categoria: ${metaDraft.category.trim()}` : null,
            metaDraft?.productName?.trim() ? `Producto: ${metaDraft.productName.trim()}` : null,
          ]
            .filter(Boolean)
            .join("\n")
        : "";
    const finalBody = [providerIntro, draft].filter(Boolean).join(providerIntro && draft ? "\n\n" : "");

    if (!finalBody && !mediaDraft) {
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
            body: finalBody,
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
        const nextRequestData =
          currentUserRole === "provider"
            ? {
                ...(activeThreadData || {}),
                category: metaDraft?.category || "",
                productName: metaDraft?.productName || "",
                introSent: shouldAttachProviderIntro || (activeThreadData && (activeThreadData as { introSent?: unknown }).introSent === true) || false,
              }
            : (activeThreadData || {});
        await supabase
          .from("reviewer_contact_requests")
          .update({
            updated_at: timestamp,
            last_activity_at: timestamp,
            request_data: nextRequestData,
          })
          .eq("id", requestId);

        setItems((current) =>
          current.map((thread) =>
            thread.requestId === requestId
              ? {
                  ...thread,
                  lastActivityAt: timestamp,
                  requestData: nextRequestData,
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
        if (currentUserRole === "provider") {
          setMetaDrafts((current) => ({
            ...current,
            [requestId]: {
              category: current[requestId]?.category || "",
              productName: "",
            },
          }));
        }
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
            const lastIncomingMessageId = getLastIncomingMessageIdForThread(thread, currentUserId);
            const isFavorite = getThreadPreference(thread.requestData, currentUserRole, "favorite");
            const isUnread = Boolean(
              lastIncomingMessageId &&
                thread.messages.some((message) => message.id === lastIncomingMessageId && message.senderId !== currentUserId) &&
                (seenMessageIds[thread.requestId] || 0) < lastIncomingMessageId
            );

            return (
              <div key={thread.requestId} className="relative flex items-center gap-3 px-5 py-4 transition hover:bg-[#fff9f5]">
                <button type="button" onClick={() => openChat(thread.requestId)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="inline-flex h-12 w-12 flex-none items-center justify-center rounded-full bg-[linear-gradient(135deg,#ff8a5b_0%,#ff6b35_100%)] text-base font-bold text-white">
                    {thread.counterpartName.charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 truncate text-base font-semibold text-[#131316]">
                        <span className="truncate">{thread.counterpartName}</span>
                        {isFavorite ? <Star className="h-4 w-4 fill-[#ffb54c] text-[#ffb54c]" /> : null}
                      </span>
                      <span className="text-xs text-[#8f857b]">{new Date(thread.lastActivityAt).toLocaleDateString()}</span>
                    </span>
                    <span className="mt-1 flex items-center gap-2">
                      {isUnread ? <span className="h-2.5 w-2.5 rounded-full bg-[#ff3b30]" /> : null}
                      <span className="truncate text-sm text-[#62626d]">{preview}</span>
                    </span>
                  </span>
                </button>

                <div ref={menuThreadId === thread.requestId ? menuRef : null} className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuThreadId((current) => (current === thread.requestId ? null : thread.requestId))}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#8f857b] transition hover:bg-[#fff0e8] hover:text-[#131316]"
                    aria-label="Opciones del chat"
                  >
                    <EllipsisVertical className="h-5 w-5" />
                  </button>

                  {menuThreadId === thread.requestId ? (
                    <div className="absolute right-0 top-[calc(100%+0.35rem)] z-20 w-48 rounded-[1.1rem] border border-[#eadfd6] bg-white p-2 shadow-[0_18px_36px_rgba(22,18,14,0.12)]">
                      <button
                        type="button"
                        onClick={() => void toggleFavorite(thread.requestId)}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-[#131316] hover:bg-[#fff3ec]"
                      >
                        <Star className={`h-4 w-4 ${isFavorite ? "fill-[#ffb54c] text-[#ffb54c]" : "text-[#8f857b]"}`} />
                        <span>{isFavorite ? "Quitar favorito" : "Marcar favorito"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void markAsReadFromMenu(thread.requestId)}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-[#131316] hover:bg-[#fff3ec]"
                      >
                        <CheckCheck className="h-4 w-4 text-[#8f857b]" />
                        <span>Marcar como leido</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void hideThread(thread.requestId)}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-[#131316] hover:bg-[#fff3ec]"
                      >
                        <Trash2 className="h-4 w-4 text-[#d45b3d]" />
                        <span>Eliminar chat</span>
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {activeThread ? (
        <div className="fixed inset-0 z-40 overflow-hidden bg-[#17120d]/35 backdrop-blur-sm [overscroll-behavior:none]">
          <div className="flex h-screen min-h-screen w-screen flex-col bg-[#f8f3ed] supports-[height:100dvh]:h-[100dvh] supports-[height:100dvh]:min-h-[100dvh]">
            <div className="mx-auto flex h-full w-full max-w-[430px] flex-col overflow-hidden bg-[#f8f3ed]">
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

            <div className="border-t border-[#eadfd6] bg-white px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              {currentUserRole === "provider" && !providerHasSentMessage ? (
                <div className="mb-3 rounded-[1.3rem] border border-[#efe4d9] bg-[#fff8f3] p-3">
                  <p className="text-sm font-semibold text-[#131316]">Prepara tu mensaje</p>
                  <p className="mt-1 text-sm text-[#7b6e63]">Selecciona la categoria y anade el producto. Si quieres, luego adjunta una foto y escribe tu mensaje.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {categorySuggestions.map((category) => (
                      <button
                        key={`${activeThread.requestId}-${category}`}
                        type="button"
                        className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                          metaDrafts[activeThread.requestId]?.category === category
                            ? "bg-[#ff6b35] text-white"
                            : "border border-[#eadfd6] bg-white text-[#62564a]"
                        }`}
                        onClick={() => updateMetaDraft(activeThread.requestId, { category })}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                  <input
                    className="input mt-3"
                    value={metaDrafts[activeThread.requestId]?.productName || ""}
                    onChange={(event) => updateMetaDraft(activeThread.requestId, { productName: event.target.value })}
                    placeholder="Nombre del producto o servicio"
                  />
                </div>
              ) : null}

              {quickReplies.length && !currentUserHasSentMessage ? (
                <div className="mb-3 flex flex-wrap gap-2">
                  {quickReplies.map((reply) => (
                    <button
                      key={`${activeThread.requestId}-${reply}`}
                      type="button"
                      className="rounded-full border border-[#efd8cb] bg-[#fff7f2] px-3 py-2 text-left text-xs font-semibold text-[#c4562a] transition hover:border-[#ffb596] hover:bg-[#fff0e8]"
                      onClick={() => sendQuickReply(activeThread.requestId, reply)}
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              ) : null}

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
        </div>
      ) : null}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
    </>
  );
}
