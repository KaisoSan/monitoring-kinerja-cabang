"use client";

import { useMemo } from "react";
import { Layers, ShieldX, Timer, Wallet } from "lucide-react";
import { NeuCard, SectionHeader } from "@/components/ui/NeuCard";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Column, DataTable } from "@/components/ui/DataTable";
import { DistributionList } from "@/components/ui/DistributionList";
import { DashboardStatusInline } from "./DashboardStatus";
import {
  formatNumber,
  formatPercent,
  formatPeriode,
  formatRupiah,
  formatRupiahShort,
  ratio,
} from "@/lib/format";
import type { AkunCabangRow, AkunData } from "@/lib/data";

/** Ambang NPL yang sama dengan Pilar Kualitas Kredit. */
const NPL_WARN = 3;
const NPL_BAD = 5;

/** Ramp sekuensial 8 langkah untuk kategori DPD. */
const DPD_COLORS = [1, 2, 3, 4, 5, 6, 7, 8].map((step) => `var(--color-dpd-${step})`);

const SUMBER_LABEL: Record<string, string> = {
  old: "OLD_ACCOUNT",
  new: "NEW_ACCOUNT",
};

function toneFor(value: number) {
  if (value >= NPL_BAD) return "bad" as const;
  if (value >= NPL_WARN) return "warn" as const;
  return "good" as const;
}

