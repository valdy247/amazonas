"use client";

import Link from "next/link";

type Section = {
  id: string;
  label: string;
};

type AdminSectionNavProps = {
  sections: readonly Section[];
  activeSection: string;
};

export function AdminSectionNav({ sections, activeSection }: AdminSectionNavProps) {
  return (
    <div className="w-full">
      <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="inline-flex min-w-full items-end gap-2 rounded-t-[1.8rem] rounded-b-[1.35rem] border border-[#fff3ef] bg-[linear-gradient(180deg,rgba(255,248,244,0.98)_0%,rgba(255,236,227,0.9)_100%)] px-2 pt-2 pb-1 shadow-[0_20px_42px_rgba(58,34,22,0.18)]">
          {sections.map((section) => {
            const active = activeSection === section.id;

            return (
              <Link
                key={section.id}
                href={`/admin?section=${section.id}`}
                className={`relative rounded-[1.25rem] px-4 py-3 text-sm font-semibold transition ${
                  active
                    ? "bg-[linear-gradient(180deg,#ff7e4d_0%,#ff6432_100%)] text-white shadow-[0_16px_32px_rgba(255,107,53,0.28)]"
                    : "text-[#4b3628] hover:bg-white/55 hover:text-[#1f1611]"
                }`}
              >
                <span className="block whitespace-nowrap">{section.label}</span>
                {active ? <span className="absolute inset-x-4 -bottom-1 h-1 rounded-full bg-[#ffd4c3]" /> : null}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
