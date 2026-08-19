"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Building2, Target, TrendingUp, Users, Wallet } from "lucide-react";
import { NeuCard, SectionHeader } from "@/components/ui/NeuCard";
import { StatCard } from "@/components/ui/StatCard";
import { Badge, ProgressBar } from "@/components/ui/Badge";
import { Column, DataTable } from "@/components/ui/DataTable";
import {
  formatDelta,
  formatNumber,
  formatPercent,
  formatRupiah,
  formatRupiahShort,
} from "@/lib/format";
import type { PencapaianSummary, TargetVsRealisasiRow } from "@/lib/metrics";

const COLOR_REALISASI = "var(--color-chart-realisasi)";
const COLOR_TARGET = "var(--color-chart-target)";

/** Batas jumlah cabang yang digambar; sisanya ditampilkan lewat tabel. */
const CHART_LIMIT = 12;

export function PilarPencapaian({
  summary,
  rows,
}: {
  summary: PencapaianSummary;
  rows: TargetVsRealisasiRow[];
}) {
  const [showTable, setShowTable] = useState(false);

  const chartRows = useMemo(() => rows.slice(0, CHART_LIMIT), [rows]);
  const achieved = summary.achievementPercent >= 100;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Baki Debet"
          value={formatRupiahShort(summary.totalBakiDebet)}
          hint={formatRupiah(summary.totalBakiDebet)}
          icon={<Wallet size={17} />}
          tone="teal"
        />
        <StatCard
          label="Growth Periode Berjalan"
          value={formatRupiahShort(summary.growthNominal)}
          delta={{
            text: formatDelta(summary.growthPercent),
            positive: summary.growthNominal >= 0,
          }}
          hint={`dari ${formatRupiahShort(summary.bakiDebetAwal)}`}
          icon={<TrendingUp size={17} />}
          tone={summary.growthNominal >= 0 ? "good" : "bad"}
        />
        <StatCard
          label="Target Baki Debet"
          value={formatRupiahShort(summary.totalTarget)}
          icon={<Target size={17} />}
          tone="orange"
          progress={{
            value: summary.achievementPercent,
            tone: achieved ? "good" : summary.achievementPercent >= 90 ? "warn" : "bad",
            caption: `Pencapaian ${formatPercent(summary.achievementPercent)} · gap ${formatRupiahShort(
              summary.gapToTarget,
            )}`,
          }}
        />
        <StatCard
          label="Debitur Aktif"
          value={formatNumber(summary.jumlahDebitur)}
          hint={`${formatNumber(summary.jumlahCabang)} cabang · rata-rata ${formatRupiahShort(
            summary.rataRataPerDebitur,
          )}`}
          icon={<Users size={17} />}
          tone="teal"
        />
      </div>

      <NeuCard>
        <SectionHeader
          eyebrow="Pilar 1 · Pencapaian"
          title="Target vs Realisasi per Cabang"
          description={
            rows.length > CHART_LIMIT
              ? `Menampilkan ${CHART_LIMIT} cabang dengan realisasi tertinggi dari ${rows.length} cabang. Buka tabel untuk daftar lengkap.`
              : "Perbandingan baki debet realisasi terhadap target pada periode berjalan."
          }
          icon={<Building2 size={18} />}
          action={
            <button
              type="button"
              onClick={() => setShowTable((state) => !state)}
              className="neu-press text-ink-700 rounded-2xl px-4 py-2 text-xs font-bold"
              aria-pressed={showTable}
            >
              {showTable ? "Lihat Grafik" : "Lihat Tabel"}
            </button>
          }
        />

        {chartRows.length === 0 ? (
          <div className="neu-inset text-ink-500 rounded-2xl px-4 py-12 text-center text-sm">
            Tidak ada cabang yang cocok dengan filter saat ini.
          </div>
        ) : showTable ? (
          <TargetTable rows={rows} />
        ) : (
          <div className="neu-inset rounded-2xl p-4 pt-6">
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid
                  vertical={false}
                  stroke="var(--color-ink-300)"
                  strokeOpacity={0.35}
                />
                <XAxis
                  dataKey="cabang"
                  tick={{ fill: "var(--color-ink-500)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={-22}
                  textAnchor="end"
                  height={70}
                />
                <YAxis
                  tickFormatter={(value: number) => formatRupiahShort(value)}
                  tick={{ fill: "var(--color-ink-500)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={78}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-ink-300)", fillOpacity: 0.18 }}
                  content={<ChartTooltip />}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={34}
                  formatter={(value) => (
                    <span className="text-ink-700 text-xs font-semibold">{value}</span>
                  )}
                />
                <Bar
                  dataKey="realisasi"
                  name="Realisasi"
                  fill={COLOR_REALISASI}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={26}
                />
                <Bar
                  dataKey="target"
                  name="Target"
                  fill={COLOR_TARGET}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={26}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </NeuCard>
    </div>
  );
}

type TooltipPayload = { name?: string; value?: number; color?: string };

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const target = payload.find((item) => item.name === "Target")?.value ?? 0;
  const realisasi = payload.find((item) => item.name === "Realisasi")?.value ?? 0;
  const pencapaian = target ? (realisasi / target) * 100 : 0;

  return (
    <div className="neu rounded-2xl px-4 py-3 text-xs shadow-lg">
      <p className="text-ink-900 mb-2 font-bold">{label}</p>
      {payload.map((item) => (
        <p key={item.name} className="text-ink-700 flex items-center gap-2 py-0.5">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
            aria-hidden
          />
          <span className="min-w-16">{item.name}</span>
          <strong className="text-ink-900 ml-auto">{formatRupiah(item.value ?? 0)}</strong>
        </p>
      ))}
      <p className="border-ink-300/40 text-ink-700 mt-2 border-t pt-2">
        Pencapaian <strong className="text-ink-900">{formatPercent(pencapaian)}</strong>
      </p>
    </div>
  );
}

function TargetTable({ rows }: { rows: TargetVsRealisasiRow[] }) {
  const columns: Column<TargetVsRealisasiRow>[] = [
    {
      key: "cabang",
      header: "Cabang / KCP",
      render: (row) => <span className="text-ink-900 font-semibold">{row.cabang}</span>,
    },
    {
      key: "target",
      header: "Target",
      align: "right",
      render: (row) => formatRupiahShort(row.target),
    },
    {
      key: "realisasi",
      header: "Realisasi",
      align: "right",
      render: (row) => (
        <span className="text-ink-900 font-semibold">{formatRupiahShort(row.realisasi)}</span>
      ),
    },
    {
      key: "gap",
      header: "Gap",
      align: "right",
      render: (row) => {
        const gap = row.realisasi - row.target;
        return (
          <span
            className={gap >= 0 ? "text-state-good-text font-semibold" : "text-state-bad-text"}
          >
            {gap >= 0 ? "+" : ""}
            {formatRupiahShort(gap)}
          </span>
        );
      },
    },
    {
      key: "achievement",
      header: "Pencapaian",
      align: "right",
      render: (row) => (
        <div className="flex min-w-36 flex-col items-end gap-1.5">
          <Badge tone={row.achievementPercent >= 100 ? "good" : row.achievementPercent >= 90 ? "warn" : "bad"}>
            {formatPercent(row.achievementPercent)}
          </Badge>
          <ProgressBar
            value={row.achievementPercent}
            tone={row.achievementPercent >= 100 ? "good" : row.achievementPercent >= 90 ? "warn" : "bad"}
          />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.cabang}
      maxHeight="24rem"
      emptyMessage="Belum ada data cabang untuk filter ini."
    />
  );
}
