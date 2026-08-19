/**
 * Membuat file Excel contoh dengan header yang sengaja "berantakan"
 * (spasi ganda, kapitalisasi campur, satuan dalam kurung, baris judul di
 * atas header) untuk menguji pembersih kolom di halaman admin.
 *
 * Jalankan: npm run template
 */
import { mkdirSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";

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
function buildSheet(title, headers, rows) {
  return XLSX.utils.aoa_to_sheet([
    [title],
    ["Dicetak 1 Agustus 2026"],
    [],
    headers,
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

console.log(`Selesai. File contoh tersimpan di ./${OUT_DIR}/`);
