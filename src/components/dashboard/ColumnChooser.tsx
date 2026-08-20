"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Columns3, RotateCcw, Search, Square, SquareCheck } from "lucide-react";
import { DETAIL_COLUMNS } from "@/lib/columns";

type ColumnChooserProps = {
  /** Label kolom yang sedang ditampilkan. */
  visibleColumns: string[];
  onToggle: (label: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onReset: () => void;
};

/**
 * Dropdown "Pilih Kolom": daftar checkbox untuk seluruh kolom file sumber,
 * dilengkapi pencarian karena jumlah kolomnya banyak.
 */
export function ColumnChooser({
  visibleColumns,
  onToggle,
  onSelectAll,
  onClear,
  onReset,
}: ColumnChooserProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelId = useId();

  const visibleSet = useMemo(() => new Set(visibleColumns), [visibleColumns]);

  const filtered = useMemo(() => {
    if (!query.trim()) return DETAIL_COLUMNS;
    const needle = query.trim().toLowerCase();
    return DETAIL_COLUMNS.filter((column) =>
      column.label.toLowerCase().includes(needle),
    );
  }, [query]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) close();
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
      }}
    >
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="neu-press text-ink-700 flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold"
      >
        <Columns3 size={15} className="text-bni-teal-700" />
        Pilih Kolom
        <span className="neu-inset-sm text-bni-teal-700 rounded-full px-2 py-0.5 text-[0.65rem]">
          {visibleColumns.length}/{DETAIL_COLUMNS.length}
        </span>
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Pilih kolom yang ditampilkan"
          className="neu absolute right-0 z-40 mt-2 w-[min(92vw,26rem)] rounded-2xl p-3 shadow-lg"
        >
          <div className="neu-inset-sm mb-3 flex items-center gap-2 rounded-xl px-3 py-2">
            <Search size={14} className="text-ink-500 shrink-0" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari nama kolom..."
              className="text-ink-900 placeholder:text-ink-300 w-full bg-transparent text-sm outline-none"
            />
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSelectAll}
              className="neu-press text-ink-700 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[0.7rem] font-bold"
            >
              <SquareCheck size={12} />
              Pilih Semua
            </button>
            <button
              type="button"
              onClick={onClear}
              className="neu-press text-ink-700 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[0.7rem] font-bold"
            >
              <Square size={12} />
              Kosongkan
            </button>
            <button
              type="button"
              onClick={onReset}
              className="neu-press text-bni-teal-700 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[0.7rem] font-bold"
            >
              <RotateCcw size={12} />
              Kolom Esensial
            </button>
          </div>

          <ul className="neu-scroll max-h-80 space-y-0.5 overflow-y-auto pr-1">
            {filtered.map((column) => {
              const checked = visibleSet.has(column.label);
              return (
                <li key={column.label}>
                  <label
                    className={`hover:bg-surface-sunken flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                      checked ? "text-ink-900 font-semibold" : "text-ink-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(column.label)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden
                      className={`grid size-5 shrink-0 place-items-center rounded-md ${
                        checked ? "neu-sm text-bni-teal-700" : "neu-inset-sm text-transparent"
                      }`}
                    >
                      <Check size={13} strokeWidth={3} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{column.label}</span>
                    <code className="text-ink-300 shrink-0 text-[0.65rem]">{column.key}</code>
                  </label>
                </li>
              );
            })}

            {filtered.length === 0 ? (
              <li className="text-ink-500 px-3 py-4 text-sm">
                Tidak ada kolom yang cocok dengan &quot;{query}&quot;.
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
