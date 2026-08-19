"use client";

import { AlertTriangle, Trophy, UserRound } from "lucide-react";
import { NeuCard, SectionHeader } from "@/components/ui/NeuCard";
import { Badge } from "@/components/ui/Badge";
import { Column, DataTable } from "@/components/ui/DataTable";
import { formatNumber, formatRupiah, formatRupiahShort, initials } from "@/lib/format";
import type { Leaderboard, SalesPerformance } from "@/lib/metrics";

export function PilarProduktivitas({ leaderboard }: { leaderboard: Leaderboard }) {
  const { top, bottom, bottomIsNihil, totalSales, salesNihilBooking } = leaderboard;

  return (
    <NeuCard>
      <SectionHeader
        eyebrow="Pilar 3 · Produktivitas"
        title="Leaderboard Pengelola"
        description={`${formatNumber(totalSales)} pengelola aktif pada filter ini, ${formatNumber(
          salesNihilBooking,
        )} di antaranya belum membukukan booking.`}
        icon={<UserRound size={18} />}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div>
          <h3 className="text-ink-900 mb-3 flex items-center gap-2 text-sm font-bold">
            <span className="neu-sm text-bni-teal-700 grid size-8 place-items-center rounded-xl">
              <Trophy size={15} />
            </span>
            Top 10 Pengelola
          </h3>
          <LeaderboardTable rows={top} variant="top" />
        </div>

        <div>
          <h3 className="text-ink-900 mb-3 flex items-center gap-2 text-sm font-bold">
            <span className="neu-sm text-state-bad-text grid size-8 place-items-center rounded-xl">
              <AlertTriangle size={15} />
            </span>
            {bottomIsNihil ? "Bottom 10 - Nihil Booking" : "Bottom 10 Pengelola"}
          </h3>
          <LeaderboardTable rows={bottom} variant="bottom" />
        </div>
      </div>
    </NeuCard>
  );
}

function LeaderboardTable({
  rows,
  variant,
}: {
  rows: SalesPerformance[];
  variant: "top" | "bottom";
}) {
  const isTop = variant === "top";

  const columns: Column<SalesPerformance>[] = [
    {
      key: "rank",
      header: "#",
      className: "w-10",
      render: (_row, index) => (
        <span className="text-ink-500 text-xs font-bold">{index + 1}</span>
      ),
    },
    {
      key: "pengelola",
      header: "Pengelola",
      render: (row) => (
        <div className="flex items-center gap-3">
          <span
            className={`neu-sm grid size-9 shrink-0 place-items-center rounded-xl text-[0.7rem] font-bold ${
              isTop ? "text-bni-teal-700" : "text-ink-500"
            }`}
            aria-hidden
          >
            {initials(row.pengelola)}
          </span>
          <div className="min-w-0">
            <p className="text-ink-900 truncate font-semibold">{row.pengelola}</p>
            <p className="text-ink-500 truncate text-xs">{row.cabang}</p>
          </div>
        </div>
      ),
    },
    {
      key: "booking",
      header: "Booking",
      align: "right",
      render: (row) => (
        <div className="flex flex-col items-end">
          <span className="text-ink-900 font-semibold" title={formatRupiah(row.nominalBooking)}>
            {formatRupiahShort(row.nominalBooking)}
          </span>
          <span className="text-ink-500 text-xs">{formatNumber(row.jumlahBooking)} debitur</span>
        </div>
      ),
    },
    isTop
      ? {
          key: "growth",
          header: "Growth",
          align: "right",
          render: (row) => (
            <span
              className={
                row.growthNominal >= 0
                  ? "text-state-good-text font-semibold"
                  : "text-state-bad-text font-semibold"
              }
            >
              {row.growthNominal >= 0 ? "+" : ""}
              {formatRupiahShort(row.growthNominal)}
            </span>
          ),
        }
      : {
          key: "pipeline",
          header: "Pipeline Tertahan",
          align: "right",
          render: (row) => (
            <div className="flex flex-col items-end gap-1">
              <span className="text-ink-700" title={formatRupiah(row.nominalPipeline)}>
                {formatRupiahShort(row.nominalPipeline)}
              </span>
              {row.jumlahBooking === 0 ? (
                <Badge tone="bad">Nihil booking</Badge>
              ) : (
                <span className="text-ink-500 text-xs">
                  {formatNumber(row.pipelineAktif)} aplikasi
                </span>
              )}
            </div>
          ),
        },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.pengelola}
      maxHeight="26rem"
      emptyMessage={
        isTop
          ? "Belum ada pengelola dengan booking pada filter ini."
          : "Seluruh pengelola sudah membukukan booking."
      }
    />
  );
}
