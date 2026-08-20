import * as XLSX from "xlsx";

import { sanitizeDeep, sanitizeText } from "./sanitize";
import { expandYear, toFirstOfMonth, toIsoFromParts } from "./dates";
import {
  PIPELINE_DROPPED,
  PIPELINE_STAGES,
  type KreditRecord,
  type StatusPipeline,
  type TargetCabang,
  type UploadDataset,
} from "./types";

/* ================================================================== */
/* 1. Pembersih nama kolom                                            */
/* ================================================================== */

/**
 * Membersihkan header Excel apa pun menjadi `snake_case`.
 *
 *   "  Nama Cabang / KCP "  -> "nama_cabang_kcp"
 *   "Baki Debet (Rp)"       -> "baki_debet_rp"
 *   "DPD  >90 Hari"         -> "dpd_90_hari"
 *   "Kolektibilitas\n(Kol)" -> "kolektibilitas_kol"
 */
export function toSnakeCase(header: string): string {
  return String(header ?? "")
    .normalize("NFKD")
    // buang diakritik
    .replace(/[\u0300-\u036f]/g, "")
    // sisipkan pemisah pada camelCase: "bakiDebet" -> "baki Debet"
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    // apa pun selain huruf/angka jadi pemisah
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Alias header yang lazim dipakai di file mentah cabang.
 * Kunci sudah dalam bentuk snake_case hasil `toSnakeCase`.
 */
const HEADER_ALIASES: Record<string, string> = {
  // identitas
  kode: "kode_fasilitas",
  kode_fasilitas: "kode_fasilitas",
  no_rek: "kode_fasilitas",
  no_rekening: "kode_fasilitas",
  nomor_rekening: "kode_fasilitas",
  no_aplikasi: "kode_fasilitas",
  nomor_aplikasi: "kode_fasilitas",

  // dimensi
  ah: "area_head",
  area: "area_head",
  area_head: "area_head",
  nama_area_head: "area_head",
  wilayah: "area_head",

  cabang: "cabang",
  kcp: "cabang",
  nama_cab: "cabang",
  nama_cabang: "cabang",
  nama_cabang_kcp: "cabang",
  cabang_kcp: "cabang",
  unit: "cabang",
  nama_unit: "cabang",

  produk: "produk",
  produk_kredit: "produk",
  jenis_kredit: "produk",
  jenis_produk: "produk",
  segmen: "produk",

  pengelola: "pengelola",
  nama_pengelola: "pengelola",
  rm: "pengelola",
  nama_rm: "pengelola",
  sales: "pengelola",
  nama_sales: "pengelola",
  account_officer: "pengelola",
  ao: "pengelola",

  debitur: "nama_debitur",
  nama_debitur: "nama_debitur",
  nama_nas: "nama_debitur",
  nama_nasabah: "nama_debitur",
  nasabah: "nama_debitur",

  // periode & status
  periode: "periode",
  tanggal: "periode",
  bulan: "periode",
  periode_laporan: "periode",
  tanggal_laporan: "periode",

  status: "status_pipeline",
  status_pipeline: "status_pipeline",
  status_kredit: "status_pipeline",
  tahapan: "status_pipeline",
  tahap: "status_pipeline",

  // nominal
  plafon: "plafon",
  plafond: "plafon",
  maks_krd: "plafon",
  maks_kredit: "plafon",
  plafon_rp: "plafon",
  limit: "plafon",
  nominal: "plafon",
  nominal_usulan: "plafon",

  os: "baki_debet",
  bk_debet: "baki_debet",
  bk_dbt: "baki_debet",
  outstanding: "baki_debet",
  baki_debet: "baki_debet",
  baki_debet_rp: "baki_debet",
  baki_debet_akhir: "baki_debet",

  os_awal: "baki_debet_awal",
  baki_debet_awal: "baki_debet_awal",
  baki_debet_awal_tahun: "baki_debet_awal",
  outstanding_awal: "baki_debet_awal",
  saldo_awal: "baki_debet_awal",

  // kualitas
  kol: "kolektibilitas",
  kolek: "kolektibilitas",
  kolektibilitas: "kolektibilitas",
  kolektibilitas_kol: "kolektibilitas",

  dpd: "dpd",
  dpd_hari: "dpd",
  umur_tgk: "dpd",
  tunggakan: "dpd",
  hari_tunggakan: "dpd",
  days_past_due: "dpd",

  restruktur: "is_restruktur",
  is_restruktur: "is_restruktur",
  restrukturisasi: "is_restruktur",
  flag_restruktur: "is_restruktur",

  tanggal_booking: "tanggal_booking",
  tgl_booking: "tanggal_booking",
  tanggal_realisasi: "tanggal_booking",

  // target
  target: "target_baki_debet",
  target_baki_debet: "target_baki_debet",
  target_os: "target_baki_debet",
  target_outstanding: "target_baki_debet",
  target_booking: "target_booking_nominal",
  target_booking_nominal: "target_booking_nominal",
};

/**
 * Satuan yang sering ditempel di belakang nama kolom, mis. "Plafond (Rp)"
 * atau "Target Outstanding (Juta)". Dilepas sebelum pencarian alias supaya
 * tabel alias tidak perlu memuat setiap kombinasi satuan.
 */
const UNIT_SUFFIXES = [
  "rp", "idr", "rupiah", "juta", "jt", "miliar", "milyar",
  "ribu", "hari", "hr", "persen", "pct", "x",
];

function stripUnitSuffix(snake: string): string {
  let result = snake;
  let changed = true;
  while (changed) {
    changed = false;
    for (const unit of UNIT_SUFFIXES) {
      const suffix = `_${unit}`;
      if (result.endsWith(suffix) && result.length > suffix.length) {
        result = result.slice(0, -suffix.length);
        changed = true;
      }
    }
  }
  return result;
}

/** Menyatukan pembersihan + pemetaan alias menjadi nama kolom kanonik. */
export function normalizeHeader(header: string): string {
  const snake = toSnakeCase(header);
  if (HEADER_ALIASES[snake]) return HEADER_ALIASES[snake];

  const stripped = stripUnitSuffix(snake);
  return HEADER_ALIASES[stripped] ?? stripped;
}

/* ================================================================== */
/* 2. Konversi nilai                                                  */
/* ================================================================== */

/**
 * Mengubah nilai sel menjadi angka, toleran terhadap format Indonesia
 * (`Rp 1.234.567,89`), format Inggris (`1,234,567.89`), tanda kurung
 * untuk negatif (`(500.000)`), dan sel kosong.
 */
export function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;

  let text = String(value).trim();
  if (!text || text === "-") return 0;

  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }

  text = text.replace(/rp/gi, "").replace(/\s/g, "");
  if (text.startsWith("-")) {
    negative = true;
    text = text.slice(1);
  }

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");

  if (lastComma > -1 && lastDot > -1) {
    // Pemisah desimal = tanda baca yang muncul paling akhir.
    const decimalSep = lastComma > lastDot ? "," : ".";
    const thousandSep = decimalSep === "," ? "." : ",";
    text = text.split(thousandSep).join("").replace(decimalSep, ".");
  } else if (lastComma > -1) {
    // Satu koma: desimal, kecuali polanya kelipatan ribuan (1,234,567).
    text = /^\d{1,3}(,\d{3})+$/.test(text)
      ? text.split(",").join("")
      : text.replace(",", ".");
  } else if (lastDot > -1) {
    // Satu titik: ribuan bila polanya 1.234.567, selain itu desimal.
    if (/^\d{1,3}(\.\d{3})+$/.test(text)) text = text.split(".").join("");
  }

  const parsed = Number.parseFloat(text.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -parsed : parsed;
}

