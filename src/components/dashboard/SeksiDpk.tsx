"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingDown, Users, Wallet } from "lucide-react";
import { NeuCard, SectionHeader } from "@/components/ui/NeuCard";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Column, DataTable } from "@/components/ui/DataTable";
import { DashboardStatusInline } from "./DashboardStatus";
import {
  formatNumber,
  formatPeriode,
  formatRupiah,
  formatRupiahShort,
} from "@/lib/format";
import type { DpkData, DpkRow } from "@/lib/data";

/** Satu seri tunggal: panjang batang sudah mewakili besarnya penurunan. */
const COLOR_TURUN = "var(--color-chart-target)";
const CHART_LIMIT = 12;

export function SeksiDpk({ data }: { data: DpkData }) {
  const [outlet, setOutlet] = useState<string | null>(null);

  const outlets = useMemo(
    () => [...new Set(data.rows.map((row) => row.outlet))].sort((a, b) => a.localeCompare(b, "id-ID")),
    [data.rows],
  );

  const rows = useMemo(
    () => (outlet ? data.rows.filter((row) => row.outlet === outlet) : data.rows),
    [data.rows, outlet],
  );

  const ringkasan = useMemo(() => {
    const totalDelta = rows.reduce((sum, row) => sum + row.delta_saldo, 0);
    const totalAwal = rows.reduce((sum, row) => sum + row.saldo_awal, 0);
    const totalAkhir = rows.reduce((sum, row) => sum + row.saldo_akhir, 0);
    return {
      totalDelta,
      totalAwal,
      totalAkhir,
      jumlahNasabah: rows.length,
      jumlahOutlet: new Set(rows.map((row) => row.outlet)).size,
    };
  }, [rows]);

  // Batang menampilkan besaran penurunan (nilai positif), karena sumbu yang
  // seluruhnya negatif lebih sulit dibaca daripada judul yang menyebut arahnya.
  const perOutlet = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.outlet, (map.get(row.outlet) ?? 0) + row.delta_saldo);
    }
    return [...map.entries()]
      .map(([nama, delta]) => ({ outlet: nama, penurunan: Math.abs(delta) }))
      .sort((a, b) => b.penurunan - a.penurunan)
      .slice(0, CHART_LIMIT);
  }, [rows]);

  if (data.state !== "ok" || data.rows.length === 0) {
    return (
      <NeuCard>
        <SectionHeader
          eyebrow="DPK"
          title="Top Looser DPK"
          description="Penurunan saldo dana pihak ketiga per nasabah."
          icon={<TrendingDown size={18} />}
        />
        <DashboardStatusInline
          state={data.state}
          message={data.message}
          kosongJudul="Belum ada data DPK"
          kosongPesan="Unggah berkas Top 30 Looser lewat halaman admin dengan tujuan tabel DPK."
        />
      </NeuCard>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Penurunan Saldo"
          value={formatRupiahShort(ringkasan.totalDelta)}
          hint={formatRupiah(ringkasan.totalDelta)}
          icon={<TrendingDown size={17} />}
          tone="bad"
        />
        <StatCard
          label="Saldo Posisi Awal"
          value={formatRupiahShort(ringkasan.totalAwal)}
          icon={<Wallet size={17} />}
          tone="teal"
          hint={data.tanggalAwal ?? "-"}
        />
        <StatCard
          label="Saldo Posisi Akhir"
          value={formatRupiahShort(ringkasan.totalAkhir)}
          icon={<Wallet size={17} />}
          tone="orange"
          hint={data.tanggalAkhir ?? "-"}
        />
        <StatCard
          label="Nasabah Terpantau"
          value={formatNumber(ringkasan.jumlahNasabah)}
          hint={`${formatNumber(ringkasan.jumlahOutlet)} outlet`}
          icon={<Users size={17} />}
          tone="teal"
        />
      </div>

      <NeuCard>
        <SectionHeader
          eyebrow="DPK · Top Looser"
          title="Penurunan Saldo per Outlet"
          description={`Periode ${formatPeriode(data.periode)}${
            data.tanggalAwal && data.tanggalAkhir
              ? ` · pembanding ${data.tanggalAwal} terhadap ${data.tanggalAkhir}`
              : ""
          }. Sumber: berkas Top 30 Looser — tidak mengikuti Slicer Global di atas.`}
          icon={<TrendingDown size={18} />}
          action={
            outlets.length > 1 ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setOutlet(null)}
                  className={`neu-press rounded-2xl px-4 py-2 text-xs font-bold ${
                    outlet === null ? "text-bni-teal-700" : "text-ink-700"
                  }`}
                >
                  Semua Outlet
                </button>
                {outlets.map((nama) => (
                  <button
                    key={nama}
                    type="button"
                    onClick={() => setOutlet(nama)}
                    className={`neu-press rounded-2xl px-4 py-2 text-xs font-bold ${
                      outlet === nama ? "text-bni-teal-700" : "text-ink-700"
                    }`}
                  >
                    {nama}
                  </button>
                ))}
              </div>
            ) : null
          }
        />

        <div className="neu-inset mb-5 rounded-2xl p-4 pt-6">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={perOutlet} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--color-ink-300)" strokeOpacity={0.35} />
              <XAxis
                dataKey="outlet"
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
                content={<TooltipPenurunan />}
              />
              <Bar
                dataKey="penurunan"
                name="Penurunan saldo"
                fill={COLOR_TURUN}
                radius={[4, 4, 0, 0]}
                maxBarSize={30}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <TabelDpk rows={rows} />
      </NeuCard>
    </div>
  );
}

