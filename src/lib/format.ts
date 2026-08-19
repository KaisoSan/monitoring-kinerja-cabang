const RUPIAH_UNITS = [
  { limit: 1_000_000_000_000, suffix: " T", divisor: 1_000_000_000_000 },
  { limit: 1_000_000_000, suffix: " M", divisor: 1_000_000_000 },
  { limit: 1_000_000, suffix: " Jt", divisor: 1_000_000 },
  { limit: 1_000, suffix: " Rb", divisor: 1_000 },
] as const;

/** Format ringkas untuk kartu & sumbu grafik, mis. `Rp 1,24 M`. */
export function formatRupiahShort(value: number): string {
  if (!Number.isFinite(value)) return "-";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const unit = RUPIAH_UNITS.find((u) => abs >= u.limit);
  if (!unit) return `${sign}Rp ${Math.round(abs)}`;
  const scaled = abs / unit.divisor;
  const decimals = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  return `${sign}Rp ${scaled.toFixed(decimals).replace(".", ",")}${unit.suffix}`;
}

const idNumber = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** Format penuh untuk tooltip & tabel detail, mis. `Rp 1.240.000.000`. */
export function formatRupiah(value: number): string {
  if (!Number.isFinite(value)) return "-";
  return `Rp ${idNumber.format(Math.round(value))}`;
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "-";
  return idNumber.format(value);
}

export function formatPercent(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "-";
  return `${value.toFixed(decimals).replace(".", ",")}%`;
}

/** Persentase dengan tanda eksplisit, dipakai untuk growth. */
export function formatDelta(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals).replace(".", ",")}%`;
}

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** `2026-08-01` -> `Agustus 2026`. */
export function formatPeriode(iso: string | null | undefined): string {
  if (!iso) return "-";
  const [year, month] = iso.split("-");
  const index = Number(month) - 1;
  if (!year || Number.isNaN(index) || !MONTHS[index]) return iso;
  return `${MONTHS[index]} ${year}`;
}

/** Pembagian aman: mengembalikan 0 daripada NaN/Infinity saat penyebut nol. */
export function ratio(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  const result = (numerator / denominator) * 100;
  return Number.isFinite(result) ? result : 0;
}

/** Inisial untuk avatar leaderboard, maksimal 2 huruf. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
