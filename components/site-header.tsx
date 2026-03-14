import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AccountMenu } from "@/components/account-menu";

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-10 border-b border-[#e5e5df] bg-[#f7f7f2]/90 backdrop-blur">
      <div className="container-x flex items-center justify-between py-3">
        <Link href="/" className="text-base font-extrabold tracking-tight">
          Amazona Review
        </Link>
        <AccountMenu user={user} />
      </div>
    </header>
  );
}