const TRUE_VALUES = new Set(["true", "ya", "y", "yes", "1", "restruktur", "v", "x"]);

export function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (value === null || value === undefined) return false;
  return TRUE_VALUES.has(String(value).trim().toLowerCase());
}

export function toText(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  // `\s` tidak mencakup NUL, jadi pembersihan harus dilakukan terpisah
  // sebelum spasi dirapikan.
  const text = sanitizeText(String(value)).replace(/\s+/g, " ").trim();
  return text || fallback;
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1, januari: 1, january: 1, feb: 2, februari: 2, february: 2,
  mar: 3, maret: 3, march: 3, apr: 4, april: 4, mei: 5, may: 5,
  jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7,
  agu: 8, agt: 8, ags: 8, aug: 8, agustus: 8, august: 8,
  sep: 9, sept: 9, september: 9, okt: 10, oct: 10, oktober: 10, october: 10,
  nov: 11, november: 11, des: 12, dec: 12, desember: 12, december: 12,
};

/** Tiga angka dipisah `/`, `-`, atau `.` — mis. `18/06/2026`, `2026-06-18`. */
const NUMERIC_DATE = /^(\d{1,4})[/\-.](\d{1,2})[/\-.](\d{1,4})$/;
/** `18 Juni 2026`, `18-Jun-26`. */
const NAMED_DMY = /^(\d{1,2})[\s\-./]+([a-zA-Z]+)[\s\-./]+(\d{2,4})$/;
/** `Jun 18, 2026`, `June 18 2026`. */
const NAMED_MDY = /^([a-zA-Z]+)[\s\-./]+(\d{1,2}),?[\s\-./]+(\d{2,4})$/;
/** `Agustus 2026`, `Agu-26`. */
const NAMED_MY = /^([a-zA-Z]+)[\s\-./]+(\d{2,4})$/;
/** Bagian jam pada `18/06/2026 00:00:00` atau `2026-06-18T00:00:00`. */
const TIME_SUFFIX = /[\sT]\d{1,2}:\d{2}(:\d{2})?(\.\d+)?\s*([AP]M)?$/i;

