import {
  findMissingColumns,
  mapRowsForDataset,
  readAllSheets,
  readWorkbook,
  toIsoDate,
  toNumber,
  toSnakeCase,
  toText,
  type ParseIssue,
  type RawRow,
  type SheetResult,
} from "./excel";
import { sanitizeDeep } from "./sanitize";
import { toFirstOfMonth } from "./dates";
import type { AkunRecord, AkunSumber, DpkLooser, UploadDataset } from "./types";

/**
 * Pemeta untuk dua berkas di luar format SL 18.
 *
 * Keduanya sengaja membaca **snapshot kolom asli** (`rawRows`, dikunci
 * `toSnakeCase` dari judul kolom apa adanya), bukan baris yang sudah lewat
 * tabel alias di `excel.ts`. Tabel alias itu disusun untuk SL 18 dan justru
 * merusak berkas ini — pada berkas DPK, `Jenis Produk` dan `Segmen`
 * sama-sama beralias ke `produk` sehingga saling menimpa.
 */

/** Mengambil nilai pertama yang terisi dari beberapa kemungkinan nama kolom. */
function pick(row: RawRow, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return null;
}

const pickText = (row: RawRow, ...keys: string[]) => toText(pick(row, ...keys));
const pickNumber = (row: RawRow, ...keys: string[]) => toNumber(pick(row, ...keys));

/* ================================================================== */
/* 1. Top 30 Looser DPK                                               */
/* ================================================================== */

/** Kolom yang nilainya hanya ditulis di baris pertama lalu dikosongkan. */
const DPK_CARRY_COLUMNS = ["s_c", "cabang", "outlet", "jenis_produk"] as const;

export type DpkParseResult = {
  rows: DpkLooser[];
  issues: ParseIssue[];
  /** Sheet yang dilewati karena kosong atau bukan tabel looser. */
  skippedSheets: string[];
  tanggalAwal: string | null;
  tanggalAkhir: string | null;
};

/**
 * Mencari dua kolom "Saldo <tanggal>" dan membaca tanggalnya dari judul.
 *
 * Tanggal pembanding tidak pernah muncul sebagai kolom tersendiri; satu-satunya
 * tempatnya adalah judul kolom, dan judulnya berubah tiap terbit. Kolom selisih
 * ("∆Saldo") tidak ikut terpilih karena tidak diawali kata "Saldo".
 */
function findSaldoColumns(headerMap: SheetResult["headerMap"]): {
  awal: string | null;
  akhir: string | null;
  tanggalAwal: string | null;
  tanggalAkhir: string | null;
} {
  const dated: { key: string; iso: string | null }[] = [];

  for (const entry of headerMap) {
    const match = /^\s*saldo\s+(.+)$/i.exec(entry.original);
    if (!match) continue;
    dated.push({ key: toSnakeCase(entry.original), iso: toIsoDate(match[1]) });
  }

  if (dated.length < 2) {
    return { awal: null, akhir: null, tanggalAwal: null, tanggalAkhir: null };
  }

  // Urutkan menurut tanggal bila keduanya terbaca; kalau tidak, pakai urutan
  // kolom pada berkas (kiri = posisi awal, kanan = posisi akhir).
  const ordered = dated[0].iso && dated[1].iso
    ? [...dated].sort((a, b) => (a.iso ?? "").localeCompare(b.iso ?? ""))
    : dated;

  return {
    awal: ordered[0].key,
    akhir: ordered[1].key,
    tanggalAwal: ordered[0].iso,
    tanggalAkhir: ordered[1].iso,
  };
}

