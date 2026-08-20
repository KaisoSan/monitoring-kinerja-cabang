import { formatNumber, formatPercent, formatRupiah, formatRupiahShort, ratio } from "@/lib/format";

/**
 * Daftar batang proporsi bernilai tunggal.
 *
 * Dipakai bersama oleh Pilar Kualitas Kredit dan seksi Data Akun supaya
 * sebaran DPD maupun komposisi kolektibilitas terbaca dengan cara yang sama.
 */
export type DistributionRow = {
  key: string;
  label: string;
  jumlah: number;
  nominal: number;
  color: string;
};

export function DistributionList({ rows, total }: { rows: DistributionRow[]; total: number }) {
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

