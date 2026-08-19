"use client";

import { Filter, GitBranch } from "lucide-react";
import { NeuCard, SectionHeader } from "@/components/ui/NeuCard";
import { Badge } from "@/components/ui/Badge";
import { Column, DataTable } from "@/components/ui/DataTable";
import { formatNumber, formatPercent, formatRupiah, formatRupiahShort } from "@/lib/format";
import type { FunnelStage, PipelinePerCabangRow } from "@/lib/metrics";

/** Ramp sekuensial satu hue: makin dalam tahapannya, makin gelap warnanya. */
const STAGE_COLORS = [
  "var(--color-funnel-1)",
  "var(--color-funnel-2)",
  "var(--color-funnel-3)",
];

export function PilarPipeline({
  funnel,
  perCabang,
}: {
  funnel: FunnelStage[];
  perCabang: PipelinePerCabangRow[];
}) {
  const total = funnel[0]?.jumlah ?? 0;

  return (
    <NeuCard>
      <SectionHeader
        eyebrow="Pilar 2 · Pipeline"
        title="Funneling Status Kredit"
        description="Perjalanan aplikasi dari prospek, analisa, sampai booking. Nominal tahap prospek & analisa memakai plafon usulan, tahap booking memakai baki debet."
        icon={<GitBranch size={18} />}
      />

      {total === 0 ? (
        <div className="neu-inset text-ink-500 rounded-2xl px-4 py-12 text-center text-sm">
          Tidak ada aplikasi kredit untuk filter ini.
        </div>
      ) : (
        <>
          <ol className="mb-6 space-y-3">
            {funnel.map((stage, index) => (
              <li key={stage.stage}>
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-3 shrink-0 rounded-sm"
                      style={{ backgroundColor: STAGE_COLORS[index] }}
                      aria-hidden
                    />
                    <span className="text-ink-900 text-sm font-bold">{stage.label}</span>
                    <span className="text-ink-500 text-xs">
                      {formatNumber(stage.jumlah)} aplikasi ·{" "}
                      {formatRupiahShort(stage.nominal)}
                    </span>
                  </div>
                  <span className="text-ink-700 text-xs font-semibold">
                    {index === 0
                      ? "Basis funnel"
                      : `${formatPercent(stage.conversionFromPrev)} dari ${funnel[index - 1].label}`}
                  </span>
                </div>

                {/* Panjang bar = proporsi terhadap tahap teratas. Angkanya
                    diletakkan di luar bar agar kontrasnya tidak bergantung
                    pada terang-gelapnya warna tahapan. */}
                <div className="flex items-center gap-3">
                  <div className="neu-inset-sm h-7 flex-1 overflow-hidden rounded-xl">
                    <div
                      className="h-full rounded-xl transition-[width] duration-500"
                      style={{
                        width: `${Math.max(stage.conversionFromTop, 2)}%`,
                        backgroundColor: STAGE_COLORS[index],
                      }}
                    />
                  </div>
                  <span className="text-ink-900 w-12 shrink-0 text-right text-xs font-bold tabular-nums">
                    {formatPercent(stage.conversionFromTop, 0)}
                  </span>
                </div>
              </li>
            ))}
          </ol>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge tone="teal">
              <Filter size={12} />
              Konversi prospek ke booking{" "}
              {formatPercent(funnel[funnel.length - 1]?.conversionFromTop ?? 0)}
            </Badge>
            <Badge tone="orange">
              Nominal pipeline berjalan{" "}
              {formatRupiahShort(
                perCabang.reduce((sum, row) => sum + row.nominalPipeline, 0),
              )}
            </Badge>
          </div>

          <PipelineTable rows={perCabang} />
        </>
      )}
    </NeuCard>
  );
}

function PipelineTable({ rows }: { rows: PipelinePerCabangRow[] }) {
  const columns: Column<PipelinePerCabangRow>[] = [
    {
      key: "cabang",
      header: "Cabang / KCP",
      render: (row) => <span className="text-ink-900 font-semibold">{row.cabang}</span>,
    },
    { key: "prospek", header: "Prospek", align: "right", render: (row) => formatNumber(row.prospek) },
    { key: "analisa", header: "Analisa", align: "right", render: (row) => formatNumber(row.analisa) },
    {
      key: "booking",
      header: "Booking",
      align: "right",
      render: (row) => (
        <span className="text-ink-900 font-semibold">{formatNumber(row.booking)}</span>
      ),
    },
    {
      key: "nominal",
      header: "Nominal Pipeline",
      align: "right",
      render: (row) => (
        <span title={formatRupiah(row.nominalPipeline)}>
          {formatRupiahShort(row.nominalPipeline)}
        </span>
      ),
    },
    {
      key: "konversi",
      header: "Konversi",
      align: "right",
      render: (row) => (
        <Badge
          tone={
            row.conversionPercent >= 60 ? "good" : row.conversionPercent >= 40 ? "warn" : "bad"
          }
        >
          {formatPercent(row.conversionPercent)}
        </Badge>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.cabang}
      maxHeight="22rem"
      emptyMessage="Belum ada pipeline pada filter ini."
    />
  );
}
