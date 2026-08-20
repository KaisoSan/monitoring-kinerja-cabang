/**
 * Pembentuk dan pemvalidasi tanggal ISO `YYYY-MM-DD`.
 *
 * Dipisah dari `excel.ts` supaya route unggah di server bisa memakai
 * validasi yang sama tanpa ikut memuat pustaka pembaca Excel.
 *
 * Aturan utamanya: **jangan pernah menghasilkan tanggal yang tidak sah.**
 * Sebelumnya nilai seperti `2026-18-01` (bulan ke-18) dan `2026-02-31`
 * (31 Februari) lolos begitu saja karena komponennya hanya di-pad tanpa
 * diperiksa, lalu ditolak PostgreSQL dan menggagalkan seluruh batch.
 */

/** Rentang tahun yang masuk akal untuk laporan kredit. */
const MIN_YEAR = 1900;
const MAX_YEAR = 2200;

/** Ambang tahun dua digit: 00-69 dibaca 20xx, 70-99 dibaca 19xx. */
const CENTURY_PIVOT = 70;

const pad = (value: number) => String(value).padStart(2, "0");

/** `26` -> `2026`, `98` -> `1998`, `2026` -> `2026`. */
export function expandYear(year: number): number {
  if (!Number.isInteger(year) || year < 0) return Number.NaN;
  if (year >= 100) return year;
  return year < CENTURY_PIVOT ? 2000 + year : 1900 + year;
}

/**
 * Menyusun tanggal ISO dari komponennya, atau `null` bila kombinasinya tidak
 * ada di kalender. Pemeriksaan dilakukan lewat `Date.UTC` sehingga tanggal
 * seperti 31 April atau 29 Februari di tahun bukan kabisat ikut tertolak.
 */
export function toIsoFromParts(
  year: number,
  month: number,
  day: number,
): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  if (year < MIN_YEAR || year > MAX_YEAR) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${pad(month)}-${pad(day)}`;
}

const ISO_SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * `true` hanya bila string berbentuk `YYYY-MM-DD` **dan** tanggalnya benar
 * ada. Memeriksa bentuk saja tidak cukup: `2026-18-01` lolos pola tetapi
 * ditolak PostgreSQL.
 */
export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = ISO_SHAPE.exec(value);
  if (!match) return false;

  return (
    toIsoFromParts(Number(match[1]), Number(match[2]), Number(match[3])) === value
  );
}

/** Menormalkan tanggal ISO ke tanggal 1 pada bulan yang sama. */
export function toFirstOfMonth(iso: string): string | null {
  if (!isValidIsoDate(iso)) return null;
  return `${iso.slice(0, 7)}-01`;
}

/**
 * Memilih periode yang akan ditampilkan dashboard.
 *
 * Pilihan pengguna dipakai hanya bila periodenya benar-benar ada datanya.
 * Kalau tidak, dashboard jatuh ke periode terbaru — tautan lama yang menunjuk
 * bulan yang sudah dihapus sebaiknya menampilkan data terbaru daripada layar
 * kosong tanpa penjelasan.
 *
 * @param diminta Periode dari query string, boleh tidak sah atau kosong.
 * @param tersedia Daftar periode dari database, terbaru lebih dulu.
 */
export function pilihPeriode(
  diminta: string | null | undefined,
  tersedia: string[],
): string | null {
  if (diminta && isValidIsoDate(diminta) && tersedia.includes(diminta)) return diminta;
  return tersedia[0] ?? null;
}