/**
 * Menentukan mana hari dan mana bulan pada tanggal numerik dua komponen.
 *
 * Ekstrak dari sistem inti bisa berisi campuran `DD/MM/YYYY` (konvensi
 * Indonesia) dan `MM/DD/YYYY` (yang ditulis Excel saat locale-nya berbeda),
 * sehingga urutannya tidak boleh diasumsikan begitu saja:
 *
 * - salah satu komponen > 12 -> urutannya pasti, tidak ada tebakan;
 * - keduanya <= 12 -> benar-benar ambigu, dipilih `DD/MM` mengikuti
 *   konvensi Indonesia.
 */
function resolveDayMonth(first: number, second: number): { day: number; month: number } {
  if (first > 12 && second <= 12) return { day: first, month: second };
  if (second > 12 && first <= 12) return { day: second, month: first };
  return { day: first, month: second };
}

/**
 * Mengubah nilai sel menjadi tanggal ISO `YYYY-MM-DD`, atau `null` bila
 * tidak bisa diurai. Tidak pernah mengembalikan tanggal yang tidak sah —
 * seluruh jalur bermuara pada `toIsoFromParts` yang memvalidasi kalender.
 */
export function toIsoDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toIsoFromParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  // Serial number Excel (hari sejak 1899-12-30).
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? toIsoFromParts(parsed.y, parsed.m, parsed.d) : null;
  }

  const text = sanitizeText(String(value)).trim().replace(TIME_SUFFIX, "").trim();
  if (!text) return null;

  const numeric = NUMERIC_DATE.exec(text);
  if (numeric) {
    const [, firstRaw, secondRaw, thirdRaw] = numeric;

    // Komponen pertama empat digit berarti urutannya sudah YYYY-MM-DD.
    if (firstRaw.length === 4) {
      return toIsoFromParts(Number(firstRaw), Number(secondRaw), Number(thirdRaw));
    }

    const { day, month } = resolveDayMonth(Number(firstRaw), Number(secondRaw));
    return toIsoFromParts(expandYear(Number(thirdRaw)), month, day);
  }

  const namedDmy = NAMED_DMY.exec(text);
  if (namedDmy) {
    const month = MONTH_NAMES[namedDmy[2].toLowerCase()];
    if (!month) return null;
    return toIsoFromParts(expandYear(Number(namedDmy[3])), month, Number(namedDmy[1]));
  }

  const namedMdy = NAMED_MDY.exec(text);
  if (namedMdy) {
    const month = MONTH_NAMES[namedMdy[1].toLowerCase()];
    if (!month) return null;
    return toIsoFromParts(expandYear(Number(namedMdy[3])), month, Number(namedMdy[2]));
  }

  const namedMy = NAMED_MY.exec(text);
  if (namedMy) {
    const month = MONTH_NAMES[namedMy[1].toLowerCase()];
    if (!month) return null;
    return toIsoFromParts(expandYear(Number(namedMy[2])), month, 1);
  }

  // Sengaja TIDAK ada cadangan `new Date(text)`. Penguraiannya bergantung
  // mesin dan menghasilkan kejutan: `new Date("0")` di V8 menjadi tahun 2000,
  // sehingga sel berisi angka acak berubah menjadi tanggal yang seolah sah.
  return null;
}