export function mapDpkLooser(
  sheets: SheetResult[],
  defaultPeriode: string,
): DpkParseResult {
  const issues: ParseIssue[] = [];
  const skippedSheets: string[] = [];
  const mapped: DpkLooser[] = [];
  const seen = new Set<string>();

  let tanggalAwal: string | null = null;
  let tanggalAkhir: string | null = null;

  for (const sheet of sheets) {
    if (sheet.rawRows.length === 0) {
      skippedSheets.push(sheet.sheetName);
      continue;
    }

    const saldo = findSaldoColumns(sheet.headerMap);
    if (!saldo.awal || !saldo.akhir) {
      skippedSheets.push(sheet.sheetName);
      issues.push({
        row: 0,
        message:
          `Sheet "${sheet.sheetName}" dilewati: dua kolom "Saldo <tanggal>" ` +
          "tidak ditemukan.",
      });
      continue;
    }

    tanggalAwal = tanggalAwal ?? saldo.tanggalAwal;
    tanggalAkhir = tanggalAkhir ?? saldo.tanggalAkhir;

    const periode =
      (saldo.tanggalAkhir && toFirstOfMonth(saldo.tanggalAkhir)) || defaultPeriode;

    // Nilai kolom dimensi hanya ditulis sekali di baris pertama.
    const carried: Record<string, string> = {};

    sheet.rawRows.forEach((row, index) => {
      // +1 judul kolom, +1 basis 1; nomor baris ini untuk dilaporkan ke pengguna.
      const rowNumber = index + 2;

      for (const key of DPK_CARRY_COLUMNS) {
        const value = toText(row[key]);
        if (value) carried[key] = value;
      }

      const cif = pickText(row, "cif");
      if (!cif) {
        issues.push({
          row: rowNumber,
          message: `Sheet "${sheet.sheetName}" baris ${rowNumber}: CIF kosong, dilewati.`,
        });
        return;
      }

      // Outlet kerap hanya tertulis sekali; nama sheet adalah cadangan terbaik.
      const outlet = carried.outlet || sheet.sheetName;
      const key = `${periode}|${outlet}|${cif}`;
      if (seen.has(key)) {
        issues.push({
          row: rowNumber,
          message: `CIF ${cif} duplikat pada outlet ${outlet}, baris dilewati.`,
        });
        return;
      }
      seen.add(key);

      const saldoAwal = pickNumber(row, saldo.awal!);
      const saldoAkhir = pickNumber(row, saldo.akhir!);

      mapped.push({
        periode,
        tanggal_awal: saldo.tanggalAwal,
        tanggal_akhir: saldo.tanggalAkhir,
        sc: carried.s_c ?? "",
        cabang: carried.cabang ?? "",
        outlet,
        jenis_produk: carried.jenis_produk ?? "",
        ranking: Math.max(0, Math.round(pickNumber(row, "ranking"))),
        cif,
        nama: pickText(row, "nama") || "-",
        segmen: pickText(row, "segmen"),
        saldo_awal: saldoAwal,
        saldo_akhir: saldoAkhir,
        // Dihitung ulang, bukan diambil dari kolom selisih pada berkas, agar
        // angka pada grafik selalu konsisten dengan kedua kolom saldonya.
        delta_saldo: saldoAkhir - saldoAwal,
        raw: sanitizeDeep(row),
      });
    });
  }

  // Satu berkas memuat satu cabang, tetapi kolom Cabang kerap hanya terisi di
  // sebagian sheet. Nilai yang ditemukan di sheet mana pun dipakai untuk yang kosong.
  const cabangTerisi = mapped.find((row) => row.cabang)?.cabang ?? "";
  for (const row of mapped) {
    if (!row.cabang) row.cabang = cabangTerisi || "Tanpa Cabang";
  }

  return { rows: mapped, issues, skippedSheets, tanggalAwal, tanggalAkhir };
}

/* ================================================================== */
/* 2. Data mentah akun                                                */
/* ================================================================== */

/** Nama sheet dicocokkan longgar: berkas aslinya memakai akhiran garis bawah. */
function detectSumber(sheetName: string): AkunSumber | null {
  const key = toSnakeCase(sheetName);
  if (key.startsWith("old_account")) return "old";
  if (key.startsWith("new_account")) return "new";
  return null;
}

export type AkunParseResult = {
  rows: AkunRecord[];
  issues: ParseIssue[];
  skippedSheets: string[];
  /** Jumlah baris per sheet, ditampilkan sebagai pratinjau di halaman unggah. */
  perSumber: { sumber: AkunSumber; sheetName: string; jumlah: number }[];
};

