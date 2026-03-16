"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { User } from "@supabase/supabase-js";
import { LockKeyhole, Menu, MessageCircleMore, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { normalizeLanguage, navigationCopy, type AppLanguage } from "@/lib/i18n";

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
  unreadThreads?: Array<{ threadId: number; lastIncomingMessageId: number; lastSeenMessageId: number }>;
  language?: AppLanguage;
};

export function AccountMenu({ user, items, messageHref, hasUnreadMessages = false, unreadThreads = [], language }: AccountMenuProps) {
  const [supabase] = useState(() => createClient());
  const [isOpen, setIsOpen] = useState(false);
  const [seenOverrides, setSeenOverrides] = useState<Record<number, number>>({});
  const [liveIncomingMap, setLiveIncomingMap] = useState<Record<number, number>>({});
  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastAlertedMessageIdRef = useRef<Record<number, number>>({});
  const userId = user?.id || null;
  const baseSeenMap = useMemo<Record<number, number>>(
    () => Object.fromEntries(unreadThreads.map((thread) => [thread.threadId, thread.lastSeenMessageId || 0])) as Record<number, number>,
    [unreadThreads]
  );
  const seenMap = useMemo<Record<number, number>>(() => ({ ...baseSeenMap, ...seenOverrides }), [baseSeenMap, seenOverrides]);
  const threadIds = useMemo(() => unreadThreads.map((thread) => thread.threadId), [unreadThreads]);
  const currentLanguage = normalizeLanguage(language);
  const nav = navigationCopy[currentLanguage];
  const resolvedItems =
    items ||
    (user
      ? [
          { href: "/dashboard", label: nav.goToDashboard },
          { href: "/profile", label: nav.editProfile },
        ]
      : [
          { href: "/auth?mode=signup", label: nav.createAccount },
          { href: "/auth?mode=signin", label: nav.signIn },
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
      const latestIncomingId = Math.max(thread.lastIncomingMessageId, liveIncomingMap[thread.threadId] || 0);
      if (!latestIncomingId) {
        return false;
      }
      return (seenMap[thread.threadId] || 0) < latestIncomingId;
    });
  }, [hasUnreadMessages, liveIncomingMap, seenMap, unreadThreads, user]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function unlockAudio() {
      if (audioContextRef.current) {
        return;
      }

      const ContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!ContextConstructor) {
        return;
      }

      const context = new ContextConstructor();
      audioContextRef.current = context;
      if (context.state === "suspended") {
        void context.resume();
      }
    }

    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

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
    if (!userId || typeof window === "undefined") {
      return;
    }

    function handleSeenUpdate(event: Event) {
      const customEvent = event as CustomEvent<{ userId?: string; threadId?: number; seenMessageId?: number }>;
      if (customEvent.detail?.userId !== userId || !customEvent.detail?.threadId || !customEvent.detail?.seenMessageId) {
        return;
      }

      setSeenOverrides((current) => ({
        ...current,
        [customEvent.detail.threadId as number]: customEvent.detail.seenMessageId as number,
      }));
    }

    window.addEventListener("chat-seen-updated", handleSeenUpdate as EventListener);

    return () => {
      window.removeEventListener("chat-seen-updated", handleSeenUpdate as EventListener);
    };
  }, [userId]);

  const playIncomingMessageSound = useMemo(
    () => () => {
      let context = audioContextRef.current;
      if (!context && typeof window !== "undefined") {
        const ContextConstructor =
          window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (ContextConstructor) {
          context = new ContextConstructor();
          audioContextRef.current = context;
        }
      }

      if (!context) {
        return;
      }

      if (context.state === "suspended") {
        void context.resume();
      }

      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(740, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(920, context.currentTime + 0.12);
      gainNode.gain.setValueAtTime(0.0001, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.05, context.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.28);
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.3);
    },
    []
  );

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    function handleServiceWorkerMessage(event: MessageEvent<{ type?: string }>) {
      if (event.data?.type === "push-message") {
        playIncomingMessageSound();
      }
    }

    navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", handleServiceWorkerMessage);
    };
  }, [playIncomingMessageSound]);

  useEffect(() => {
    if (!userId || !threadIds.length) {
      return;
    }

    const channel = supabase
      .channel(`header-unread-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "request_messages" },
        (payload) => {
          const message = payload.new as {
            id: number;
            request_id: number;
            sender_id: string;
          };

          if (String(message.sender_id) === userId || !threadIds.includes(Number(message.request_id))) {
            return;
          }

          const threadId = Number(message.request_id);
          const messageId = Number(message.id);
          if ((lastAlertedMessageIdRef.current[threadId] || 0) >= messageId) {
            return;
          }
          lastAlertedMessageIdRef.current[threadId] = messageId;

          setLiveIncomingMap((current) => ({
            ...current,
            [threadId]: messageId,
          }));

          playIncomingMessageSound();

          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            const notification = new Notification(nav.newMessageTitle, {
              body: nav.newMessageBody,
              tag: `chat-${threadId}`,
            });

            notification.onclick = () => {
              window.focus();
              if (messageHref) {
                window.location.href = messageHref;
              }
            };
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [messageHref, nav.newMessageBody, nav.newMessageTitle, playIncomingMessageSound, supabase, threadIds, userId]);

  return (
    <div ref={containerRef} className="relative flex items-center gap-2">
      {user && messageHref ? (
        <Link
          href={messageHref}
          aria-label={nav.openMessages}
          className="relative inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#e5e5df] bg-white text-[#131316] shadow-sm transition hover:bg-[#fff3ec]"
        >
          <MessageCircleMore className="h-5 w-5" />
          {resolvedHasUnreadMessages ? <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#ff3b30]" /> : null}
        </Link>
      ) : null}

      <button
        type="button"
        aria-expanded={isOpen}
        aria-label={isOpen ? nav.closeMenu : nav.openMenu}
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
                  {nav.signOut}
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
