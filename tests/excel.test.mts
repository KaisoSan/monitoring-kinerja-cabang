import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeHeader,
  toIsoDate,
  toNumber,
  toPeriode,
  toSnakeCase,
  toStatusPipeline,
  mapKreditRecords,
} from "../src/lib/excel.ts";

test("toSnakeCase membersihkan header berantakan", () => {
  assert.equal(toSnakeCase("  Nama Cabang / KCP "), "nama_cabang_kcp");
  assert.equal(toSnakeCase("Baki Debet (Rp)"), "baki_debet_rp");
  assert.equal(toSnakeCase("DPD  >90 Hari"), "dpd_90_hari");
  assert.equal(toSnakeCase("bakiDebetAwal"), "baki_debet_awal");
  assert.equal(toSnakeCase("Kolektibilitas\n(Kol)"), "kolektibilitas_kol");
  assert.equal(toSnakeCase(""), "");
});

test("normalizeHeader memetakan alias umum ke kolom kanonik", () => {
  assert.equal(normalizeHeader("Nama RM"), "pengelola");
  assert.equal(normalizeHeader("Outstanding"), "baki_debet");
  assert.equal(normalizeHeader("Nama Cabang / KCP"), "cabang");
  assert.equal(normalizeHeader("AH"), "area_head");
  assert.equal(normalizeHeader("Kolom Tak Dikenal"), "kolom_tak_dikenal");
});

test("toNumber memahami format angka Indonesia dan Inggris", () => {
  assert.equal(toNumber("Rp 1.234.567,89"), 1234567.89);
  assert.equal(toNumber("1,234,567.89"), 1234567.89);
  assert.equal(toNumber("1.234.567"), 1234567);
  assert.equal(toNumber("1,234,567"), 1234567);
  assert.equal(toNumber("1,5"), 1.5);
  assert.equal(toNumber("(500.000)"), -500000);
  assert.equal(toNumber("-2.500"), -2500);
  assert.equal(toNumber(""), 0);
  assert.equal(toNumber(null), 0);
  assert.equal(toNumber("-"), 0);
  assert.equal(toNumber(12.5), 12.5);
});

test("toIsoDate memahami serial Excel, string, dan Date", () => {
  assert.equal(toIsoDate(45870), "2025-08-01");
  assert.equal(toIsoDate("01/08/2026"), "2026-08-01");
  assert.equal(toIsoDate("2026-08-15"), "2026-08-15");
  assert.equal(toIsoDate(new Date(2026, 7, 15)), "2026-08-15");
  assert.equal(toIsoDate(""), null);
});

test("toPeriode selalu jatuh ke tanggal 1", () => {
  assert.equal(toPeriode("Agustus 2026"), "2026-08-01");
  assert.equal(toPeriode("2026-08-15"), "2026-08-01");
  assert.equal(toPeriode("Agu-26"), "2026-08-01");
});

test("toStatusPipeline menormalkan istilah tahapan", () => {
  assert.equal(toStatusPipeline("On Process"), "analisa");
  assert.equal(toStatusPipeline("BOOKING"), "booking");
  assert.equal(toStatusPipeline("Realisasi"), "booking");
  assert.equal(toStatusPipeline("apa pun"), "prospek");
});

