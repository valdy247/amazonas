"use client";

import Link from "next/link";
import { User } from "@supabase/supabase-js";

type AccountMenuProps = {
  user: User | null;
};

export function AccountMenu({ user }: AccountMenuProps) {
  return (
    <details className="relative">
      <summary className="list-none cursor-pointer rounded-full border border-[#e5e5df] bg-white px-4 py-2 text-sm font-semibold">
        Mi cuenta
      </summary>

      <div className="absolute right-0 z-20 mt-2 w-56 rounded-2xl border border-[#e5e5df] bg-white p-2 shadow-sm">
        {user ? (
          <>
            <p className="px-3 py-2 text-xs text-[#62626d]">{user.email}</p>
            <Link className="block rounded-xl px-3 py-2 text-sm hover:bg-[#fff3ec]" href="/dashboard">
              Ir al panel
            </Link>
            <form action="/auth/signout" method="post">
              <button className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-[#fff3ec]" type="submit">
                Cerrar sesión
              </button>
            </form>
          </>
        ) : (
          <>
            <Link className="block rounded-xl px-3 py-2 text-sm hover:bg-[#fff3ec]" href="/auth?mode=signup">
              Crear cuenta
            </Link>
            <Link className="block rounded-xl px-3 py-2 text-sm hover:bg-[#fff3ec]" href="/auth?mode=signin">
              Iniciar sesión
            </Link>
          </>
        )}
      </div>
    </details>
  );
}


