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
        <div className="inline-flex min-w-full items-end gap-2 rounded-t-[1.7rem] rounded-b-[1.2rem] border border-white/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.2)_0%,rgba(255,255,255,0.08)_100%)] px-2 pt-2 pb-1 shadow-[0_18px_38px_rgba(14,10,8,0.16)]">
          {sections.map((section) => {
            const active = activeSection === section.id;

            return (
              <Link
                key={section.id}
                href={`/admin?section=${section.id}`}
                className={`relative rounded-[1.25rem] px-4 py-3 text-sm font-semibold transition ${
                  active
                    ? "bg-[#fff7f2] text-[#dc4f1f] shadow-[0_16px_32px_rgba(255,107,53,0.18)]"
                    : "text-white/84 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="block whitespace-nowrap">{section.label}</span>
                {active ? <span className="absolute inset-x-4 -bottom-1 h-1 rounded-full bg-[#ff6b35]" /> : null}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
