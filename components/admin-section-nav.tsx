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
        <div className="inline-flex min-w-full items-end gap-2 rounded-[1.55rem] border border-[#f1d8cc] bg-[linear-gradient(180deg,#fff9f6_0%,#fff1ea_100%)] px-2 py-2 shadow-[0_18px_34px_rgba(45,25,15,0.12)]">
          {sections.map((section) => {
            const active = activeSection === section.id;

            return (
              <Link
                key={section.id}
                href={`/admin?section=${section.id}`}
                className={`relative rounded-[1.25rem] px-4 py-3 text-sm font-semibold transition ${
                  active
                    ? "bg-[linear-gradient(180deg,#ff7e4d_0%,#ff6432_100%)] text-white shadow-[0_16px_32px_rgba(255,107,53,0.28)]"
                    : "border border-transparent bg-transparent text-[#34231a] hover:border-[#f0ddd3] hover:bg-white hover:text-[#1f1611]"
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