/** Menormalkan tanggal apa pun ke tanggal 1 di bulan tersebut. */
export function toPeriode(value: unknown): string | null {
  const iso = toIsoDate(value);
  return iso ? toFirstOfMonth(iso) : null;
}

const STATUS_ALIASES: Record<string, StatusPipeline> = {
  prospek: "prospek", prospect: "prospek", pipeline: "prospek", lead: "prospek",
  inisiasi: "prospek", initiate: "prospek",
  analisa: "analisa", analisis: "analisa", analysis: "analisa",
  proses: "analisa", on_process: "analisa", review: "analisa", verifikasi: "analisa",
  booking: "booking", booked: "booking", realisasi: "booking",
  cair: "booking", disbursed: "booking", aktif: "booking",
  ditolak: "ditolak", reject: "ditolak", rejected: "ditolak", tolak: "ditolak",
  batal: "batal", cancel: "batal", cancelled: "batal", canceled: "batal",
};

export function toStatusPipeline(value: unknown): StatusPipeline {
  const key = toSnakeCase(toText(value));
  if (STATUS_ALIASES[key]) return STATUS_ALIASES[key];
  const known = [...PIPELINE_STAGES, ...PIPELINE_DROPPED] as readonly string[];
  if (known.includes(key)) return key as StatusPipeline;
  return "prospek";
}

/* ================================================================== */
/* 3. Parsing workbook                                                */
/* ================================================================== */

export type RawRow = Record<string, unknown>;

export type ParseIssue = { row: number; message: string };

export type ParseResult<T> = {
  rows: T[];
  /** Header asli -> header kanonik, ditampilkan sebagai pratinjau di UI. */
  headerMap: { original: string; normalized: string }[];
  sheetName: string;
  totalRows: number;
  skipped: number;
  issues: ParseIssue[];
};

/**
 * Membaca file Excel di browser dan mengembalikan baris mentah dengan
 * header yang sudah dibersihkan menjadi snake_case.
 */
export type SheetResult = {
  rows: RawRow[];
  /** Sejajar dengan `rows`, dikunci nama kolom asli (tanpa alias). */
  rawRows: RawRow[];
  headerMap: ParseResult<never>["headerMap"];
  sheetName: string;
};

export type WorkbookResult = SheetResult & { sheetNames: string[] };

