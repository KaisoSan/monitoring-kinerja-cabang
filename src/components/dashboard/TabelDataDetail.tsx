"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Table2, TriangleAlert } from "lucide-react";
import { NeuCard, SectionHeader } from "@/components/ui/NeuCard";
import { ColumnChooser } from "./ColumnChooser";
import {
  DEFAULT_VISIBLE_COLUMNS,
  DETAIL_COLUMNS,
  getCellValue,
  type DetailColumn,
} from "@/lib/columns";
import {
  formatNumber,
  formatPercent,
  formatRupiah,
  formatRupiahShort,
} from "@/lib/format";
import { SLICER_KEYS, type KreditRecord, type SlicerState } from "@/lib/types";

const PAGE_SIZE = 50;

export function TabelDataDetail({ slicer }: { slicer: SlicerState }) {
  // Hanya kolom esensial yang tampil saat dashboard pertama kali dibuka.
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_VISIBLE_COLUMNS);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<KreditRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Kolom dirender dalam urutan file sumber, bukan urutan pencentangan,
  // supaya posisi kolom tidak berpindah saat pilihan berubah.
  const columns = useMemo<DetailColumn[]>(() => {
    const visible = new Set(visibleColumns);
    return DETAIL_COLUMNS.filter((column) => visible.has(column.label));
  }, [visibleColumns]);

  const slicerKey = SLICER_KEYS.map((key) => slicer[key] ?? "").join("|");

  // Kembali ke halaman pertama setiap kali slicer berubah. Penyesuaian
  // dilakukan saat render (bukan di effect) agar tidak memicu render berantai.
  const [lastSlicerKey, setLastSlicerKey] = useState(slicerKey);
  if (slicerKey !== lastSlicerKey) {
    setLastSlicerKey(slicerKey);
    setPage(0);
  }

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
        });
        for (const key of SLICER_KEYS) {
          const value = slicer[key];
          if (value) params.set(key, value);
        }

        const response = await fetch(`/api/records?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Server menjawab ${response.status}.`);

        const payload = (await response.json()) as { rows: KreditRecord[]; total: number };
        setRows(payload.rows ?? []);
        setTotal(payload.total ?? 0);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setRows([]);
        setTotal(0);
        setError(cause instanceof Error ? cause.message : "Data detail gagal dimuat.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [page, slicer, slicerKey]);

  const toggleColumn = useCallback((label: string) => {
    setVisibleColumns((current) =>
      current.includes(label)
        ? current.filter((entry) => entry !== label)
        : [...current, label],
    );
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstRow = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const lastRow = Math.min(total, (page + 1) * PAGE_SIZE);

  return (
    <NeuCard>
      <SectionHeader
        eyebrow="Data Detail"
        title="Tabel Data Kredit per Rekening"
        description={`Mengikuti slicer global. Tersedia ${DETAIL_COLUMNS.length} kolom dari file sumber — pilih lewat tombol di kanan.`}
        icon={<Table2 size={18} />}
        action={
          <ColumnChooser
            visibleColumns={visibleColumns}
            onToggle={toggleColumn}
            onSelectAll={() => setVisibleColumns(DETAIL_COLUMNS.map((c) => c.label))}
            onClear={() => setVisibleColumns([])}
            onReset={() => setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)}
          />
        }
      />

      {error ? (
        <div className="neu-inset text-state-bad-text mb-4 flex items-start gap-3 rounded-2xl p-4 text-sm">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      {columns.length === 0 ? (
        <div className="neu-inset text-ink-500 rounded-2xl px-4 py-10 text-center text-sm">
          Belum ada kolom yang dipilih. Buka <strong>Pilih Kolom</strong> untuk menampilkan
          data.
        </div>
      ) : (
        <div className="neu-inset neu-scroll relative max-h-[34rem] overflow-auto rounded-2xl">
          {loading ? (
            <div className="bg-surface/70 absolute inset-0 z-20 grid place-items-center backdrop-blur-[1px]">
              <Loader2 size={22} className="text-bni-teal-700 animate-spin" />
            </div>
          ) : null}

          <table className="w-full border-collapse text-sm">
            <thead className="bg-surface-sunken/95 sticky top-0 z-10 backdrop-blur">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.label}
                    scope="col"
                    className={`text-ink-500 px-4 py-3 text-[0.68rem] font-bold tracking-wider whitespace-nowrap uppercase ${
                      column.align === "right" ? "text-right" : "text-left"
                    }`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((record) => (
                <tr
                  key={record.kode_fasilitas}
                  className="border-surface/60 hover:bg-surface-raised/70 border-t transition-colors"
                >
                  {columns.map((column) => (
                    <Cell key={column.label} record={record} column={column} />
                  ))}
                </tr>
              ))}

              {rows.length === 0 && !loading ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="text-ink-500 px-4 py-10 text-center text-sm"
                  >
                    Tidak ada data untuk filter ini.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-500 text-xs">
          {total === 0
            ? "0 baris"
            : `Menampilkan ${formatNumber(firstRow)}-${formatNumber(lastRow)} dari ${formatNumber(total)} rekening`}
          {columns.length > 0 ? ` · ${columns.length} kolom aktif` : ""}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={page === 0 || loading}
            className="neu-press text-ink-700 flex items-center gap-1.5 rounded-2xl px-4 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={14} />
            Sebelumnya
          </button>
          <span className="text-ink-700 text-xs font-semibold tabular-nums">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
            disabled={page >= totalPages - 1 || loading}
            className="neu-press text-ink-700 flex items-center gap-1.5 rounded-2xl px-4 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40"
          >
            Berikutnya
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </NeuCard>
  );
}

function Cell({ record, column }: { record: KreditRecord; column: DetailColumn }) {
  const value = getCellValue(record, column);
  const display = formatCell(value, column);

  return (
    <td
      className={`text-ink-700 px-4 py-2.5 whitespace-nowrap ${
        column.align === "right" ? "text-right tabular-nums" : "text-left"
      }`}
      title={column.format === "currency" && typeof value === "number" ? formatRupiah(value) : undefined}
    >
      {display}
    </td>
  );
}

function formatCell(value: unknown, column: DetailColumn): string {
  if (value === null || value === undefined || value === "") return "-";

  if (typeof value === "boolean") return value ? "Ya" : "Tidak";

  switch (column.format) {
    case "currency": {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? formatRupiahShort(numeric) : String(value);
    }
    case "percent": {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? formatPercent(numeric, 2) : String(value);
    }
    case "number": {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? formatNumber(numeric) : String(value);
    }
    case "date":
      return String(value).slice(0, 10);
    default:
      return String(value);
  }
}
