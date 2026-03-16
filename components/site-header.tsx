import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AccountMenu } from "@/components/account-menu";
import { hasAdminAccess } from "@/lib/admin";

type SiteHeaderProps = {
  menuItems?: Array<{
    href: string;
    label: string;
    locked?: boolean;
  }>;
  messageHref?: string;
  hasUnreadMessages?: boolean;
  unreadThreads?: Array<{ threadId: number; lastIncomingMessageId: number; lastSeenMessageId: number }>;
};

export async function SiteHeader({ menuItems, messageHref, hasUnreadMessages = false, unreadThreads = [] }: SiteHeaderProps = {}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase.from("profiles").select("role, email").eq("id", user.id).single() : { data: null };
  const isAdmin = hasAdminAccess(profile?.role, profile?.email || user?.email);
  const defaultMenuItems = user
    ? [
        { href: "/dashboard", label: "Ir al panel" },
        { href: "/profile", label: "Editar perfil" },
      ]
    : undefined;
  const baseMenuItems = menuItems || defaultMenuItems;
  const resolvedMenuItems = baseMenuItems
    ? isAdmin && !baseMenuItems.some((item) => item.href === "/admin")
      ? [...baseMenuItems, { href: "/admin", label: "Panel admin" }]
      : baseMenuItems
    : undefined;

  return (
    <header className="sticky top-0 z-10 border-b border-[#e5e5df] bg-[#f7f7f2]/90 backdrop-blur">
      <div className="container-x flex items-center justify-between py-3">
        <Link href="/" className="text-base font-extrabold tracking-tight">
          Amazona Review
        </Link>
        <AccountMenu user={user} items={resolvedMenuItems} messageHref={messageHref} hasUnreadMessages={hasUnreadMessages} unreadThreads={unreadThreads} />
      </div>
    </header>
  );
}
