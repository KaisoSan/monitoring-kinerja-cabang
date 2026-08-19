"use client";

import { ShieldAlert, ShieldCheck, ShieldX, Timer } from "lucide-react";
import { NeuCard, SectionHeader } from "@/components/ui/NeuCard";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Column, DataTable } from "@/components/ui/DataTable";
import {
  formatNumber,
  formatPercent,
  formatRupiah,
  formatRupiahShort,
  ratio,
} from "@/lib/format";
import type { KualitasPerCabangRow, KualitasSummary } from "@/lib/metrics";

/** Ambang risiko yang lazim dipakai di perbankan (dalam persen). */
const NPL_WARN = 3;
const NPL_BAD = 5;
const LAR_WARN = 8;
const LAR_BAD = 12;

const SEVERITY = [
  "var(--color-sev-1)",
  "var(--color-sev-2)",
  "var(--color-sev-3)",
  "var(--color-sev-4)",
  "var(--color-sev-5)",
];

const KOL_LABELS = ["Lancar", "Dalam Perhatian Khusus", "Kurang Lancar", "Diragukan", "Macet"];

function toneFor(value: number, warn: number, bad: number) {
  if (value >= bad) return "bad" as const;
  if (value >= warn) return "warn" as const;
  return "good" as const;
}

export function PilarKualitas({
  summary,
  perCabang,
}: {
  summary: KualitasSummary;
  perCabang: KualitasPerCabangRow[];
}) {
  const nplTone = toneFor(summary.nplRatio, NPL_WARN, NPL_BAD);
  const larTone = toneFor(summary.larRatio, LAR_WARN, LAR_BAD);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Baki Debet Sehat"
          value={formatRupiahShort(summary.totalBakiDebet - summary.larNominal)}
          hint={`${formatPercent(100 - summary.larRatio)} dari total portofolio`}
          icon={<ShieldCheck size={17} />}
          tone="good"
        />
        <StatCard
          label="LAR (Loan at Risk)"
          value={formatPercent(summary.larRatio)}
          hint={formatRupiah(summary.larNominal)}
          icon={<ShieldAlert size={17} />}
          tone={larTone}
          progress={{
            value: Math.min(summary.larRatio * (100 / LAR_BAD), 100),
            tone: larTone,
            caption: `Ambang perhatian ${formatPercent(LAR_WARN, 0)} · batas ${formatPercent(LAR_BAD, 0)}`,
          }}
        />
        <StatCard
          label="NPL (Non Performing Loan)"
          value={formatPercent(summary.nplRatio)}
          hint={`${formatNumber(summary.jumlahDebiturNpl)} debitur · ${formatRupiah(summary.nplNominal)}`}
          icon={<ShieldX size={17} />}
          tone={nplTone}
          progress={{
            value: Math.min(summary.nplRatio * (100 / NPL_BAD), 100),
            tone: nplTone,
            caption: `Ambang perhatian ${formatPercent(NPL_WARN, 0)} · batas ${formatPercent(NPL_BAD, 0)}`,
          }}
        />
        <StatCard
          label="Portofolio Menunggak (DPD > 0)"
          value={formatPercent(summary.dpdRatio)}
          hint={`${formatNumber(summary.jumlahDebiturDpd)} debitur · ${formatRupiahShort(summary.dpdNominal)}`}
          icon={<Timer size={17} />}
          tone={summary.dpdRatio >= 10 ? "bad" : summary.dpdRatio >= 5 ? "warn" : "good"}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <NeuCard>
          <SectionHeader
            eyebrow="Pilar 4 · Kualitas Kredit"
            title="Sebaran Tunggakan (DPD)"
            description="Nominal baki debet per kelompok hari tunggakan. Warna makin gelap menandakan risiko makin tinggi."
            icon={<Timer size={18} />}
          />
          <DistributionList
            rows={summary.dpdBuckets.map((bucket, index) => ({
              key: bucket.key,
              label: bucket.label,
              jumlah: bucket.jumlah,
              nominal: bucket.nominal,
              color: SEVERITY[index],
            }))}
            total={summary.totalBakiDebet}
          />
        </NeuCard>

        <NeuCard>
          <SectionHeader
            eyebrow="Pilar 4 · Kualitas Kredit"
            title="Komposisi Kolektibilitas"
            description="Kol 1-2 tergolong performing, Kol 3-5 masuk hitungan NPL."
            icon={<ShieldAlert size={18} />}
          />
          <DistributionList
            rows={summary.kolektibilitas.map((entry, index) => ({
              key: `kol-${entry.kol}`,
              label: `Kol ${entry.kol} · ${KOL_LABELS[index]}`,
              jumlah: entry.jumlah,
              nominal: entry.nominal,
              color: SEVERITY[index],
            }))}
            total={summary.totalBakiDebet}
          />
        </NeuCard>
      </div>

      <NeuCard>
        <SectionHeader
          eyebrow="Pilar 4 · Kualitas Kredit"
          title="Indikator Risiko per Cabang"
          description="Diurutkan dari rasio NPL tertinggi agar cabang yang perlu atensi langsung terlihat."
          icon={<ShieldX size={18} />}
        />
        <KualitasTable rows={perCabang} />
      </NeuCard>
    </div>
  );
}

