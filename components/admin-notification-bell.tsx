"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, TriangleAlert } from "lucide-react";
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

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return "Ahora";
  if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  const diffDays = Math.round(diffHours / 24);
  return `Hace ${diffDays} d`;
}

export function AdminNotificationBell({ userId }: AdminNotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<AdminNotificationItem[]>([]);
  const [summary, setSummary] = useState<AdminNotificationSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [seenStamp, setSeenStamp] = useState<string>("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const announcedIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const seenStampRef = useRef("");
  const storageKey = `verifyzon-admin-notifications-seen:${userId}`;

  const unreadCount = useMemo(() => {
    if (!seenStamp) {
      return 0;
    }
    return items.filter((item) => new Date(item.createdAt).getTime() > new Date(seenStamp).getTime()).length;
  }, [items, seenStamp]);

  function rememberSeen(stamp: string) {
    seenStampRef.current = stamp;
    setSeenStamp(stamp);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, stamp);
    }
  }

  function markAllAsSeen() {
    if (!items.length) {
      return;
    }
    rememberSeen(items[0].createdAt);
  }

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
      window.location.href = item.href;
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
      setError("");

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
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las notificaciones.");
    } finally {
      setLoading(false);
    }
  }, [playNotificationSound, storageKey]);

  useEffect(() => {
    void loadNotifications();
    const interval = window.setInterval(() => {
      void loadNotifications();
    }, 20000);
    return () => window.clearInterval(interval);
  }, [loadNotifications]);

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

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-label="Abrir notificaciones admin"
        onClick={() => {
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
            void Notification.requestPermission();
          }
          setIsOpen((current) => !current);
          if (!isOpen) {
            markAllAsSeen();
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
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-[calc(100%+0.9rem)] z-20 w-[22rem] max-w-[calc(100vw-2rem)] rounded-[1.4rem] border border-[#e5e5df] bg-white p-3 text-[#131316] shadow-[0_18px_36px_rgba(22,18,14,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[#131316]">Notificaciones</p>
              <p className="text-xs text-[#62626d]">Cambios y alertas del panel admin.</p>
            </div>
            <button type="button" className="text-xs font-semibold text-[#dc4f1f]" onClick={markAllAsSeen}>
              Marcar vistas
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <SummaryChip label="Soporte" value={summary.openSupport} />
            <SummaryChip label="Reportes" value={summary.reviewReports} />
            <SummaryChip label="Duplicados" value={summary.duplicateGroups} />
            <SummaryChip label="Bajas" value={summary.openRemovalRequests} />
            <SummaryChip label="Cobros fallidos" value={summary.failedPayments} />
            <SummaryChip label="Webhook errors" value={summary.webhookErrors} tone="warn" />
          </div>

          {error ? (
            <div className="mt-3 rounded-[1rem] border border-[#f0d3c7] bg-[#fff6f2] px-3 py-2 text-xs font-semibold text-[#c64b1e]">
              {error}
            </div>
          ) : null}

          <div className="mt-3 max-h-[24rem] space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <div className="rounded-[1rem] border border-[#eadfd6] bg-[#fcfaf7] px-3 py-4 text-sm text-[#62564a]">Cargando notificaciones...</div>
            ) : items.length ? (
              items.map((item) => {
                const isUnread = !seenStamp || new Date(item.createdAt).getTime() > new Date(seenStamp).getTime();
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => {
                      setIsOpen(false);
                      markAllAsSeen();
                    }}
                    className={`block rounded-[1rem] border px-3 py-3 transition ${
                      isUnread ? "border-[#ffd4c5] bg-[#fff7f2]" : "border-[#eadfd6] bg-[#fcfaf7]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#131316]">{item.title}</p>
                        <p className="mt-1 text-xs text-[#62564a]">{item.body}</p>
                      </div>
                      {isUnread ? <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#ff6b35]" /> : null}
                    </div>
                    <p className="mt-2 text-[11px] text-[#8f857b]">{formatRelativeTime(item.createdAt)}</p>
                  </Link>
                );
              })
            ) : (
              <div className="rounded-[1rem] border border-dashed border-[#eadfd6] bg-[#fffaf5] px-3 py-4 text-sm text-[#62564a]">
                Todavia no hay notificaciones del admin.
              </div>
            )}
          </div>

          <div className="mt-3 rounded-[1rem] border border-[#eadfd6] bg-[#fcfaf7] px-3 py-2 text-[11px] text-[#62564a]">
            Son utiles aqui tambien: KYC en revision, fallos de pago y errores de webhook. Ya los incluimos como alertas operativas.
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryChip({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "warn" }) {
  return (
    <div
      className={`rounded-[1rem] border px-3 py-2 ${
        tone === "warn" ? "border-[#f0d3c7] bg-[#fff6f2]" : "border-[#eadfd6] bg-[#fcfaf7]"
      }`}
    >
      <p className="text-[11px] uppercase tracking-[0.14em] text-[#8f857b]">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        {tone === "warn" ? <TriangleAlert className="h-3.5 w-3.5 text-[#dc4f1f]" /> : null}
        <span className="text-sm font-bold text-[#131316]">{value}</span>
      </div>
    </div>
  );
}