/** Membaca satu worksheet yang sudah di-parse menjadi baris berkunci kolom. */
function readSheet(sheet: XLSX.WorkSheet, sheetName: string): SheetResult {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: null,
  });

  const headerRowIndex = findHeaderRow(matrix);
  if (headerRowIndex === -1) {
    // Sheet kosong atau tanpa header bukan alasan menggagalkan seluruh
    // berkas: berkas asli kerap menyertakan sheet sisa yang kosong.
    return { rows: [], rawRows: [], headerMap: [], sheetName };
  }

  const rawHeaders = (matrix[headerRowIndex] ?? []).map((cell) => toText(cell));
  const headerMap: ParseResult<never>["headerMap"] = [];
  const seen = new Map<string, number>();
  const normalizedHeaders = rawHeaders.map((original) => {
    if (!original) return "";
    let normalized = normalizeHeader(original);
    // Header duplikat diberi akhiran agar tidak saling menimpa.
    const count = seen.get(normalized) ?? 0;
    seen.set(normalized, count + 1);
    if (count > 0) normalized = `${normalized}_${count + 1}`;
    headerMap.push({ original, normalized });
    return normalized;
  });

  // Kunci snapshot sengaja tidak melewati alias: dua kolom sumber yang
  // beraliaskan sama (mis. "Produk" dan "JENIS KREDIT") tetap terpisah.
  const seenSnapshot = new Map<string, number>();
  const snapshotHeaders = rawHeaders.map((original) => {
    if (!original) return "";
    const base = toSnakeCase(original);
    const count = seenSnapshot.get(base) ?? 0;
    seenSnapshot.set(base, count + 1);
    return count > 0 ? `${base}_${count + 1}` : base;
  });

  const rows: RawRow[] = [];
  const rawRows: RawRow[] = [];
  for (let i = headerRowIndex + 1; i < matrix.length; i += 1) {
    const cells = matrix[i] ?? [];
    if (cells.every((cell) => cell === null || cell === undefined || cell === "")) continue;

    const row: RawRow = {};
    normalizedHeaders.forEach((key, index) => {
      if (key) row[key] = cells[index] ?? null;
    });
    rows.push(row);

    const snapshot: RawRow = {};
    snapshotHeaders.forEach((key, index) => {
      if (!key) return;
      const cell = cells[index];
      if (cell === null || cell === undefined || cell === "") return;
      // Tanggal disimpan sebagai ISO agar aman melewati JSON. Nilai teks
      // dibersihkan di sini karena snapshot tidak melewati `toText`.
      if (cell instanceof Date) snapshot[key] = toIsoDate(cell) ?? null;
      else if (typeof cell === "string") snapshot[key] = sanitizeText(cell);
      else snapshot[key] = cell;
    });
    rawRows.push(snapshot);
  }

  return { rows, rawRows, headerMap, sheetName };
}

/**
 * Membaca file Excel di browser dan mengembalikan baris mentah dengan
 * header yang sudah dibersihkan menjadi snake_case.
 */
export async function readWorkbook(
  file: File,
  sheetName?: string,
): Promise<WorkbookResult> {
  const workbook = await parseWorkbook(file);

  const targetSheet = sheetName ?? workbook.SheetNames[0];
  if (!targetSheet) throw new Error("File Excel tidak memiliki sheet apa pun.");

  const sheet = workbook.Sheets[targetSheet];
  if (!sheet) throw new Error(`Sheet "${targetSheet}" tidak ditemukan.`);

  return { ...readSheet(sheet, targetSheet), sheetNames: workbook.SheetNames };
}

/**
 * Membaca SELURUH sheet dalam satu kali parse.
 *
 * Dipakai berkas yang memecah datanya per sheet — berkas Top 30 Looser DPK
 * menaruh satu outlet di tiap sheet, sehingga membaca sheet pertama saja
 * akan membuang sebagian besar isinya. Parse dilakukan sekali karena berkas
 * seperti ekstrak akun bisa berukuran puluhan megabita.
 */