type DistributionRow = {
  key: string;
  label: string;
  jumlah: number;
  nominal: number;
  color: string;
};

function DistributionList({ rows, total }: { rows: DistributionRow[]; total: number }) {
  if (total === 0) {
    return (
      <div className="neu-inset text-ink-500 rounded-2xl px-4 py-10 text-center text-sm">
        Belum ada baki debet pada filter ini.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const share = ratio(row.nominal, total);
        return (
          <li key={row.key}>
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-ink-700 flex items-center gap-2 text-sm font-semibold">
                <span
                  className="size-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: row.color }}
                  aria-hidden
                />
                {row.label}
              </span>
              <span className="text-ink-500 text-xs">
                {formatNumber(row.jumlah)} debitur ·{" "}
                <strong className="text-ink-900" title={formatRupiah(row.nominal)}>
                  {formatRupiahShort(row.nominal)}
                </strong>{" "}
                ({formatPercent(share)})
              </span>
            </div>
            <div className="neu-inset-sm h-2.5 w-full overflow-hidden rounded-full">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${Math.min(share, 100)}%`, backgroundColor: row.color }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function KualitasTable({ rows }: { rows: KualitasPerCabangRow[] }) {
  const columns: Column<KualitasPerCabangRow>[] = [
    {
      key: "cabang",
      header: "Cabang / KCP",
      render: (row) => <span className="text-ink-900 font-semibold">{row.cabang}</span>,
    },
    {
      key: "baki",
      header: "Baki Debet",
      align: "right",
      render: (row) => (
        <span title={formatRupiah(row.bakiDebet)}>{formatRupiahShort(row.bakiDebet)}</span>
      ),
    },
    {
      key: "lar",
      header: "LAR",
      align: "right",
      render: (row) => (
        <div className="flex flex-col items-end gap-1">
          <Badge tone={toneFor(row.larRatio, LAR_WARN, LAR_BAD)}>
            {formatPercent(row.larRatio)}
          </Badge>
          <span className="text-ink-500 text-xs">{formatRupiahShort(row.larNominal)}</span>
        </div>
      ),
    },
    {
      key: "npl",
      header: "NPL",
      align: "right",
      render: (row) => (
        <div className="flex flex-col items-end gap-1">
          <Badge tone={toneFor(row.nplRatio, NPL_WARN, NPL_BAD)}>
            {formatPercent(row.nplRatio)}
          </Badge>
          <span className="text-ink-500 text-xs">{formatRupiahShort(row.nplNominal)}</span>
        </div>
      ),
    },
    {
      key: "dpd",
      header: "Debitur DPD",
      align: "right",
      render: (row) => formatNumber(row.debiturDpd),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.cabang}
      maxHeight="24rem"
      emptyMessage="Belum ada portofolio booking pada filter ini."
    />
  );
}
