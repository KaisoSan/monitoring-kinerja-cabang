import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { mapKreditRecords, mapTargetCabang, readWorkbook } from "../src/lib/excel.ts";

/** Membaca file contoh hasil `npm run template` sebagai `File` (Node >= 20). */
async function loadFile(path: string, name: string): Promise<File> {
  const buffer = await readFile(path);
  return new File([new Uint8Array(buffer)], name);
}

test("readWorkbook melewati baris judul dan membersihkan header", async () => {
  const file = await loadFile("contoh/contoh-data-kredit.xlsx", "contoh-data-kredit.xlsx");
  const workbook = await readWorkbook(file);

  assert.equal(workbook.sheetName, "Data Kredit");
  assert.equal(workbook.rows.length, 6, "6 baris data setelah baris judul dibuang");

  const normalized = workbook.headerMap.map((entry) => entry.normalized);
  for (const expected of [
    "kode_fasilitas",
    "periode",
    "area_head",
    "cabang",
    "produk",
    "pengelola",
    "nama_debitur",
    "status_pipeline",
    "plafon",
    "baki_debet",
    "baki_debet_awal",
    "kolektibilitas",
    "dpd",
    "is_restruktur",
    "tanggal_booking",
  ]) {
    assert.ok(normalized.includes(expected), `header "${expected}" tidak terpetakan`);
  }
});

test("mapKreditRecords menghasilkan baris siap upsert dari file contoh", async () => {
  const file = await loadFile("contoh/contoh-data-kredit.xlsx", "contoh-data-kredit.xlsx");
  const workbook = await readWorkbook(file);
  const { rows, issues } = mapKreditRecords(workbook.rows, "2026-08-01");

  assert.equal(issues.length, 0);
  assert.equal(rows.length, 6);

  const first = rows[0];
  assert.equal(first.kode_fasilitas, "FAS-00001");
  assert.equal(first.periode, "2026-08-01");
  assert.equal(first.status_pipeline, "booking");
  assert.equal(first.plafon, 5_000_000_000);
  assert.equal(first.baki_debet, 4_250_000_000);
  assert.equal(first.tanggal_booking, "2026-03-12");
  assert.equal(first.is_restruktur, false);

  const restruktur = rows.find((row) => row.kode_fasilitas === "FAS-00002");
  assert.equal(restruktur?.is_restruktur, true);
  assert.equal(restruktur?.dpd, 45);
  assert.equal(restruktur?.kolektibilitas, 2);

  // "On Process" -> analisa, dan outstanding-nya dinolkan.
  const analisa = rows.find((row) => row.kode_fasilitas === "FAS-00003");
  assert.equal(analisa?.status_pipeline, "analisa");
  assert.equal(analisa?.baki_debet, 0);
  assert.equal(analisa?.plafon, 2_500_000_000);

  // "Realisasi" juga dianggap booking.
  const realisasi = rows.find((row) => row.kode_fasilitas === "FAS-00005");
  assert.equal(realisasi?.status_pipeline, "booking");
  assert.equal(realisasi?.kolektibilitas, 3);
});

test("mapTargetCabang membaca file target contoh", async () => {
  const file = await loadFile("contoh/contoh-target-cabang.xlsx", "contoh-target-cabang.xlsx");
  const workbook = await readWorkbook(file);
  const { rows, issues } = mapTargetCabang(workbook.rows, "2026-08-01");

  assert.equal(issues.length, 0);
  assert.equal(rows.length, 5);
  assert.equal(rows[0].cabang, "KCP Menteng");
  assert.equal(rows[0].produk, "SME");
  assert.equal(rows[0].periode, "2026-08-01");
  assert.equal(rows[0].target_baki_debet, 5_000_000_000);
  assert.equal(rows[0].target_booking_nominal, 1_200_000_000);
});

test("file 86 kolom terbaca menjadi field bertipe sekaligus snapshot kolom asli", async () => {
  const { DETAIL_COLUMNS } = await import("../src/lib/columns.ts");

  const file = await loadFile("contoh/contoh-86-kolom.xlsx", "contoh-86-kolom.xlsx");
  const workbook = await readWorkbook(file);

  assert.equal(workbook.rows.length, 3);
  assert.equal(workbook.rawRows.length, 3);

  const { rows, issues } = mapKreditRecords(workbook.rows, "2026-08-01", workbook.rawRows);
  assert.equal(issues.length, 0);
  assert.equal(rows.length, 3);

  // Kolom kunci file sumber terpetakan ke field bertipe yang dipakai pilar.
  const first = rows[0];
  assert.equal(first.kode_fasilitas, "FAS-86001");
  assert.equal(first.cabang, "KCP Menteng");
  assert.equal(first.nama_debitur, "PT Maju Sentosa");
  assert.equal(first.pengelola, "Andi Pratama");
  assert.equal(first.baki_debet, 4_250_000_000);
  assert.equal(first.plafon, 5_000_000_000);
  assert.equal(first.kolektibilitas, 1);
  assert.equal(first.periode, "2026-08-01");

  const kedua = rows[1];
  assert.equal(kedua.dpd, 45);
  assert.equal(kedua.kolektibilitas, 2);
  assert.equal(kedua.is_restruktur, true);

  // Seluruh kolom terisi tersedia di snapshot, termasuk yang tidak punya
  // padanan field bertipe. Sel kosong sengaja tidak disimpan.
  const raw = first.raw ?? {};
  const KOSONG_DI_FIXTURE = ["Tanggal_Tunda_JT"];
  const missing = DETAIL_COLUMNS.filter((column) => !Object.hasOwn(raw, column.key));
  assert.deepEqual(
    missing.map((column) => column.label),
    KOSONG_DI_FIXTURE,
    "setiap kolom sumber yang terisi harus punya kunci di snapshot",
  );

  assert.equal(raw.cek_bcm, "OK");
  assert.equal(raw.jenis_kur, "-");
  // "Produk" dan "JENIS KREDIT" beraliaskan sama, tetapi snapshot memisahkan.
  assert.equal(raw.produk, "SME");
  assert.equal(raw.jenis_kredit, "Komersial");
});

test("getCellValue jatuh ke field bertipe saat snapshot kosong", async () => {
  const { DETAIL_COLUMNS_BY_LABEL, getCellValue } = await import("../src/lib/columns.ts");

  const record = {
    kode_fasilitas: "FAS-1",
    periode: "2026-08-01",
    area_head: "AH 1",
    cabang: "KCP Menteng",
    produk: "SME",
    pengelola: "Andi",
    nama_debitur: "PT Maju",
    status_pipeline: "booking" as const,
    plafon: 1000,
    baki_debet: 900,
    baki_debet_awal: 800,
    kolektibilitas: 2,
    dpd: 10,
    is_restruktur: false,
    tanggal_booking: null,
    raw: {},
  };

  const cabang = DETAIL_COLUMNS_BY_LABEL.get("Nama Cab")!;
  const bcm = DETAIL_COLUMNS_BY_LABEL.get("CEK BCM")!;

  assert.equal(getCellValue(record, cabang), "KCP Menteng");
  // Tidak punya padanan bertipe, jadi tetap kosong.
  assert.equal(getCellValue(record, bcm), null);

  // Snapshot selalu menang atas field bertipe.
  const withRaw = { ...record, raw: { nama_cab: "KC Bandung" } };
  assert.equal(getCellValue(withRaw, cabang), "KC Bandung");
});