function TooltipPenurunan({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value?: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="neu rounded-2xl px-4 py-3 text-xs shadow-lg">
      <p className="text-ink-900 mb-1 font-bold">{label}</p>
      <p className="text-ink-700">
        Penurunan saldo{" "}
        <strong className="text-ink-900">{formatRupiah(payload[0]?.value ?? 0)}</strong>
      </p>
    </div>
  );
}

function TabelDpk({ rows }: { rows: DpkRow[] }) {
  const columns: Column<DpkRow>[] = [
    {
      key: "outlet",
      header: "Outlet",
      render: (row) => (
        <div className="min-w-0">
          <p className="text-ink-900 truncate font-semibold">{row.outlet}</p>
          <p className="text-ink-500 truncate text-xs">{row.cabang}</p>
        </div>
      ),
    },
    {
      key: "nama",
      header: "Nasabah",
      render: (row) => (
        <div className="min-w-0">
          <p className="text-ink-900 truncate font-semibold">{row.nama}</p>
          <p className="text-ink-500 truncate text-xs">CIF {row.cif}</p>
        </div>
      ),
    },
    {
      key: "segmen",
      header: "Segmen",
      render: (row) => <Badge tone="neutral">{row.segmen || "-"}</Badge>,
    },
    {
      key: "awal",
      header: "Saldo Awal",
      align: "right",
      render: (row) => (
        <span title={formatRupiah(row.saldo_awal)}>{formatRupiahShort(row.saldo_awal)}</span>
      ),
    },
    {
      key: "akhir",
      header: "Saldo Akhir",
      align: "right",
      render: (row) => (
        <span title={formatRupiah(row.saldo_akhir)}>{formatRupiahShort(row.saldo_akhir)}</span>
      ),
    },
    {
      key: "delta",
      header: "Selisih",
      align: "right",
      render: (row) => (
        <span
          className={
            row.delta_saldo < 0
              ? "text-state-bad-text font-semibold"
              : "text-state-good-text font-semibold"
          }
          title={formatRupiah(row.delta_saldo)}
        >
          {formatRupiahShort(row.delta_saldo)}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(row) => `${row.outlet}-${row.cif}`}
      maxHeight="28rem"
      emptyMessage="Tidak ada nasabah pada outlet ini."
    />
  );
}
