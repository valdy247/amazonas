"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { User } from "@supabase/supabase-js";
import { LockKeyhole, Menu, MessageCircleMore, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type AccountMenuItem = {
  href: string;
  label: string;
  locked?: boolean;
};

type AccountMenuProps = {
  user: User | null;
  items?: AccountMenuItem[];
  messageHref?: string;
  hasUnreadMessages?: boolean;
  unreadThreads?: Array<{ threadId: number; lastIncomingMessageId: number }>;
};

export function AccountMenu({ user, items, messageHref, hasUnreadMessages = false, unreadThreads = [] }: AccountMenuProps) {
  const [supabase] = useState(() => createClient());
  const [isOpen, setIsOpen] = useState(false);
  const [storedSeenMap, setStoredSeenMap] = useState<Record<number, number>>(() => {
    if (!user || typeof window === "undefined") {
      return {};
    }

    try {
      const raw = window.localStorage.getItem(`chat-seen:${user.id}`);
      if (!raw) {
        return {};
      }

      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(parsed)
          .map(([key, value]) => [Number(key), Number(value)])
          .filter(([key, value]) => Number.isFinite(key) && Number.isFinite(value))
      );
    } catch {
      return {};
    }
  });
  const [liveIncomingMap, setLiveIncomingMap] = useState<Record<number, number>>({});
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resolvedItems =
    items ||
    (user
      ? [
          { href: "/dashboard", label: "Ir al panel" },
          { href: "/profile", label: "Editar perfil" },
        ]
      : [
          { href: "/auth?mode=signup", label: "Crear cuenta" },
          { href: "/auth?mode=signin", label: "Iniciar sesion" },
        ]);
  const resolvedHasUnreadMessages = useMemo(() => {
    if (!user) {
      return hasUnreadMessages;
    }

    const eligibleThreads = unreadThreads.filter((thread) => thread.lastIncomingMessageId > 0 || (liveIncomingMap[thread.threadId] || 0) > 0);
    if (!eligibleThreads.length) {
      return false;
    }

    return eligibleThreads.some((thread) => {
      if (!thread.lastIncomingMessageId) {
        return (liveIncomingMap[thread.threadId] || 0) > 0;
      }
      const latestIncomingId = Math.max(thread.lastIncomingMessageId, liveIncomingMap[thread.threadId] || 0);
      return storedSeenMap[thread.threadId] !== latestIncomingId;
    });
  }, [hasUnreadMessages, liveIncomingMap, storedSeenMap, unreadThreads, user]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!user || typeof window === "undefined") {
      return;
    }

    const storageKey = `chat-seen:${user.id}`;

    function readSeenState() {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) {
          setStoredSeenMap({});
          return;
        }

        const parsed = JSON.parse(raw) as Record<string, unknown>;
        setStoredSeenMap(
          Object.fromEntries(
            Object.entries(parsed)
              .map(([key, value]) => [Number(key), Number(value)])
              .filter(([key, value]) => Number.isFinite(key) && Number.isFinite(value))
          )
        );
      } catch {
        setStoredSeenMap({});
      }
    }

    readSeenState();
    window.addEventListener("storage", readSeenState);
    window.addEventListener("focus", readSeenState);
    window.addEventListener("chat-seen-updated", readSeenState as EventListener);

    return () => {
      window.removeEventListener("storage", readSeenState);
      window.removeEventListener("focus", readSeenState);
      window.removeEventListener("chat-seen-updated", readSeenState as EventListener);
    };
  }, [user]);

  useEffect(() => {
    const eligibleThreads = unreadThreads.filter((thread) => thread.lastIncomingMessageId > 0);

    if (!user || !eligibleThreads.length) {
      return;
    }

    const threadIds = eligibleThreads.map((thread) => thread.threadId);
    const channel = supabase
      .channel(`header-unread-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "request_messages" },
        (payload) => {
          const message = payload.new as {
            id: number;
            request_id: number;
            sender_id: string;
          };

          if (String(message.sender_id) === user.id || !threadIds.includes(Number(message.request_id))) {
            return;
          }

          setLiveIncomingMap((current) => ({
            ...current,
            [Number(message.request_id)]: Number(message.id),
          }));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, unreadThreads, user]);

  return (
    <div ref={containerRef} className="relative flex items-center gap-2">
      {user && messageHref ? (
        <Link
          href={messageHref}
          aria-label="Abrir mensajes"
          className="relative inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#e5e5df] bg-white text-[#131316] shadow-sm transition hover:bg-[#fff3ec]"
        >
          <MessageCircleMore className="h-5 w-5" />
          {resolvedHasUnreadMessages ? <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#ff3b30]" /> : null}
        </Link>
      ) : null}

      <button
        type="button"
        aria-expanded={isOpen}
        aria-label={isOpen ? "Cerrar menu" : "Abrir menu"}
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#e5e5df] bg-white text-[#131316] shadow-sm transition hover:bg-[#fff3ec]"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-[calc(100%+0.9rem)] z-20 w-72 rounded-[1.4rem] border border-[#e5e5df] bg-white p-2 shadow-[0_18px_36px_rgba(22,18,14,0.08)]">
          {user ? (
            <>
              <p className="px-3 py-2 text-xs text-[#62626d]">{user.email}</p>
              {resolvedItems.map((item) => (
                <Link
                  key={`${item.href}-${item.label}`}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-3 text-sm hover:bg-[#fff3ec]"
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                >
                  <span>{item.label}</span>
                  {item.locked ? <LockKeyhole className="h-4 w-4 text-[#8b7a6d]" /> : null}
                </Link>
              ))}
              <form action="/auth/signout" method="post">
                <button className="mt-1 w-full rounded-xl px-3 py-3 text-left text-sm hover:bg-[#fff3ec]" type="submit">
                  Cerrar sesion
                </button>
              </form>
            </>
          ) : (
            <>
              {resolvedItems.map((item) => (
                <Link
                  key={`${item.href}-${item.label}`}
                  className="block rounded-xl px-3 py-3 text-sm hover:bg-[#fff3ec]"
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
