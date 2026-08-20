/**
 * Membuat file Excel contoh dengan header yang sengaja "berantakan"
 * (spasi ganda, kapitalisasi campur, satuan dalam kurung, baris judul di
 * atas header) untuk menguji pembersih kolom di halaman admin.
 *
 * Jalankan: npm run template
 */
import { mkdirSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";

import { SOURCE_COLUMNS } from "../src/lib/columns.ts";

const OUT_DIR = "contoh";

const KREDIT_HEADERS = [
  "No Rekening",
  "  Periode ",
  "AH",
  "Nama Cabang / KCP",
  "Jenis Kredit",
  "Nama RM",
  "Nama Debitur",
  "Status Kredit",
  "Plafond (Rp)",
  "Outstanding  (Rp)",
  "Baki Debet Awal",
  "Kolektibilitas (Kol)",
  "DPD  (Hari)",
  "Flag Restruktur",
  "Tgl Booking",
];

const KREDIT_ROWS = [
  ["FAS-00001", "01/08/2026", "AH 1", "KCP Menteng", "SME", "Andi Pratama", "PT Maju Sentosa", "Booking", "Rp 5.000.000.000", "Rp 4.250.000.000", "4.000.000.000", 1, 0, "Tidak", "12/03/2026"],
  ["FAS-00002", "01/08/2026", "AH 1", "KCP Menteng", "KUR", "Andi Pratama", "UD Berkah Jaya", "Booking", "500.000.000", "412.500.000", "450.000.000", 2, 45, "Ya", "05/01/2026"],
  ["FAS-00003", "01/08/2026", "AH 1", "KCP Kelapa Gading", "SBP", "Dewi Wijaya", "CV Cahaya Timur", "On Process", "2.500.000.000", "", "", 1, 0, "Tidak", ""],
  ["FAS-00004", "01/08/2026", "AH 2", "KC Bandung", "SME", "Budi Santoso", "PT Karya Mandiri", "Prospek", "3.000.000.000", "", "", 1, 0, "Tidak", ""],
  ["FAS-00005", "01/08/2026", "AH 2", "KC Bandung", "SME", "Budi Santoso", "PT Bumi Persada", "Realisasi", "8.000.000.000", "7.100.000.000", "6.800.000.000", 3, 120, "Tidak", "20/02/2026"],
  ["FAS-00006", "01/08/2026", "AH 3", "KC Surabaya", "KUR", "Citra Halim", "Koperasi Rejeki", "Booking", "750.000.000", "690.000.000", "700.000.000", 1, 0, "Tidak", "18/04/2026"],
];

const TARGET_HEADERS = [
  "Periode",
  "Area Head",
  "Nama Cabang / KCP",
  "Produk Kredit",
  "Target Outstanding (Rp)",
  "Target Booking",
];

const TARGET_ROWS = [
  ["01/08/2026", "AH 1", "KCP Menteng", "SME", "5.000.000.000", "1.200.000.000"],
  ["01/08/2026", "AH 1", "KCP Menteng", "KUR", "600.000.000", "150.000.000"],
  ["01/08/2026", "AH 1", "KCP Kelapa Gading", "SBP", "3.000.000.000", "800.000.000"],
  ["01/08/2026", "AH 2", "KC Bandung", "SME", "9.000.000.000", "2.000.000.000"],
  ["01/08/2026", "AH 3", "KC Surabaya", "KUR", "800.000.000", "200.000.000"],
];

/** Dua baris judul di atas header, meniru laporan cabang sungguhan. */
function buildSheet(title: string, headers: readonly string[], rows: unknown[][]) {
  return XLSX.utils.aoa_to_sheet([
    [title],
    ["Dicetak 1 Agustus 2026"],
    [],
    [...headers],
    ...rows,
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });

const kreditBook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(
  kreditBook,
  buildSheet("LAPORAN KINERJA KREDIT PER DEBITUR", KREDIT_HEADERS, KREDIT_ROWS),
  "Data Kredit",
);
writeFileSync(`${OUT_DIR}/contoh-data-kredit.xlsx`, XLSX.write(kreditBook, { type: "buffer", bookType: "xlsx" }));

const targetBook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(
  targetBook,
  buildSheet("TARGET CABANG", TARGET_HEADERS, TARGET_ROWS),
  "Target",
);
writeFileSync(`${OUT_DIR}/contoh-target-cabang.xlsx`, XLSX.write(targetBook, { type: "buffer", bookType: "xlsx" }));

/* -----------------------------------------------------------------
 * Berkas ketiga: meniru layout asli 86 kolom, untuk menguji uploader
 * sekaligus Tabel Data Detail dengan seluruh kolom sumber.
 * ----------------------------------------------------------------- */

const CABANG = ["KCP Menteng", "KC Bandung", "KC Surabaya"];
const PENGELOLA = ["Andi Pratama", "Budi Santoso", "Citra Halim"];
const NASABAH = ["PT Maju Sentosa", "CV Karya Mandiri", "UD Berkah Jaya"];
const PRODUK = ["SME", "SBP", "KUR"];

/** Nilai contoh per kolom, dibuat konsisten antar kolom yang berkaitan. */
function valueFor(label: string, index: number): string | number {
  const plafon = [5_000_000_000, 2_500_000_000, 750_000_000][index];
  const bakiDebet = [4_250_000_000, 2_100_000_000, 690_000_000][index];
  const kol = [1, 2, 1][index];
  const dpd = [0, 45, 0][index];

  switch (label) {
    case "No": return index + 1;
    case ".Tanggal.": return "01/08/2026";
    case "Kode Cab.": return `010${index + 1}`;
    case "Nama Cab": return CABANG[index];
    case "KodeKLN.": return `010${index + 1}1`;
    case "Sentra Code.": return `S20${index + 1}`;
    case "KodeKCP.": return `010${index + 1}9`;
    case "Account Type.": return PRODUK[index] === "KUR" ? "KUR" : "KOM";
    case "Sub Category.": return `${PRODUK[index]}-0${index + 1}`;
    case "Produk": return PRODUK[index];
    case "Peruntukan": return ["Modal Kerja", "Investasi", "Modal Kerja"][index];
    case "Currency.": return "IDR";
    case "Kurs:": return 1;
    case "CIF.": return `800000${index + 1}`;
    case "No Rek.": return `FAS-8600${index + 1}`;
    case "Nama Nas": return NASABAH[index];
    case "Kol.": return kol;
    case "Maks Krd": return plafon;
    case "Ijin Tarik": return plafon - bakiDebet;
    case "Saldo Pokok": return bakiDebet;
    case "Tgk Pokok": return dpd > 0 ? Math.round(bakiDebet * 0.02) : 0;
    case "Tgk Bunga": return dpd > 0 ? Math.round(bakiDebet * 0.004) : 0;
    case "Denda": return 0;
    case "Tgk Biaya": return 0;
    case "Bk Debet": return bakiDebet;
    case "Bk Dbt (IDR)": return bakiDebet;
    case "Disponible": return plafon - bakiDebet;
    case "Suku Bunga:": return [9.5, 10.25, 6][index];
    case "Suku Bunga Efektif:": return [9.85, 10.6, 6.35][index];
    case "JW": return [36, 24, 12][index];
    case "Jth Tempo.": return ["12/03/2029", "05/01/2028", "18/04/2027"][index];
    case "Umur Tgk (hr)": return dpd;
    case "Kode Segmen.": return PRODUK[index] === "KUR" ? "KUR" : "SME";
    case "Kode_SektorEk_New": return ["4711", "1071", "0111"][index];
    case "SektorEk_Desc_New": return ["Perdagangan Eceran", "Industri Roti", "Pertanian Padi"][index];
    case "20Group_SektorEk_New": return ["12", "05", "01"][index];
    case "20Group_SektorEk_Desc_New": return ["Perdagangan", "Industri Pengolahan", "Pertanian"][index];
    case "NPP.": return `NPP10${index + 1}`;
    case "Nama Pengelola": return PENGELOLA[index];
    case "Propisi": return Math.round(plafon * 0.01);
    case "Pembebanan Bunga": return "Efektif";
    case "PPAP (IDR)": return Math.round(bakiDebet * (kol >= 3 ? 0.5 : 0.01));
    case "No Rek Afi.": return `90000000${index + 1}`;
    case "CCY Rek Afi.": return "IDR";
    case "Jadwal Angs Pok": return "Bulanan";
    case "Akum By Bg Akrual": return Math.round(bakiDebet * 0.003);
    case "By Bg Harian": return Math.round(bakiDebet * 0.0002);
    case "Saldo Akhir Afi": return Math.round(bakiDebet * 0.05);
    case "Saldo Blokir Afi": return 0;
    case "Saldo Efektif Afi": return Math.round(bakiDebet * 0.04);
    case "KodeInst.": return `I1${index}`;
    case "Institusi": return ["Badan Usaha", "Badan Usaha", "Perorangan"][index];
    case "TglBukaRek.": return ["12/03/2026", "05/01/2026", "18/04/2026"][index];
    case "Tgl PK.": return ["10/03/2026", "03/01/2026", "16/04/2026"][index];
    case "No_PK": return `PK-0000${index + 1}`;
    case "Restrukturisasi": return index === 1 ? "Ya" : "Tidak";
    case "KODE_FLAG_COVID.": return "N";
    case "DESK_FLAG_COVID": return "Non Covid";
    case "Ang_Pokok (IDR)": return Math.round(bakiDebet / 24);
    case "Tunda_Jatuh_Tempo": return "Tidak";
    case "Tanggal_Tunda_JT": return "";
    case "Tipe_Debitur": return ["Badan Usaha", "Badan Usaha", "Perorangan"][index];
    case "SPECIAL_INT_RATE": return 0;
    case "GROSS_RATE": return [10.6, 11.35, 7.1][index];
    case "FLAG_ESG": return index === 0 ? "Y" : "N";
    case "Nama_Flag_ESG": return index === 0 ? "Pembiayaan Berkelanjutan" : "-";
    case "KODE_GRUP_PERUSAHAAN": return index === 0 ? "GRP-101" : "-";
    case "ID_REFERRAL_SAPM": return `SAPM-${index + 1}`;
    case "CLEAN_BASIS": return "N";
    case "FLAG_XPORA": return index === 2 ? "Y" : "N";
    case "JENIS KREDIT": return PRODUK[index] === "KUR" ? "KUR" : "Komersial";
    case "JENIS KUR": return PRODUK[index] === "KUR" ? "KUR Kecil" : "-";
    case "OUTLET": return CABANG[index];
    case "KET KOL 1": return kol === 1 ? "Lancar Murni" : "-";
    case "KEWAJIBAN DSPA": return Math.round(bakiDebet * 0.02);
    case "KEWAJIBAN DSRA": return Math.round(bakiDebet * 0.01);
    case "AFIL-KEWAJIBAN": return Math.round(bakiDebet * 0.03);
    case "AFIL-KEWAJIBAN DSPA": return Math.round(bakiDebet * 0.015);
    case "DSPA": return Math.round(bakiDebet * 0.02);
    case "DSRA": return Math.round(bakiDebet * 0.01);
    case "KETERSEDIAAN DSPA": return "Tersedia";
    case "Jth Tempo - Tgl": return [12, 5, 18][index];
    case "Jth Tempo - Bulan": return [3, 1, 4][index];
    case "Jth Tempo - Tahun": return [2029, 2028, 2027][index];
    case "Jth Tempo - KET": return "Belum Jatuh Tempo";
    case "CEK BCM": return kol === 1 ? "OK" : "PERHATIAN";
    default: return "-";
  }
}

const fullBook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(
  fullBook,
  buildSheet(
    "LAPORAN KREDIT - LAYOUT LENGKAP 86 KOLOM",
    SOURCE_COLUMNS,
    [0, 1, 2].map((index) => SOURCE_COLUMNS.map((label) => valueFor(label, index))),
  ),
  "Data Kredit",
);
writeFileSync(
  `${OUT_DIR}/contoh-86-kolom.xlsx`,
  XLSX.write(fullBook, { type: "buffer", bookType: "xlsx" }),
);

console.log(`Selesai. File contoh tersimpan di ./${OUT_DIR}/`);