export async function readAllSheets(file: File): Promise<{
  sheets: SheetResult[];
  sheetNames: string[];
}> {
  const workbook = await parseWorkbook(file);
  return {
    sheets: workbook.SheetNames.map((name) => readSheet(workbook.Sheets[name], name)),
    sheetNames: workbook.SheetNames,
  };
}

async function parseWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buffer = await file.arrayBuffer();
  return XLSX.read(buffer, { type: "array", cellDates: true });
}

/**
 * File dari cabang sering diawali judul/logo beberapa baris. Baris header
 * dipilih sebagai baris awal dengan sel teks terbanyak.
 */
function findHeaderRow(matrix: unknown[][]): number {
  const limit = Math.min(matrix.length, 25);
  let bestIndex = -1;
  let bestScore = 0;

  for (let i = 0; i < limit; i += 1) {
    const cells = matrix[i] ?? [];
    const score = cells.filter(
      (cell) => typeof cell === "string" && cell.trim().length > 0,
    ).length;
    if (score >= 3 && score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return bestIndex;
}

/* ================================================================== */
/* 4. Pemetaan ke skema tabel                                         */
/* ================================================================== */

const FALLBACK_PERIODE = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
};

export function mapKreditRecords(
  rows: RawRow[],
  defaultPeriode?: string,
  rawRows: RawRow[] = [],
) {
  const periodeDefault = defaultPeriode ?? FALLBACK_PERIODE();
  const issues: ParseIssue[] = [];
  const mapped: KreditRecord[] = [];
  const seenKeys = new Set<string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // +1 header, +1 basis 1
    const cabang = toText(row.cabang);
    const namaDebitur = toText(row.nama_debitur);

    if (!cabang) {
      issues.push({ row: rowNumber, message: "Kolom cabang kosong, baris dilewati." });
      return;
    }

    const bakiDebet = toNumber(row.baki_debet);
    const tanggalBooking = toIsoDate(row.tanggal_booking);

    // Ekstrak portofolio biasanya tidak punya kolom status karena seluruh
    // isinya sudah berjalan. Tanpa inferensi ini, setiap baris akan jatuh
    // ke "prospek" dan outstanding-nya dinolkan.
    const statusText = toText(row.status_pipeline);
    const status: StatusPipeline = statusText
      ? toStatusPipeline(statusText)
      : bakiDebet > 0 || tanggalBooking
        ? "booking"
        : "prospek";
    const isBooking = status === "booking";

    let kode = toText(row.kode_fasilitas);
    if (!kode) {
      kode = `${toSnakeCase(cabang)}-${toSnakeCase(namaDebitur || `baris-${rowNumber}`)}`;
    }
    if (seenKeys.has(kode)) {
      // Kunci ganda dalam satu file akan saling menimpa saat upsert.
      issues.push({
        row: rowNumber,
        message: `Kode fasilitas "${kode}" duplikat di dalam file, baris dilewati.`,
      });
      return;
    }
    seenKeys.add(kode);

    // Tanggal yang tidak bisa diurai tidak boleh menggagalkan seluruh batch:
    // periode jatuh ke periode default, tanggal booking menjadi null, dan
    // keduanya dicatat supaya perubahannya tidak terjadi diam-diam.
    const periodeText = toText(row.periode);
    const periode = toPeriode(row.periode);
    if (periodeText && !periode) {
      issues.push({
        row: rowNumber,
        message: `Periode "${periodeText}" tidak dikenali, dipakai ${periodeDefault}.`,
      });
    }
    if (isBooking && toText(row.tanggal_booking) && !tanggalBooking) {
      issues.push({
        row: rowNumber,
        message: `Tanggal booking "${toText(row.tanggal_booking)}" tidak dikenali, disimpan kosong.`,
      });
    }

    mapped.push({
      kode_fasilitas: kode,
      periode: periode ?? periodeDefault,
      area_head: toText(row.area_head, "Tanpa Area Head"),
      cabang,
      produk: toText(row.produk, "Lainnya").toUpperCase(),
      pengelola: toText(row.pengelola, "Tanpa Pengelola"),
      nama_debitur: namaDebitur || "-",
      status_pipeline: status,
      plafon: toNumber(row.plafon) || (isBooking ? bakiDebet : 0),
      // Yang belum booking tidak boleh punya outstanding.
      baki_debet: isBooking ? bakiDebet : 0,
      baki_debet_awal: isBooking ? toNumber(row.baki_debet_awal) : 0,
      kolektibilitas: clampKol(toNumber(row.kolektibilitas)),
      dpd: Math.max(0, Math.round(toNumber(row.dpd))),
      is_restruktur: toBoolean(row.is_restruktur),
      tanggal_booking: isBooking ? tanggalBooking : null,
      // Dibersihkan di sini, bukan hanya di `readWorkbook`, supaya pemanggil
      // yang menyuplai snapshot dari sumber lain tetap aman.
      raw: sanitizeDeep(rawRows[index] ?? {}),
    });
  });

  return { rows: mapped, issues };
}