export function mapAkunRecords(
  sheets: SheetResult[],
  periode: string,
): AkunParseResult {
  const issues: ParseIssue[] = [];
  const skippedSheets: string[] = [];
  const perSumber: AkunParseResult["perSumber"] = [];
  const mapped: AkunRecord[] = [];

  for (const sheet of sheets) {
    const sumber = detectSumber(sheet.sheetName);
    if (!sumber) {
      skippedSheets.push(sheet.sheetName);
      continue;
    }

    // Sheet yang hanya berisi judul kolom bukan kesalahan: pada berkas asli,
    // NEW_ACCOUNT bisa saja belum berisi data sama sekali.
    perSumber.push({ sumber, sheetName: sheet.sheetName, jumlah: sheet.rawRows.length });
    if (sheet.rawRows.length === 0) continue;

    // Tidak ada satu kolom pun yang benar-benar unik pada berkas ini, jadi
    // kuncinya disusun dari kombinasi paling stabil lalu diberi nomor urut
    // saat tetap kembar. Kunci menjadi sama setiap kali berkas yang sama
    // diunggah ulang, sehingga upsert memperbarui baris yang tepat.
    const keyCount = new Map<string, number>();

    sheet.rawRows.forEach((row, index) => {
      const rowNumber = index + 2;
      const cif = pickText(row, "bni_cif_key", "cif");
      const noPk = pickText(row, "no_pk");
      const aplikasi = pickText(row, "bni_application_no", "no_apl_elo");

      const base = noPk || aplikasi || cif;
      if (!base) {
        issues.push({
          row: rowNumber,
          message:
            `Sheet "${sheet.sheetName}" baris ${rowNumber}: No_PK, nomor aplikasi, ` +
            "dan CIF semuanya kosong sehingga baris tidak bisa diidentifikasi.",
        });
        return;
      }

      const composite = `${base}|${cif}`;
      const occurrence = (keyCount.get(composite) ?? 0) + 1;
      keyCount.set(composite, occurrence);
      const kodeAkun = occurrence === 1 ? composite : `${composite}#${occurrence}`;

      const golongan = Math.round(pickNumber(row, "golongan", "golongan_new"));

      mapped.push({
        periode,
        sumber,
        kode_akun: kodeAkun.slice(0, 160),
        cif,
        nama_debitur: pickText(row, "nama_debitur") || "-",
        no_pk: noPk,
        area: pickText(row, "area"),
        branch_code: pickText(row, "branch_code"),
        branch_name: pickText(row, "branch_name"),
        kode_outlet: pickText(row, "kode_outlet"),
        nama_outlet: pickText(row, "nama_outlet"),
        nama_akk: pickText(row, "nama_akk"),
        produk: pickText(row, "product_name5", "productnya"),
        tipe: pickText(row, "type2"),
        program: pickText(row, "program"),
        segmen_ews: pickText(row, "segmen_ews"),
        segmen_kelola: pickText(row, "segmen_kelola"),
        sektor_ekonomi: pickText(row, "sektor_ekonomi"),
        ket_status: pickText(row, "ket_status", "ket_status_new"),
        // Judul aslinya BNI_COMMITMENT_BAL_IDR. Akhiran "idr" TIDAK boleh
        // ditebak hilang: kunci snapshot memakai judul apa adanya, sedangkan
        // pelepasan satuan hanya terjadi pada jalur alias SL 18.
        plafon: pickNumber(row, "bni_commitment_bal_idr", "bni_commitment_bal"),
        baki_debet: pickNumber(row, "baki_debet", "baki_debet_new"),
        outstanding: pickNumber(row, "outstanding"),
        saldo_akhir: pickNumber(row, "saldo_akhir", "saldo_akhir_new"),
        total_tunggakan: pickNumber(row, "total_tunggakkan", "total_tunggakan"),
        total_kewajiban: pickNumber(row, "total_kewajiban"),
        dpd_kategori: pickText(row, "dpd", "dpd_new"),
        dpd_hari: Math.max(0, Math.round(pickNumber(row, "dpd_num", "del_cur_days"))),
        golongan: golongan >= 1 && golongan <= 5 ? golongan : 1,
        suku_bunga: nullableNumber(row, "rate_new", "rate", "rate_old"),
        tanggal_buka: toIsoDate(pick(row, "account_open_date")),
        tanggal_jatuh_tempo: toIsoDate(pick(row, "tgl_jatuh_tempo")),
      });
    });
  }

  return { rows: mapped, issues, skippedSheets, perSumber };
}

