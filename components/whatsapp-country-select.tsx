"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import type { WhatsappPrefixOption } from "@/lib/whatsapp-prefix-options";

type WhatsappCountrySelectProps = {
  name: string;
  options: readonly WhatsappPrefixOption[];
  defaultValue: string;
};

export function WhatsappCountrySelect({
  name,
  options,
  defaultValue,
}: WhatsappCountrySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedValue, setSelectedValue] = useState(defaultValue);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSelectedValue(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

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
    window.setTimeout(() => searchRef.current?.focus(), 40);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const selectedOption =
    options.find((option) => option.value === selectedValue) ||
    options.find((option) => option.value.endsWith(selectedValue.split(":").slice(-1)[0])) ||
    options[0];

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const normalizedDigits = normalizedQuery.replace(/\D/g, "");

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) => {
      const dialCode = option.value.split(":").slice(-1)[0];
      const normalizedDialDigits = dialCode.replace(/\D/g, "");
      const searchableText = `${option.label} ${dialCode}`.toLowerCase();

      return searchableText.includes(normalizedQuery) || (normalizedDigits ? normalizedDialDigits.includes(normalizedDigits) : false);
    });
  }, [options, query]);

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={selectedValue} />
      <div className="flex items-center justify-between gap-3 rounded-[1.15rem] border border-[#e8ddd3] bg-white/80 px-3 py-2 shadow-[0_14px_34px_rgba(18,18,23,0.06)]">
        <button
          className="flex min-w-0 flex-1 items-center gap-3 rounded-[1rem] px-1 py-1 text-left"
          type="button"
          onClick={() => setIsOpen((current) => !current)}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#fff1ea_0%,#ffffff_100%)] text-xl shadow-[0_8px_18px_rgba(220,79,31,0.12)]">
            {selectedOption.flag}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-[#131316]">{selectedOption.label}</span>
            <span className="mt-0.5 block text-xs font-medium text-[#7f756b]">{selectedOption.value.split(":").slice(-1)[0]}</span>
          </span>
          <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-[#8f857b] transition ${isOpen ? "rotate-180" : ""}`} />
        </button>

      </div>
      {isOpen ? (
        <div className="absolute z-30 mt-2 w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-[1.3rem] border border-[#eadfd6] bg-white shadow-[0_22px_60px_rgba(18,18,23,0.16)]">
          <div className="border-b border-[#f1e6dc] bg-[linear-gradient(180deg,#fff8f3_0%,#ffffff_100%)] p-3">
            <div className="flex items-center gap-2 rounded-[1rem] border border-[#eadfd6] bg-white px-3 py-2 shadow-[0_8px_18px_rgba(18,18,23,0.04)]">
              <Search className="h-4 w-4 text-[#8f857b]" />
              <input
                ref={searchRef}
                className="w-full bg-transparent text-sm text-[#131316] outline-none placeholder:text-[#9b9288]"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar pais o prefijo: 245, +245, Cuba..."
              />
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {filteredOptions.length ? (
              filteredOptions.map((option) => {
                const isSelected = option.value === selectedValue;
                const dialCode = option.value.split(":").slice(-1)[0];

                return (
                  <button
                    key={option.value}
                    className={`flex w-full items-center gap-3 rounded-[1rem] px-3 py-3 text-left transition ${
                      isSelected ? "bg-[#fff3ec] text-[#131316]" : "text-[#3c332c] hover:bg-[#faf4ef]"
                    }`}
                    type="button"
                    onClick={() => {
                      setSelectedValue(option.value);
                      setIsOpen(false);
                      setQuery("");
                    }}
                  >
                    <span className="text-xl">{option.flag}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{option.label}</span>
                      <span className="block text-xs text-[#7f756b]">{dialCode}</span>
                    </span>
                    {isSelected ? <Check className="h-4 w-4 text-[#dc4f1f]" /> : null}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-6 text-center text-sm text-[#7f756b]">No encontramos un pais con esa busqueda.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