test("mapKreditRecords menegakkan aturan bisnis", () => {
  const { rows, issues } = mapKreditRecords(
    [
      {
        kode_fasilitas: "F-001",
        cabang: "KCP Menteng",
        produk: "sme",
        pengelola: "Andi",
        nama_debitur: "PT Maju",
        status_pipeline: "Booking",
        baki_debet: "Rp 1.000.000.000",
        baki_debet_awal: "800.000.000",
        kolektibilitas: "2",
        dpd: "45",
        periode: "2026-08-01",
      },
      {
        kode_fasilitas: "F-002",
        cabang: "KCP Menteng",
        produk: "kur",
        pengelola: "Budi",
        nama_debitur: "CV Sejahtera",
        status_pipeline: "Prospek",
        // Outstanding pada baris non-booking harus dinolkan.
        baki_debet: "500.000.000",
        plafon: "500.000.000",
      },
      // Baris tanpa cabang dilewati.
      { kode_fasilitas: "F-003", pengelola: "Citra" },
      // Kode fasilitas duplikat dilewati.
      { kode_fasilitas: "F-001", cabang: "KCP Menteng", pengelola: "Andi" },
    ],
    "2026-08-01",
  );

  assert.equal(rows.length, 2);
  assert.equal(issues.length, 2);

  assert.equal(rows[0].baki_debet, 1_000_000_000);
  assert.equal(rows[0].produk, "SME");
  assert.equal(rows[0].kolektibilitas, 2);
  assert.equal(rows[0].dpd, 45);

  assert.equal(rows[1].baki_debet, 0, "prospek tidak boleh punya outstanding");
  assert.equal(rows[1].plafon, 500_000_000);
  assert.equal(rows[1].periode, "2026-08-01");
});

test("normalizeHeader melepas satuan di belakang nama kolom", () => {
  assert.equal(normalizeHeader("Plafond (Rp)"), "plafon");
  assert.equal(normalizeHeader("Outstanding  (Rp)"), "baki_debet");
  assert.equal(normalizeHeader("Target Outstanding (Rp)"), "target_baki_debet");
  assert.equal(normalizeHeader("DPD (Hari)"), "dpd");
  assert.equal(normalizeHeader("Baki Debet Awal (Juta)"), "baki_debet_awal");
  // Nama kolom yang memang berakhiran satuan tetap tidak hilang seluruhnya.
  assert.equal(normalizeHeader("Rp"), "rp");
});

test("normalizeHeader mengenali nama kolom dari file sumber 86 kolom", () => {
  assert.equal(normalizeHeader("Nama Cab"), "cabang");
  assert.equal(normalizeHeader("Nama Nas"), "nama_debitur");
  assert.equal(normalizeHeader("Bk Debet"), "baki_debet");
  assert.equal(normalizeHeader("Bk Dbt (IDR)"), "baki_debet");
  assert.equal(normalizeHeader("No Rek."), "kode_fasilitas");
  assert.equal(normalizeHeader("Maks Krd"), "plafon");
  assert.equal(normalizeHeader("Umur Tgk (hr)"), "dpd");
  assert.equal(normalizeHeader("Kol."), "kolektibilitas");
  assert.equal(normalizeHeader("Nama Pengelola"), "pengelola");
  assert.equal(normalizeHeader(".Tanggal."), "periode");
  assert.equal(normalizeHeader("Restrukturisasi"), "is_restruktur");
});

test("status disimpulkan saat file sumber tidak punya kolom status", () => {
  const { rows } = mapKreditRecords(
    [
      // Sudah berjalan: ada outstanding, walau kolom status tidak ada.
      { kode_fasilitas: "A", cabang: "KCP A", baki_debet: "1.000.000.000" },
      // Ada tanggal booking tapi outstanding sudah lunas.
      { kode_fasilitas: "B", cabang: "KCP A", baki_debet: "0", tanggal_booking: "01/02/2026" },
      // Tanpa keduanya: tetap dianggap prospek.
      { kode_fasilitas: "C", cabang: "KCP A", plafon: "500.000.000" },
      // Status eksplisit selalu menang atas inferensi.
      { kode_fasilitas: "D", cabang: "KCP A", baki_debet: "900.000.000", status_pipeline: "Prospek" },
    ],
    "2026-08-01",
  );

  assert.equal(rows[0].status_pipeline, "booking");
  assert.equal(rows[0].baki_debet, 1_000_000_000);

  assert.equal(rows[1].status_pipeline, "booking");
  assert.equal(rows[1].tanggal_booking, "2026-02-01");

  assert.equal(rows[2].status_pipeline, "prospek");
  assert.equal(rows[2].baki_debet, 0);

  assert.equal(rows[3].status_pipeline, "prospek");
  assert.equal(rows[3].baki_debet, 0, "status eksplisit tetap menolkan outstanding");
});
