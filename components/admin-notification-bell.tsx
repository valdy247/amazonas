"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell } from "lucide-react";
import type { AdminNotificationItem, AdminNotificationSummary } from "@/lib/admin-notifications";

type AdminNotificationBellProps = {
  userId: string;
};

type NotificationResponse = {
  items?: AdminNotificationItem[];
  summary?: AdminNotificationSummary;
  error?: string;
};

const EMPTY_SUMMARY: AdminNotificationSummary = {
  openSupport: 0,
  openRemovalRequests: 0,
  reviewReports: 0,
  duplicateGroups: 0,
  failedPayments: 0,
  webhookErrors: 0,
};

export function AdminNotificationBell({ userId }: AdminNotificationBellProps) {
  const [items, setItems] = useState<AdminNotificationItem[]>([]);
  const [, setSummary] = useState<AdminNotificationSummary>(EMPTY_SUMMARY);
  const [seenStamp, setSeenStamp] = useState<string>("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const announcedIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const seenStampRef = useRef("");
  const storageKey = `verifyzon-admin-notifications-seen:${userId}`;

  const unreadCount = useMemo(() => {
    if (!seenStamp) {
      return items.length;
    }
    return items.filter((item) => new Date(item.createdAt).getTime() > new Date(seenStamp).getTime()).length;
  }, [items, seenStamp]);

  const playNotificationSound = useMemo(
    () => () => {
      if (typeof window === "undefined") {
        return;
      }

      let context = audioContextRef.current;
      if (!context) {
        const ContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!ContextConstructor) {
          return;
        }
        context = new ContextConstructor();
        audioContextRef.current = context;
      }

      if (context.state === "suspended") {
        void context.resume();
      }

      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(680, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(980, context.currentTime + 0.18);
      gainNode.gain.setValueAtTime(0.0001, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.05, context.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.36);
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.38);
    },
    []
  );

  async function notifyBrowser(item: AdminNotificationItem) {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    if (Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        return;
      }
    }

    if (Notification.permission !== "granted") {
      return;
    }

    const notification = new Notification(item.title, {
      body: item.body,
      tag: item.id,
    });

    notification.onclick = () => {
      window.focus();
      window.location.href = "/admin/notifications";
    };
  }

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/notifications", { cache: "no-store" });
      const data = (await response.json()) as NotificationResponse;
      if (!response.ok) {
        throw new Error(data.error || "No se pudieron cargar las notificaciones.");
      }

      const nextItems = data.items || [];
      setItems(nextItems);
      setSummary(data.summary || EMPTY_SUMMARY);

      const newestStamp = nextItems[0]?.createdAt || "";
      if (!initializedRef.current) {
        initializedRef.current = true;
        const storedSeen = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) || "" : "";
        const initialSeen = storedSeen || newestStamp;
        seenStampRef.current = initialSeen;
        setSeenStamp(initialSeen);
        if (typeof window !== "undefined" && !storedSeen && newestStamp) {
          window.localStorage.setItem(storageKey, newestStamp);
        }
        nextItems.forEach((item) => announcedIdsRef.current.add(item.id));
        return;
      }

      const freshItems = nextItems.filter(
        (item) =>
          !announcedIdsRef.current.has(item.id) &&
          (!seenStampRef.current || new Date(item.createdAt).getTime() > new Date(seenStampRef.current).getTime())
      );

      if (freshItems.length) {
        playNotificationSound();
        for (const item of freshItems.slice(0, 3)) {
          void notifyBrowser(item);
        }
      }

      nextItems.forEach((item) => announcedIdsRef.current.add(item.id));
    } catch {
      // Silent fail in header icon.
    }
  }, [playNotificationSound, storageKey]);

  useEffect(() => {
    void loadNotifications();
    const interval = window.setInterval(() => {
      void loadNotifications();
    }, 20000);
    return () => window.clearInterval(interval);
  }, [loadNotifications]);

  return (
    <Link
      href="/admin/notifications"
      aria-label="Abrir inbox admin"
      onClick={() => {
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
          void Notification.requestPermission();
        }
        if (items[0]?.createdAt) {
          seenStampRef.current = items[0].createdAt;
          setSeenStamp(items[0].createdAt);
          window.localStorage.setItem(storageKey, items[0].createdAt);
        }
      }}
      className="relative inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#e5e5df] bg-white text-[#131316] shadow-sm transition hover:bg-[#fff3ec]"
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[#ff6b35] px-1.5 py-0.5 text-[10px] font-bold text-white">
          {Math.min(unreadCount, 99)}
        </span>
      ) : null}
    </Link>
  );
}
