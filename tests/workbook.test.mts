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
