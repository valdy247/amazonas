"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { User } from "@supabase/supabase-js";
import { Menu, X } from "lucide-react";

type AccountMenuProps = {
  user: User | null;
};

export function AccountMenu({ user }: AccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

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
        aria-label={isOpen ? "Cerrar menu" : "Abrir menu"}
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#e5e5df] bg-white text-[#131316] shadow-sm transition hover:bg-[#fff3ec]"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {isOpen ? (
        <div className="absolute right-0 z-20 mt-2 w-60 rounded-[1.4rem] border border-[#e5e5df] bg-white p-2 shadow-[0_18px_36px_rgba(22,18,14,0.08)]">
          {user ? (
            <>
              <p className="px-3 py-2 text-xs text-[#62626d]">{user.email}</p>
              <Link className="block rounded-xl px-3 py-2 text-sm hover:bg-[#fff3ec]" href="/dashboard" onClick={() => setIsOpen(false)}>
                Ir al panel
              </Link>
              <Link className="block rounded-xl px-3 py-2 text-sm hover:bg-[#fff3ec]" href="/profile" onClick={() => setIsOpen(false)}>
                Editar perfil
              </Link>
              <form action="/auth/signout" method="post">
                <button className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-[#fff3ec]" type="submit">
                  Cerrar sesion
                </button>
              </form>
            </>
          ) : (
            <>
              <Link className="block rounded-xl px-3 py-2 text-sm hover:bg-[#fff3ec]" href="/auth?mode=signup" onClick={() => setIsOpen(false)}>
                Crear cuenta
              </Link>
              <Link className="block rounded-xl px-3 py-2 text-sm hover:bg-[#fff3ec]" href="/auth?mode=signin" onClick={() => setIsOpen(false)}>
                Iniciar sesion
              </Link>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
