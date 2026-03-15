"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Section = {
  id: string;
  label: string;
};

type AdminSectionNavProps = {
  sections: readonly Section[];
  activeSection: string;
};

export function AdminSectionNav({ sections, activeSection }: AdminSectionNavProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target as Node)) return;
      setOpen(false);
    }

    if (!open) return;

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open]);

  return (
    <>
      <div ref={containerRef} className="relative sm:hidden">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-xl text-white"
          aria-expanded={open}
          aria-label="Abrir menu admin"
        >
          ≡
        </button>
        {open ? (
          <div className="absolute right-0 top-14 z-20 min-w-56 rounded-[1.2rem] border border-white/12 bg-[#1e1713] p-2 shadow-2xl">
            {sections.map((section) => (
              <Link
                key={section.id}
                href={`/admin?section=${section.id}`}
                onClick={() => setOpen(false)}
                className={`block rounded-[0.95rem] px-3 py-3 text-sm font-semibold ${
                  activeSection === section.id ? "bg-[#ff6b35] text-white" : "text-white/78"
                }`}
              >
                {section.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-5 hidden flex-wrap gap-2 sm:flex">
        {sections.map((section) => (
          <Link
            key={section.id}
            href={`/admin?section=${section.id}`}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeSection === section.id
                ? "bg-[#ff6b35] text-white"
                : "border border-white/12 bg-white/8 text-white/75"
            }`}
          >
            {section.label}
          </Link>
        ))}
      </div>
    </>
  );
}
