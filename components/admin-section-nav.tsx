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
        <div className="inline-flex min-w-full items-end gap-2 rounded-[1.8rem] border border-white/10 bg-white/8 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          {sections.map((section) => {
            const active = activeSection === section.id;

            return (
              <Link
                key={section.id}
                href={`/admin?section=${section.id}`}
                className={`relative rounded-[1.25rem] px-4 py-3 text-sm font-semibold transition ${
                  active
                    ? "bg-[#fff7f2] text-[#dc4f1f] shadow-[0_16px_32px_rgba(255,107,53,0.18)]"
                    : "text-white/78 hover:bg-white/8 hover:text-white"
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
