"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

type NeuSelectProps = {
  label: string;
  value: string | null;
  options: string[];
  onChange: (value: string | null) => void;
  /** Teks untuk opsi "tanpa filter". */
  allLabel?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
};

/** Ambang jumlah opsi sebelum kotak pencarian ditampilkan. */
const SEARCH_THRESHOLD = 8;

/**
 * Dropdown neumorphic untuk slicer global. Dibuat manual (bukan `<select>`)
 * agar bisa mengikuti gaya neumorphism sekaligus menyediakan pencarian
 * saat daftar pengelola panjang.
 */
export function NeuSelect({
  label,
  value,
  options,
  onChange,
  allLabel = "Semua",
  icon,
  disabled = false,
}: NeuSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const entries = useMemo(() => {
    const filtered = query
      ? options.filter((option) => option.toLowerCase().includes(query.toLowerCase()))
      : options;
    return [null, ...filtered];
  }, [options, query]);

  // Menutup dropdown sekaligus mengembalikan pencarian ke kondisi awal.
  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  // Tutup saat klik di luar komponen.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) close();
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, close]);

  // Fokuskan kotak pencarian begitu dropdown dibuka.
  useEffect(() => {
    if (open && options.length > SEARCH_THRESHOLD) searchRef.current?.focus();
  }, [open, options.length]);

  // Pilihan yang tidak lagi tersedia setelah slicer lain berubah.
  const isStale = value !== null && !options.includes(value);

  function commit(next: string | null) {
    onChange(next);
    close();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      close();
      return;
    }
    if (!open && (event.key === "Enter" || event.key === " " || event.key === "ArrowDown")) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, entries.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      commit(entries[activeIndex] ?? null);
    }
  }

  return (
    <div ref={containerRef} className="relative min-w-0" onKeyDown={onKeyDown}>
      <label className="text-ink-500 mb-1.5 block text-[0.7rem] font-semibold tracking-wider uppercase">
        {label}
      </label>

      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        className={`neu-press flex w-full items-center gap-2 rounded-2xl px-3.5 py-2.5 text-left text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
          value ? "text-bni-teal-700" : "text-ink-700"
        }`}
      >
        {icon ? <span className="text-bni-teal-600 shrink-0">{icon}</span> : null}
        <span className="min-w-0 flex-1 truncate">
          {value ?? allLabel}
          {isStale ? " (tidak tersedia)" : ""}
        </span>
        <ChevronDown
          size={16}
          className={`text-ink-500 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="neu absolute z-30 mt-2 w-full min-w-[15rem] rounded-2xl p-2 shadow-lg">
          {options.length > SEARCH_THRESHOLD ? (
            <div className="neu-inset-sm mb-2 flex items-center gap-2 rounded-xl px-3 py-2">
              <Search size={14} className="text-ink-500 shrink-0" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                placeholder="Cari..."
                className="text-ink-900 placeholder:text-ink-300 w-full bg-transparent text-sm outline-none"
              />
            </div>
          ) : null}

          <ul
            id={listboxId}
            role="listbox"
            aria-label={label}
            className="neu-scroll max-h-64 overflow-y-auto"
          >
            {entries.map((option, index) => {
              const selected = option === value;
              const active = index === activeIndex;
              return (
                <li key={option ?? "__all__"}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => commit(option)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                      selected
                        ? "text-bni-teal-700 font-semibold"
                        : active
                          ? "text-ink-900 bg-surface-sunken"
                          : "text-ink-700"
                    }`}
                  >
                    <span className="truncate">{option ?? allLabel}</span>
                    {selected ? <Check size={15} className="shrink-0" /> : null}
                  </button>
                </li>
              );
            })}

            {entries.length === 1 && query ? (
              <li className="text-ink-500 px-3 py-3 text-sm">Tidak ada hasil.</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
