import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AccountMenu } from "@/components/account-menu";
import { PushNotificationManager } from "@/components/push-notification-manager";
import { hasAdminAccess } from "@/lib/admin";
import { navigationCopy, normalizeLanguage, type AppLanguage } from "@/lib/i18n";

type SiteHeaderProps = {
  menuItems?: Array<{
    href: string;
    label: string;
    locked?: boolean;
  }>;
  messageHref?: string;
  hasUnreadMessages?: boolean;
  unreadThreads?: Array<{ threadId: number; lastIncomingMessageId: number; lastSeenMessageId: number }>;
  language?: AppLanguage;
};

export async function SiteHeader({ menuItems, messageHref, hasUnreadMessages = false, unreadThreads = [], language }: SiteHeaderProps = {}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase.from("profiles").select("role, email").eq("id", user.id).single() : { data: null };
  const isAdmin = hasAdminAccess(profile?.role, profile?.email || user?.email);
  const currentLanguage = normalizeLanguage(language);
  const nav = navigationCopy[currentLanguage];
  const defaultMenuItems = user
    ? [
        { href: "/dashboard", label: nav.goToDashboard },
        { href: "/profile", label: nav.editProfile },
      ]
    : undefined;
  const baseMenuItems = menuItems || defaultMenuItems;
  const resolvedMenuItems = baseMenuItems
    ? isAdmin && !baseMenuItems.some((item) => item.href === "/admin")
      ? [...baseMenuItems, { href: "/admin", label: nav.adminPanel }]
      : baseMenuItems
    : undefined;

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-[#e5e5df] bg-[#f7f7f2]/90 backdrop-blur">
        <div className="container-x flex items-center justify-between py-3">
          <Link href="/" className="text-base font-extrabold tracking-tight">
            Verifyzon
          </Link>
          <AccountMenu
            user={user}
            items={resolvedMenuItems}
            messageHref={messageHref}
            hasUnreadMessages={hasUnreadMessages}
            unreadThreads={unreadThreads}
            language={currentLanguage}
          />
        </div>
      </header>
      {user ? <PushNotificationManager userId={user.id} language={currentLanguage} /> : null}
    </>
  );
}