export function SeksiAkun({ data }: { data: AkunData }) {
  /** View memisahkan OLD dan NEW; keduanya digabung per cabang di sini. */
  const perCabang = useMemo(() => {
    const map = new Map<string, AkunCabangRow>();
    for (const row of data.cabang) {
      const key = `${row.area}|${row.branch_name}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...row, sumber: "gabungan" });
        continue;
      }
      existing.jumlah_rekening += row.jumlah_rekening;
      existing.total_baki_debet += row.total_baki_debet;
      existing.total_tunggakan += row.total_tunggakan;
      existing.jumlah_npl += row.jumlah_npl;
      existing.baki_debet_npl += row.baki_debet_npl;
      existing.jumlah_menunggak += row.jumlah_menunggak;
    }
    return [...map.values()].sort((a, b) => b.total_baki_debet - a.total_baki_debet);
  }, [data.cabang]);

  const ringkasan = useMemo(() => {
    const total = perCabang.reduce(
      (acc, row) => ({
        rekening: acc.rekening + row.jumlah_rekening,
        bakiDebet: acc.bakiDebet + row.total_baki_debet,
        tunggakan: acc.tunggakan + row.total_tunggakan,
        npl: acc.npl + row.jumlah_npl,
        bakiNpl: acc.bakiNpl + row.baki_debet_npl,
        menunggak: acc.menunggak + row.jumlah_menunggak,
      }),
      { rekening: 0, bakiDebet: 0, tunggakan: 0, npl: 0, bakiNpl: 0, menunggak: 0 },
    );
    return { ...total, nplRatio: ratio(total.bakiNpl, total.bakiDebet) };
  }, [perCabang]);

  /** Kategori DPD sudah berawalan angka pada berkas, jadi urutannya alami. */
  const sebaranDpd = useMemo(() => {
    const map = new Map<string, { jumlah: number; nominal: number }>();
    for (const row of data.dpd) {
      const existing = map.get(row.dpd_kategori) ?? { jumlah: 0, nominal: 0 };
      existing.jumlah += row.jumlah_rekening;
      existing.nominal += row.total_baki_debet;
      map.set(row.dpd_kategori, existing);
    }
    const entries = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "id-ID"));
    return entries.map(([label, value], index) => ({
      key: label,
      label,
      jumlah: value.jumlah,
      nominal: value.nominal,
      color: DPD_COLORS[Math.min(index, DPD_COLORS.length - 1)],
    }));
  }, [data.dpd]);

  const perSumber = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of data.cabang) {
      map.set(row.sumber, (map.get(row.sumber) ?? 0) + row.jumlah_rekening);
    }
    return [...map.entries()];
  }, [data.cabang]);

  if (data.state !== "ok" || perCabang.length === 0) {
    return (
      <NeuCard>
        <SectionHeader
          eyebrow="Data Akun"
          title="Portofolio Akun"
          description="Ringkasan rekening dari sheet OLD_ACCOUNT dan NEW_ACCOUNT."
          icon={<Layers size={18} />}
        />
        <DashboardStatusInline
          state={data.state}
          message={data.message}
          kosongJudul="Belum ada data akun"
          kosongPesan="Unggah berkas akun lewat halaman admin dengan tujuan tabel Data Akun."
        />
      </NeuCard>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Baki Debet"
          value={formatRupiahShort(ringkasan.bakiDebet)}
          hint={formatRupiah(ringkasan.bakiDebet)}
          icon={<Wallet size={17} />}
          tone="teal"
        />
        <StatCard
          label="Jumlah Rekening"
          value={formatNumber(ringkasan.rekening)}
          hint={`${formatNumber(perCabang.length)} cabang`}
          icon={<Layers size={17} />}
          tone="teal"
        />
        <StatCard
          label="NPL (Kol 3-5)"
          value={formatPercent(ringkasan.nplRatio)}
          hint={`${formatNumber(ringkasan.npl)} rekening · ${formatRupiahShort(ringkasan.bakiNpl)}`}
          icon={<ShieldX size={17} />}
          tone={toneFor(ringkasan.nplRatio)}
          progress={{
            value: Math.min(ringkasan.nplRatio * (100 / NPL_BAD), 100),
            tone: toneFor(ringkasan.nplRatio),
            caption: `Ambang perhatian ${formatPercent(NPL_WARN, 0)} · batas ${formatPercent(NPL_BAD, 0)}`,
          }}
        />
        <StatCard
          label="Rekening Menunggak"
          value={formatNumber(ringkasan.menunggak)}
          hint={`Total tunggakan ${formatRupiahShort(ringkasan.tunggakan)}`}
          icon={<Timer size={17} />}
          tone={ringkasan.menunggak > 0 ? "warn" : "good"}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <NeuCard>
          <SectionHeader
            eyebrow="Data Akun"
            title="Sebaran Hari Tunggakan (DPD)"
            description="Kelompok DPD apa adanya dari berkas sumber. Warna makin gelap menandakan risiko makin tinggi."
            icon={<Timer size={18} />}
          />
          <DistributionList rows={sebaranDpd} total={ringkasan.bakiDebet} />
        </NeuCard>

        <NeuCard>
          <SectionHeader
            eyebrow="Data Akun"
            title="Portofolio per Cabang"
            description={`Periode ${formatPeriode(data.periode)}. Sumber: berkas akun — tidak mengikuti Slicer Global di atas.`}
            icon={<Layers size={18} />}
            action={
              <div className="flex flex-wrap gap-2">
                {perSumber.map(([sumber, jumlah]) => (
                  <Badge key={sumber} tone={sumber === "old" ? "teal" : "orange"}>
                    {SUMBER_LABEL[sumber] ?? sumber}: {formatNumber(jumlah)}
                  </Badge>
                ))}
              </div>
            }
          />
          <TabelAkunCabang rows={perCabang} />
        </NeuCard>
      </div>
    </div>
  );
}

function TabelAkunCabang({ rows }: { rows: AkunCabangRow[] }) {
  const columns: Column<AkunCabangRow>[] = [
    {
      key: "cabang",
      header: "Cabang",
      render: (row) => (
        <div className="min-w-0">
          <p className="text-ink-900 truncate font-semibold">{row.branch_name}</p>
          <p className="text-ink-500 truncate text-xs">{row.area}</p>
        </div>
      ),
    },
    {
      key: "rekening",
      header: "Rekening",
      align: "right",
      render: (row) => formatNumber(row.jumlah_rekening),
    },
    {
      key: "baki",
      header: "Baki Debet",
      align: "right",
      render: (row) => (
        <span title={formatRupiah(row.total_baki_debet)}>
          {formatRupiahShort(row.total_baki_debet)}
        </span>
      ),
    },
    {
      key: "npl",
      header: "NPL",
      align: "right",
      render: (row) => {
        const nplRatio = ratio(row.baki_debet_npl, row.total_baki_debet);
        return (
          <div className="flex flex-col items-end gap-1">
            <Badge tone={toneFor(nplRatio)}>{formatPercent(nplRatio)}</Badge>
            <span className="text-ink-500 text-xs">{formatNumber(row.jumlah_npl)} rekening</span>
          </div>
        );
      },
    },
    {
      key: "tunggakan",
      header: "Tunggakan",
      align: "right",
      render: (row) => (
        <span title={formatRupiah(row.total_tunggakan)}>
          {formatRupiahShort(row.total_tunggakan)}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(row) => `${row.area}-${row.branch_name}`}
      maxHeight="24rem"
      emptyMessage="Belum ada ringkasan cabang."
    />
  );
}