function nullableNumber(row: RawRow, ...keys: string[]): number | null {
  const value = pick(row, ...keys);
  if (value === null) return null;
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/* ================================================================== */
/* 3. Gerbang tunggal untuk halaman unggah                            */
/* ================================================================== */

export type ParsedUpload = {
  /** Baris siap kirim; bentuknya mengikuti dataset yang dipilih. */
  rows: unknown[];
  issues: ParseIssue[];
  headerMap: SheetResult["headerMap"];
  /** Sheet yang dibaca, untuk ditampilkan sebagai pratinjau. */
  sheetLabel: string;
  sheetNames: string[];
  totalRaw: number;
  missingColumns: string[];
  /** Keterangan tambahan hasil pembacaan, mis. tanggal yang terdeteksi. */
  notes: string[];
  /** `true` bila dataset membaca seluruh sheet sekaligus. */
  multiSheet: boolean;
};

/** Dataset yang datanya tersebar di banyak sheet. */
export const MULTI_SHEET_DATASETS = new Set<UploadDataset>([
  "dpk_looser",
  "akun_records",
]);

/**
 * Membaca berkas sesuai dataset tujuannya dan mengembalikan bentuk yang sama
 * untuk semuanya, sehingga halaman unggah tidak perlu tahu perbedaan
 * strukturnya.
 */
export async function parseUploadFile(
  file: File,
  dataset: UploadDataset,
  defaultPeriode: string,
  sheetName?: string,
): Promise<ParsedUpload> {
  if (dataset === "dpk_looser") {
    const { sheets, sheetNames } = await readAllSheets(file);
    const result = mapDpkLooser(sheets, defaultPeriode);

    const notes: string[] = [];
    if (result.tanggalAwal && result.tanggalAkhir) {
      notes.push(
        `Tanggal pembanding terbaca dari judul kolom: ${result.tanggalAwal} → ${result.tanggalAkhir}.`,
      );
    } else {
      notes.push(
        "Tanggal pembanding tidak terbaca dari judul kolom; periode diambil dari kolom Periode.",
      );
    }
    const terbaca = sheets.filter((s) => !result.skippedSheets.includes(s.sheetName));
    notes.push(`${terbaca.length} sheet outlet dibaca dari ${sheetNames.length} sheet.`);
    if (result.skippedSheets.length > 0) {
      notes.push(`Sheet dilewati: ${result.skippedSheets.join(", ")}.`);
    }

    return {
      rows: result.rows,
      issues: result.issues,
      headerMap: terbaca[0]?.headerMap ?? [],
      sheetLabel: terbaca.map((s) => s.sheetName).join(", ") || "-",
      sheetNames,
      totalRaw: sheets.reduce((total, s) => total + s.rawRows.length, 0),
      missingColumns: [],
      notes,
      multiSheet: true,
    };
  }

  if (dataset === "akun_records") {
    const { sheets, sheetNames } = await readAllSheets(file);
    const result = mapAkunRecords(sheets, defaultPeriode);

    const notes = result.perSumber.map(
      (entry) =>
        `Sheet ${entry.sheetName} (${entry.sumber.toUpperCase()}): ` +
        `${entry.jumlah.toLocaleString("id-ID")} baris.`,
    );
    if (result.perSumber.length === 0) {
      notes.push(
        "Tidak ada sheet bernama OLD_ACCOUNT atau NEW_ACCOUNT pada berkas ini.",
      );
    }
    if (result.skippedSheets.length > 0) {
      notes.push(`Sheet dilewati: ${result.skippedSheets.join(", ")}.`);
    }
    notes.push("Kolom PII (NIK, telepon, alamat) tidak ikut disimpan.");

    const terbaca = sheets.filter((s) => !result.skippedSheets.includes(s.sheetName));
    return {
      rows: result.rows,
      issues: result.issues,
      headerMap: terbaca[0]?.headerMap ?? [],
      sheetLabel: result.perSumber.map((e) => e.sheetName).join(", ") || "-",
      sheetNames,
      totalRaw: terbaca.reduce((total, s) => total + s.rawRows.length, 0),
      missingColumns: result.perSumber.length === 0 ? ["OLD_ACCOUNT / NEW_ACCOUNT"] : [],
      notes,
      multiSheet: true,
    };
  }

  // Dataset SL 18 dan target tetap memakai jalur satu sheet.
  const workbook = await readWorkbook(file, sheetName);
  const { rows, issues } = mapRowsForDataset(
    dataset,
    workbook.rows,
    defaultPeriode,
    workbook.rawRows,
  );

  return {
    rows,
    issues,
    headerMap: workbook.headerMap,
    sheetLabel: workbook.sheetName,
    sheetNames: workbook.sheetNames,
    totalRaw: workbook.rows.length,
    missingColumns: findMissingColumns(
      dataset,
      workbook.headerMap.map((entry) => entry.normalized),
    ),
    notes: [],
    multiSheet: false,
  };
}

/**
 * Baris per permintaan unggah. Dataset yang menyimpan snapshot kolom asli
 * membawa payload jauh lebih besar per baris, jadi potongannya dikecilkan.
 */
export function chunkSizeFor(dataset: UploadDataset): number {
  if (dataset === "akun_records") return 1000; // tanpa snapshot `raw`
  if (dataset === "dpk_looser") return 500; // snapshot hanya 11 kolom
  return 400; // SL 18: snapshot sampai 86 kolom
}
