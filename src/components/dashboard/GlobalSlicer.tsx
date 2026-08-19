"use client";

import { Building2, Layers, MapPinned, RotateCcw, SlidersHorizontal, UserRound } from "lucide-react";
import { NeuSelect } from "@/components/ui/NeuSelect";
import { formatNumber } from "@/lib/format";
import { SLICER_KEYS, SLICER_LABELS, type SlicerKey, type SlicerState } from "@/lib/types";

const ICONS: Record<SlicerKey, React.ReactNode> = {
  area_head: <MapPinned size={15} />,
  cabang: <Building2 size={15} />,
  produk: <Layers size={15} />,
  pengelola: <UserRound size={15} />,
};

type GlobalSlicerProps = {
  slicer: SlicerState;
  options: Record<SlicerKey, string[]>;
  onChange: (key: SlicerKey, value: string | null) => void;
  onReset: () => void;
  activeCount: number;
  matchedRows: number;
  totalRows: number;
};

export function GlobalSlicer({
  slicer,
  options,
  onChange,
  onReset,
  activeCount,
  matchedRows,
  totalRows,
}: GlobalSlicerProps) {
  return (
    <div className="neu sticky top-3 z-40 rounded-3xl p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="neu-sm text-bni-teal-700 grid size-10 place-items-center rounded-2xl">
            <SlidersHorizontal size={18} />
          </span>
          <div>
            <h2 className="text-ink-900 text-sm font-bold">Slicer Global</h2>
            <p className="text-ink-500 text-xs">
              Menampilkan{" "}
              <strong className="text-bni-teal-700">{formatNumber(matchedRows)}</strong> dari{" "}
              {formatNumber(totalRows)} data
              {activeCount > 0 ? ` · ${activeCount} filter aktif` : ""}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onReset}
          disabled={activeCount === 0}
          className="neu-press text-ink-700 flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RotateCcw size={14} />
          Reset Filter
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SLICER_KEYS.map((key) => (
          <NeuSelect
            key={key}
            label={SLICER_LABELS[key]}
            value={slicer[key]}
            options={options[key]}
            icon={ICONS[key]}
            onChange={(value) => onChange(key, value)}
            allLabel={`Semua ${SLICER_LABELS[key]}`}
          />
        ))}
      </div>
    </div>
  );
}
