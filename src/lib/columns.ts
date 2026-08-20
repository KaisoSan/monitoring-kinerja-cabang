import { toSnakeCase } from "./excel";
import type { KreditRecord } from "./types";

/**
 * Definisi kolom untuk Tabel Data Detail.
 *
 * `SOURCE_COLUMNS` memuat 86 nama kolom persis seperti di file sumber.
 * Urutannya dipertahankan: tabel selalu merender kolom dalam urutan ini,
 * berapa pun kolom yang sedang dicentang, supaya posisi kolom tidak
 * berpindah-pindah saat pengguna mengubah pilihan.
 */
export const SOURCE_COLUMNS = [
  "No",
  ".Tanggal.",
  "Kode Cab.",
  "Nama Cab",
  "KodeKLN.",
  "Sentra Code.",
  "KodeKCP.",
  "Account Type.",
  "Sub Category.",
  "Produk",
  "Peruntukan",
  "Currency.",
  "Kurs:",
  "CIF.",
  "No Rek.",
  "Nama Nas",
  "Kol.",
  "Maks Krd",
  "Ijin Tarik",
  "Saldo Pokok",
  "Tgk Pokok",
  "Tgk Bunga",
  "Denda",
  "Tgk Biaya",
  "Bk Debet",
  "Bk Dbt (IDR)",
  "Disponible",
  "Suku Bunga:",
  "Suku Bunga Efektif:",
  "JW",
  "Jth Tempo.",
  "Umur Tgk (hr)",
  "Kode Segmen.",
  "Kode_SektorEk_New",
  "SektorEk_Desc_New",
  "20Group_SektorEk_New",
  "20Group_SektorEk_Desc_New",
  "NPP.",
  "Nama Pengelola",
  "Propisi",
  "Pembebanan Bunga",
  "PPAP (IDR)",
  "No Rek Afi.",
  "CCY Rek Afi.",
  "Jadwal Angs Pok",
  "Akum By Bg Akrual",
  "By Bg Harian",
  "Saldo Akhir Afi",
  "Saldo Blokir Afi",
  "Saldo Efektif Afi",
  "KodeInst.",
  "Institusi",
  "TglBukaRek.",
  "Tgl PK.",
  "No_PK",
  "Restrukturisasi",
  "KODE_FLAG_COVID.",
  "DESK_FLAG_COVID",
  "Ang_Pokok (IDR)",
  "Tunda_Jatuh_Tempo",
  "Tanggal_Tunda_JT",
  "Tipe_Debitur",
  "SPECIAL_INT_RATE",
  "GROSS_RATE",
  "FLAG_ESG",
  "Nama_Flag_ESG",
  "KODE_GRUP_PERUSAHAAN",
  "ID_REFERRAL_SAPM",
  "CLEAN_BASIS",
  "FLAG_XPORA",
  "JENIS KREDIT",
  "JENIS KUR",
  "OUTLET",
  "KET KOL 1",
  "KEWAJIBAN DSPA",
  "KEWAJIBAN DSRA",
  "AFIL-KEWAJIBAN",
  "AFIL-KEWAJIBAN DSPA",
  "DSPA",
  "DSRA",
  "KETERSEDIAAN DSPA",
  "Jth Tempo - Tgl",
  "Jth Tempo - Bulan",
  "Jth Tempo - Tahun",
  "Jth Tempo - KET",
  "CEK BCM",
] as const;

export type SourceColumnLabel = (typeof SOURCE_COLUMNS)[number];

/** Kolom yang tampil saat dashboard pertama kali dibuka. */
export const DEFAULT_VISIBLE_COLUMNS: string[] = [
  "Nama Cab",
  "Nama Pengelola",
  "Nama Nas",
  "Bk Debet",
  "Kol.",
  "CEK BCM",
];

export type CellFormat = "text" | "number" | "currency" | "percent" | "date";

export type DetailColumn = {
  /** Nama kolom persis seperti di file sumber. */
  label: string;
  /** Kunci pada snapshot `raw`, hasil `toSnakeCase(label)`. */
  key: string;
  format: CellFormat;
  align: "left" | "right" | "center";
  /**
   * Field bertipe yang dipakai bila kolom tidak ada di snapshot `raw`,
   * mis. pada data yang diunggah sebelum snapshot diaktifkan.
   */
  fallback?: keyof KreditRecord;
};

const CURRENCY_COLUMNS = new Set<string>([
  "Maks Krd", "Ijin Tarik", "Saldo Pokok", "Tgk Pokok", "Tgk Bunga",
  "Denda", "Tgk Biaya", "Bk Debet", "Bk Dbt (IDR)", "Disponible", "Propisi",
  "PPAP (IDR)", "Akum By Bg Akrual", "By Bg Harian", "Saldo Akhir Afi",
  "Saldo Blokir Afi", "Saldo Efektif Afi", "Ang_Pokok (IDR)",
  "KEWAJIBAN DSPA", "KEWAJIBAN DSRA", "AFIL-KEWAJIBAN",
  "AFIL-KEWAJIBAN DSPA", "DSPA", "DSRA",
]);

const PERCENT_COLUMNS = new Set<string>([
  "Suku Bunga:", "Suku Bunga Efektif:", "SPECIAL_INT_RATE", "GROSS_RATE",
]);

const NUMBER_COLUMNS = new Set<string>([
  "No", "Kurs:", "Kol.", "JW", "Umur Tgk (hr)",
  "Jth Tempo - Tgl", "Jth Tempo - Bulan", "Jth Tempo - Tahun",
]);

const DATE_COLUMNS = new Set<string>([
  ".Tanggal.", "Jth Tempo.", "TglBukaRek.", "Tgl PK.", "Tanggal_Tunda_JT",
]);

/** Kolom yang punya padanan di field bertipe `KreditRecord`. */
const FALLBACKS: Record<string, keyof KreditRecord> = {
  ".Tanggal.": "periode",
  "Nama Cab": "cabang",
  Produk: "produk",
  "No Rek.": "kode_fasilitas",
  "Nama Nas": "nama_debitur",
  "Kol.": "kolektibilitas",
  "Maks Krd": "plafon",
  "Bk Debet": "baki_debet",
  "Bk Dbt (IDR)": "baki_debet",
  "Umur Tgk (hr)": "dpd",
  "Nama Pengelola": "pengelola",
  Restrukturisasi: "is_restruktur",
};

function formatFor(label: string): CellFormat {
  if (CURRENCY_COLUMNS.has(label)) return "currency";
  if (PERCENT_COLUMNS.has(label)) return "percent";
  if (NUMBER_COLUMNS.has(label)) return "number";
  if (DATE_COLUMNS.has(label)) return "date";
  return "text";
}

export const DETAIL_COLUMNS: DetailColumn[] = SOURCE_COLUMNS.map((label) => {
  const format = formatFor(label);
  return {
    label,
    key: toSnakeCase(label),
    format,
    align: format === "currency" || format === "number" || format === "percent"
      ? "right"
      : "left",
    fallback: FALLBACKS[label],
  };
});

export const DETAIL_COLUMNS_BY_LABEL = new Map(
  DETAIL_COLUMNS.map((column) => [column.label, column]),
);

/**
 * Mengambil nilai satu sel: utamakan snapshot kolom asli, lalu jatuh ke
 * field bertipe bila tersedia.
 */
export function getCellValue(record: KreditRecord, column: DetailColumn): unknown {
  const raw = record.raw;
  if (raw && Object.hasOwn(raw, column.key)) {
    const value = raw[column.key];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return column.fallback ? record[column.fallback] : null;
}
