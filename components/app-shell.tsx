"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isAdminRoute = pathname.startsWith("/admin");

  return <div className={isAdminRoute ? "app-shell app-shell-admin" : "app-shell"}>{children}</div>;
}
