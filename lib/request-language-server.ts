import { headers } from "next/headers";
import { normalizeLanguage, type AppLanguage } from "@/lib/i18n";

export async function getRequestAppLanguage(): Promise<AppLanguage> {
  const headerStore = await headers();
  const acceptLanguage = headerStore.get("accept-language") || "";
  const primaryLanguage = acceptLanguage.split(",")[0]?.trim().toLowerCase() || "";
  return normalizeLanguage(primaryLanguage.startsWith("en") ? "en" : "es");
}