function clampKol(value: number): number {
  const kol = Math.round(value);
  if (!kol || kol < 1) return 1;
  return Math.min(kol, 5);
}

export function mapTargetCabang(rows: RawRow[], defaultPeriode?: string) {
  const periodeDefault = defaultPeriode ?? FALLBACK_PERIODE();
  const issues: ParseIssue[] = [];
  const mapped: TargetCabang[] = [];
  const seenKeys = new Set<string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const cabang = toText(row.cabang);
    if (!cabang) {
      issues.push({ row: rowNumber, message: "Kolom cabang kosong, baris dilewati." });
      return;
    }

    const periodeText = toText(row.periode);
    const parsedPeriode = toPeriode(row.periode);
    if (periodeText && !parsedPeriode) {
      issues.push({
        row: rowNumber,
        message: `Periode "${periodeText}" tidak dikenali, dipakai ${periodeDefault}.`,
      });
    }
    const periode = parsedPeriode ?? periodeDefault;
    const produk = toText(row.produk, "SEMUA").toUpperCase();
    const key = `${periode}|${cabang}|${produk}`;
    if (seenKeys.has(key)) {
      issues.push({
        row: rowNumber,
        message: `Kombinasi periode/cabang/produk duplikat (${key}), baris dilewati.`,
      });
      return;
    }
    seenKeys.add(key);

    mapped.push({
      periode,
      area_head: toText(row.area_head, "Tanpa Area Head"),
      cabang,
      produk,
      target_baki_debet: toNumber(row.target_baki_debet),
      target_booking_nominal: toNumber(row.target_booking_nominal),
    });
  });

  return { rows: mapped, issues };
}

export function mapRowsForDataset(
  dataset: UploadDataset,
  rows: RawRow[],
  defaultPeriode?: string,
  rawRows: RawRow[] = [],
) {
  return dataset === "kredit_records"
    ? mapKreditRecords(rows, defaultPeriode, rawRows)
    : mapTargetCabang(rows, defaultPeriode);
}

/** Kolom minimal yang harus ada agar file bisa diproses. */
export const REQUIRED_COLUMNS: Record<UploadDataset, string[]> = {
  kredit_records: ["cabang", "produk", "pengelola"],
  target_cabang: ["cabang", "target_baki_debet"],
  // Dua dataset berikut divalidasi oleh pemetanya sendiri di `datasets.ts`,
  // karena kolom wajibnya bergantung pada sheet dan judul kolom bertanggal.
  dpk_looser: [],
  akun_records: [],
};

export function findMissingColumns(dataset: UploadDataset, headers: string[]): string[] {
  const present = new Set(headers);
  return REQUIRED_COLUMNS[dataset].filter((column) => !present.has(column));
}
