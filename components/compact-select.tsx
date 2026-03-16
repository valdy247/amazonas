"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

type CompactSelectOption = {
  value: string;
  label: string;
};

type CompactSelectProps = {
  value: string;
  options: readonly CompactSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  tone?: "light" | "dark";
};

export function CompactSelect({
  value,
  options,
  onChange,
  placeholder,
  tone = "light",
}: CompactSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) || null,
    [options, value]
  );

  const buttonClassName =
    tone === "dark"
      ? "border-white/12 bg-white/8 text-white"
      : "border-[#e7ddd6] bg-white text-[#131316] shadow-[0_10px_24px_rgba(37,22,12,0.04)]";

  const menuClassName =
    tone === "dark"
      ? "border-white/12 bg-[#241b15] text-white shadow-[0_22px_50px_rgba(0,0,0,0.3)]"
      : "border-[#eadfd6] bg-white text-[#131316] shadow-[0_22px_50px_rgba(18,18,23,0.12)]";

  const itemClassName =
    tone === "dark"
      ? "hover:bg-white/8"
      : "hover:bg-[#faf4ef]";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={`flex h-12 w-full items-center justify-between gap-3 rounded-[1.2rem] border px-4 text-left text-sm font-semibold transition ${buttonClassName}`}
      >
        <span className="truncate">{selectedOption?.label || placeholder}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen ? (
        <div className={`absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-[1.2rem] border ${menuClassName}`}>
          <div className="max-h-64 overflow-y-auto p-2">
            {options.map((option) => {
              const selected = option.value === value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-[0.95rem] px-3 py-3 text-left text-sm font-semibold transition ${itemClassName} ${
                    selected ? (tone === "dark" ? "bg-white/10" : "bg-[#fff3ec] text-[#dc4f1f]") : ""
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {selected ? <Check className="h-4 w-4 shrink-0" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
