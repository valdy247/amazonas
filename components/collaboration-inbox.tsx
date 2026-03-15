"use client";

import { type ChangeEvent, useMemo, useRef, useState, useTransition } from "react";
import { ImagePlus, MessageCircleMore, SendHorizontal } from "lucide-react";
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
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState(threads);
  const [activeThreadId, setActiveThreadId] = useState<number | null>(threads[0]?.requestId ?? null);
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

  const activeThread = sortedThreads.find((thread) => thread.requestId === activeThreadId) || sortedThreads[0] || null;

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
                  messages: [
                    ...thread.messages,
                    {
                      id: data.id as number,
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
        setMediaDrafts((current) => ({ ...current, [requestId]: undefined }));
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

      <div className="grid min-h-[28rem] gap-0 md:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="border-r border-[#efe5db] bg-[#fffaf6]">
          <div className="space-y-2 p-3">
            {sortedThreads.map((thread) => {
              const isActive = activeThread?.requestId === thread.requestId;
              const lastMessage = thread.messages[thread.messages.length - 1];
              const lastPreview = lastMessage?.body || (lastMessage?.imageUrl ? "Imagen enviada" : "Sin mensajes");

              return (
                <button
                  key={thread.requestId}
                  type="button"
                  onClick={() => setActiveThreadId(thread.requestId)}
                  className={`w-full rounded-[1.35rem] px-4 py-4 text-left transition ${
                    isActive ? "bg-white shadow-sm ring-1 ring-[#ffd7c8]" : "bg-transparent hover:bg-white/70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#131316]">{thread.counterpartName}</p>
                      <p className="mt-1 text-xs text-[#8f857b]">{thread.counterpartCountry || "Sin pais"}</p>
                    </div>
                    <span className="rounded-full bg-[#fff3ec] px-3 py-1 text-[11px] font-semibold text-[#dc4f1f]">
                      {new Date(thread.lastActivityAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-[#62626d]">{lastPreview}</p>
                </button>
              );
            })}
          </div>
        </aside>

        {activeThread ? (
          <div className="flex min-h-[28rem] flex-col">
            <div className="border-b border-[#efe5db] px-5 py-4">
              <p className="font-semibold text-[#131316]">{activeThread.counterpartName}</p>
              <p className="mt-1 text-sm text-[#62626d]">{activeThread.counterpartCountry || "Sin pais"}</p>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {activeThread.messages.map((message) => {
                const isMine = message.senderId === currentUserId;

                return (
                  <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-[1.4rem] px-4 py-3 ${
                        isMine ? "bg-[#ff6b35] text-white" : "border border-[#ece3d9] bg-[#fffdfa] text-[#62564a]"
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
              })}
            </div>

            <div className="border-t border-[#efe5db] px-5 py-4">
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
                  <button
                    type="button"
                    className="text-sm font-semibold text-[#dc4f1f]"
                    onClick={() => setMediaDrafts((current) => ({ ...current, [activeThread.requestId]: undefined }))}
                  >
                    Quitar
                  </button>
                </div>
              ) : null}

              <div className="rounded-[1.5rem] border border-[#e8ddd2] bg-[#fffdfa] p-3">
                <textarea
                  className="min-h-24 w-full resize-none border-none bg-transparent text-sm text-[#131316] outline-none placeholder:text-[#8f857b]"
                  value={drafts[activeThread.requestId] || ""}
                  onChange={(event) => setDrafts((current) => ({ ...current, [activeThread.requestId]: event.target.value }))}
                  placeholder="Escribe tu mensaje..."
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#e8ddd2] bg-white text-[#62564a]"
                    onClick={() => selectImage(activeThread.requestId)}
                  >
                    <ImagePlus className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full bg-[#ff6b35] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_32px_rgba(255,107,53,0.2)]"
                    onClick={() => sendMessage(activeThread.requestId)}
                    disabled={isPending && pendingId === activeThread.requestId}
                  >
                    <SendHorizontal className="h-4 w-4" />
                    {isPending && pendingId === activeThread.requestId ? "Enviando..." : "Enviar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {error ? <p className="px-5 pb-5 text-sm font-semibold text-red-600">{error}</p> : null}
    </section>
  );
}
