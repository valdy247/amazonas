"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bell, CircleHelp, LifeBuoy, MessageSquareText } from "lucide-react";
import type { AdminNotificationItem, AdminSupportInboxItem } from "@/lib/admin-notifications";

type AdminNotificationInboxProps = {
  items: AdminNotificationItem[];
  supportItems: AdminSupportInboxItem[];
};

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hours ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays} days ago`;
  const diffWeeks = Math.round(diffDays / 7);
  return `${diffWeeks} week${diffWeeks === 1 ? "" : "s"} ago`;
}

export function AdminNotificationInbox({ items, supportItems }: AdminNotificationInboxProps) {
  const [activeTab, setActiveTab] = useState<"notifications" | "support">("notifications");
  const [seenStamp, setSeenStamp] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.localStorage.getItem("verifyzon-admin-inbox-seen") || "";
  });

  const unreadCount = useMemo(() => {
    if (!seenStamp) {
      return items.length;
    }
    return items.filter((item) => new Date(item.createdAt).getTime() > new Date(seenStamp).getTime()).length;
  }, [items, seenStamp]);

  function markSeen() {
    if (!items.length) {
      return;
    }
    const stamp = items[0].createdAt;
    setSeenStamp(stamp);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("verifyzon-admin-inbox-seen", stamp);
    }
  }

  return (
    <section className="overflow-hidden rounded-[2rem] bg-[#121212] text-white shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
      <div className="px-6 pb-4 pt-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.95rem] font-medium text-white/55">Admin inbox</p>
            <h1 className="mt-2 text-[3rem] font-semibold leading-none tracking-[-0.04em]">Inbox</h1>
          </div>
          <Link
            href="/admin?section=support"
            className="inline-flex items-center gap-2 rounded-full bg-white/8 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/12"
          >
            <CircleHelp className="h-4 w-4" />
            Help
          </Link>
        </div>

        <div className="mt-7 grid grid-cols-2 border-b border-white/10">
          <button
            type="button"
            onClick={() => {
              setActiveTab("notifications");
              markSeen();
            }}
            className={`flex items-center justify-between gap-3 border-b-2 px-1 pb-4 text-left text-[2rem] font-semibold tracking-[-0.04em] transition ${
              activeTab === "notifications" ? "border-white text-white" : "border-transparent text-white/45"
            }`}
          >
            <span>Notifications</span>
            <span className="rounded-full bg-[#2958c8] px-4 py-1 text-base font-bold text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("support")}
            className={`flex items-center justify-between gap-3 border-b-2 px-1 pb-4 text-left text-[2rem] font-semibold tracking-[-0.04em] transition ${
              activeTab === "support" ? "border-white text-white" : "border-transparent text-white/45"
            }`}
          >
            <span>Support</span>
            <span className="text-base font-bold text-white/65">{supportItems.length > 9 ? "9+" : supportItems.length}</span>
          </button>
        </div>
      </div>

      <div className="divide-y divide-white/10">
        {activeTab === "notifications"
          ? items.map((item) => {
              const isUnread = !seenStamp || new Date(item.createdAt).getTime() > new Date(seenStamp).getTime();
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={markSeen}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-6 py-5 transition hover:bg-white/4"
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-1 text-white/85">
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
                      <p className="text-[1rem] font-semibold leading-tight text-white">{item.title}</p>
                      <p className="mt-1 text-[0.95rem] leading-snug text-white/70">{item.body}</p>
                    </div>
                  </div>
                  <span className="text-[0.95rem] font-semibold text-white/75">{formatRelativeTime(item.createdAt)}</span>
                  <span className={`h-3 w-3 rounded-full ${isUnread ? "bg-[#4b7cff]" : "bg-transparent"}`} />
                </Link>
              );
            })
          : supportItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-6 py-5 transition hover:bg-white/4"
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1 text-white/85">
                    <LifeBuoy className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[1rem] font-semibold leading-tight text-white">{item.subject}</p>
                    <p className="mt-1 text-[0.95rem] leading-snug text-white/70">
                      {item.userLabel} • {item.status.replace(/_/g, " ")} • {item.priority}
                    </p>
                  </div>
                </div>
                <span className="text-[0.95rem] font-semibold text-white/75">{formatRelativeTime(item.lastActivityAt)}</span>
              </Link>
            ))}

        {activeTab === "notifications" && !items.length ? (
          <div className="px-6 py-8 text-white/70">No notifications yet.</div>
        ) : null}
        {activeTab === "support" && !supportItems.length ? (
          <div className="px-6 py-8 text-white/70">No support conversations yet.</div>
        ) : null}
      </div>
    </section>
  );
}
