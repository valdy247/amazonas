"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bell, CircleHelp, LifeBuoy, MessageSquareText } from "lucide-react";
import type { AdminNotificationItem, AdminSupportInboxItem } from "@/lib/admin-notifications";
import { adminInboxCopy, type AppLanguage } from "@/lib/i18n";

type AdminNotificationInboxProps = {
  items: AdminNotificationItem[];
  supportItems: AdminSupportInboxItem[];
  language: AppLanguage;
};

type GroupedNotificationItem = AdminNotificationItem & {
  repeatCount: number;
};

function formatRelativeTime(value: string, language: AppLanguage) {
  const copy = adminInboxCopy[language];
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return copy.justNow;
  if (diffMinutes < 60) return copy.minutesAgo(diffMinutes);
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return copy.hoursAgo(diffHours);
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return copy.daysAgo(diffDays);
  const diffWeeks = Math.round(diffDays / 7);
  return copy.weeksAgo(diffWeeks);
}

export function AdminNotificationInbox({ items, supportItems, language }: AdminNotificationInboxProps) {
  const copy = adminInboxCopy[language];
  const [activeTab, setActiveTab] = useState<"notifications" | "support">("notifications");
  const [seenStamp, setSeenStamp] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.localStorage.getItem("verifyzon-admin-inbox-seen") || "";
  });

  const groupedItems = useMemo<GroupedNotificationItem[]>(() => {
    const groups = new Map<string, GroupedNotificationItem>();

    for (const item of items) {
      const shouldGroup = item.kind !== "support";
      const key = shouldGroup ? `${item.kind}:${item.title}:${item.href}` : item.id;
      const current = groups.get(key);

      if (!current) {
        groups.set(key, { ...item, repeatCount: 1 });
        continue;
      }

      groups.set(key, {
        ...current,
        repeatCount: current.repeatCount + 1,
        createdAt: new Date(item.createdAt).getTime() > new Date(current.createdAt).getTime() ? item.createdAt : current.createdAt,
      });
    }

    return Array.from(groups.values()).sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }, [items]);

  const unreadCount = useMemo(() => {
    if (!seenStamp) {
      return groupedItems.length;
    }
    return groupedItems.filter((item) => new Date(item.createdAt).getTime() > new Date(seenStamp).getTime()).length;
  }, [groupedItems, seenStamp]);

  function markSeen() {
    if (!groupedItems.length) {
      return;
    }
    const stamp = groupedItems[0].createdAt;
    setSeenStamp(stamp);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("verifyzon-admin-inbox-seen", stamp);
    }
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#eadfd6] bg-[linear-gradient(180deg,#fffdfa_0%,#f9f4ee_100%)] text-[#131316] shadow-[0_24px_60px_rgba(35,22,13,0.08)]">
      <div className="px-5 pb-3 pt-6 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8f857b]">{copy.eyebrow}</p>
            <h1 className="mt-2 text-[2rem] font-bold leading-none tracking-[-0.03em] sm:text-[2.35rem]">{copy.title}</h1>
          </div>
          <Link
            href="/admin?section=support"
            className="inline-flex items-center gap-2 rounded-full border border-[#eadfd6] bg-white px-4 py-2 text-sm font-semibold text-[#62564a] transition hover:border-[#dc4f1f] hover:text-[#dc4f1f]"
          >
            <CircleHelp className="h-4 w-4" />
            {copy.help}
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-2 border-b border-[#eadfd6]">
          <button
            type="button"
            onClick={() => {
              setActiveTab("notifications");
              markSeen();
            }}
            className={`flex items-center justify-between gap-3 border-b-2 px-1 pb-3 text-left text-[1.1rem] font-semibold tracking-[-0.03em] transition sm:text-[1.35rem] ${
              activeTab === "notifications" ? "border-[#dc4f1f] text-[#131316]" : "border-transparent text-[#8f857b]"
            }`}
          >
            <span>{copy.notifications}</span>
            <span className="rounded-full bg-[#ffefe7] px-3 py-1 text-xs font-bold text-[#dc4f1f] sm:text-sm">{unreadCount > 9 ? "9+" : unreadCount}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("support")}
            className={`flex items-center justify-between gap-3 border-b-2 px-1 pb-3 text-left text-[1.1rem] font-semibold tracking-[-0.03em] transition sm:text-[1.35rem] ${
              activeTab === "support" ? "border-[#dc4f1f] text-[#131316]" : "border-transparent text-[#8f857b]"
            }`}
          >
            <span>{copy.support}</span>
            <span className="text-xs font-bold text-[#8f857b] sm:text-sm">{supportItems.length > 9 ? "9+" : supportItems.length}</span>
          </button>
        </div>
      </div>

      <div className="divide-y divide-[#eadfd6]">
        {activeTab === "notifications"
          ? groupedItems.map((item) => {
              const isUnread = !seenStamp || new Date(item.createdAt).getTime() > new Date(seenStamp).getTime();
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={markSeen}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-5 py-4 transition hover:bg-[#fff7f2] sm:px-6"
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-1 text-[#62564a]">
                      {item.kind === "support" ? (
                        <LifeBuoy className="h-5 w-5" />
                      ) : item.kind === "report" ? (
                        <CircleHelp className="h-5 w-5" />
                      ) : item.kind === "billing" ? (
                        <Bell className="h-5 w-5" />
                      ) : (
                        <MessageSquareText className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[0.98rem] font-semibold leading-tight text-[#131316]">{item.title}</p>
                        {item.repeatCount > 1 ? (
                          <span className="rounded-full bg-[#ffefe7] px-2 py-0.5 text-[11px] font-bold text-[#dc4f1f]">x{item.repeatCount}</span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[0.9rem] leading-snug text-[#62564a]">{item.body}</p>
                    </div>
                  </div>
                  <span className="text-[0.82rem] font-semibold text-[#8f857b] sm:text-[0.92rem]">{formatRelativeTime(item.createdAt, language)}</span>
                  <span className={`h-2.5 w-2.5 rounded-full ${isUnread ? "bg-[#4b7cff]" : "bg-transparent"}`} />
                </Link>
              );
            })
          : supportItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 transition hover:bg-[#fff7f2] sm:px-6"
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1 text-[#62564a]">
                    <LifeBuoy className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[0.98rem] font-semibold leading-tight text-[#131316]">{item.subject}</p>
                    <p className="mt-1 text-[0.9rem] leading-snug text-[#62564a]">{item.userLabel} · {item.status.replace(/_/g, " ")} · {item.priority}</p>
                  </div>
                </div>
                <span className="text-[0.82rem] font-semibold text-[#8f857b] sm:text-[0.92rem]">{formatRelativeTime(item.lastActivityAt, language)}</span>
              </Link>
            ))}

        {activeTab === "notifications" && !groupedItems.length ? <div className="px-6 py-8 text-[#62564a]">{copy.noNotifications}</div> : null}
        {activeTab === "support" && !supportItems.length ? <div className="px-6 py-8 text-[#62564a]">{copy.noSupport}</div> : null}
      </div>
    </section>
  );
}
