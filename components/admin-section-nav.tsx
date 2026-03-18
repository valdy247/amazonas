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
      <div className="rounded-[1.85rem] border border-[#ead8ce] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,244,237,0.96)_100%)] p-3 shadow-[0_18px_34px_rgba(45,25,15,0.1)] backdrop-blur">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-7">
          {sections.map((section) => {
            const active = activeSection === section.id;

            return (
              <Link
                key={section.id}
                href={`/admin?section=${section.id}`}
                className={`relative rounded-[1.35rem] px-4 py-3.5 text-center text-sm font-semibold transition ${
                  active
                    ? "bg-[linear-gradient(180deg,#ff8458_0%,#ff6532_100%)] text-white shadow-[0_16px_32px_rgba(255,107,53,0.26)]"
                    : "border border-transparent bg-white/72 text-[#3f2a1f] hover:border-[#ebd4c9] hover:bg-white hover:text-[#241710]"
                }`}
              >
                <span className="block leading-tight">{section.label}</span>
                {active ? <span className="absolute inset-x-6 -bottom-1 h-1 rounded-full bg-[#ffd4c3]" /> : null}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
