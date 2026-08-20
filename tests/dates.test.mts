import assert from "node:assert/strict";
import test from "node:test";

import { expandYear, isValidIsoDate, toFirstOfMonth, toIsoFromParts } from "../src/lib/dates.ts";
import { mapKreditRecords, toIsoDate, toPeriode } from "../src/lib/excel.ts";

/* ------------------------------------------------------------------ */
/* Pembentuk tanggal                                                   */
/* ------------------------------------------------------------------ */

test("toIsoFromParts menolak kombinasi yang tidak ada di kalender", () => {
  assert.equal(toIsoFromParts(2026, 6, 18), "2026-06-18");

  // Inilah dua bentuk yang sebelumnya lolos lalu ditolak PostgreSQL.
  assert.equal(toIsoFromParts(2026, 18, 1), null, "bulan ke-18");
  assert.equal(toIsoFromParts(2026, 2, 31), null, "31 Februari");

  assert.equal(toIsoFromParts(2026, 4, 31), null, "31 April");
  assert.equal(toIsoFromParts(2025, 2, 29), null, "29 Februari tahun bukan kabisat");
  assert.equal(toIsoFromParts(2024, 2, 29), "2024-02-29", "tahun kabisat sah");
  assert.equal(toIsoFromParts(2026, 0, 1), null);
  assert.equal(toIsoFromParts(1800, 6, 18), null, "di luar rentang tahun wajar");
});

test("isValidIsoDate memeriksa bentuk sekaligus keabsahan kalender", () => {
  assert.equal(isValidIsoDate("2026-06-18"), true);
  // Lolos pola \d{4}-\d{2}-\d{2}, tetapi tanggalnya tidak ada.
  assert.equal(isValidIsoDate("2026-18-01"), false);
  assert.equal(isValidIsoDate("2026-02-31"), false);
  assert.equal(isValidIsoDate("18/06/2026"), false);
  assert.equal(isValidIsoDate(""), false);
  assert.equal(isValidIsoDate(null), false);
});

test("expandYear memakai ambang abad 70", () => {
  assert.equal(expandYear(26), 2026);
  assert.equal(expandYear(69), 2069);
  assert.equal(expandYear(70), 1970);
  assert.equal(expandYear(98), 1998);
  assert.equal(expandYear(2026), 2026);
});

test("toFirstOfMonth menolak masukan yang tidak sah", () => {
  assert.equal(toFirstOfMonth("2026-06-18"), "2026-06-01");
  assert.equal(toFirstOfMonth("2026-18-01"), null);
});

/* ------------------------------------------------------------------ */
/* Parsing dari sel Excel                                              */
/* ------------------------------------------------------------------ */

test("toIsoDate membaca format Indonesia DD/MM/YYYY", () => {
  assert.equal(toIsoDate("18/06/2026"), "2026-06-18");
  assert.equal(toIsoDate("01/08/2026"), "2026-08-01");
  assert.equal(toIsoDate("18-06-2026"), "2026-06-18");
  assert.equal(toIsoDate("18.06.2026"), "2026-06-18");
  assert.equal(toIsoDate("8/6/2026"), "2026-06-08");
});

test("toIsoDate mengenali MM/DD/YYYY saat urutannya tidak mungkin DD/MM", () => {
  // Nilai persis yang menggagalkan unggahan: hari 18 berada di posisi bulan.
  assert.equal(toIsoDate("01/18/2026"), "2026-01-18");
  assert.equal(toIsoDate("1/18/2026"), "2026-01-18");
  assert.equal(toIsoDate("12/25/2026"), "2026-12-25");
});

test("toIsoDate memilih DD/MM saat benar-benar ambigu", () => {
  // Keduanya <= 12 sehingga tidak ada petunjuk; konvensi Indonesia dipakai.
  assert.equal(toIsoDate("06/07/2026"), "2026-07-06");
  assert.equal(toIsoDate("01/02/2026"), "2026-02-01");
});

test("toIsoDate menerima tahun dua digit, jam, dan format ISO", () => {
  assert.equal(toIsoDate("18/06/26"), "2026-06-18");
  assert.equal(toIsoDate("18/06/2026 00:00:00"), "2026-06-18");
  assert.equal(toIsoDate("18/06/2026 13:45"), "2026-06-18");
  assert.equal(toIsoDate("2026-06-18"), "2026-06-18");
  assert.equal(toIsoDate("2026-06-18T00:00:00"), "2026-06-18");
  assert.equal(toIsoDate("2026/06/18"), "2026-06-18");
});

test("toIsoDate membaca nama bulan Indonesia maupun Inggris", () => {
  assert.equal(toIsoDate("18 Juni 2026"), "2026-06-18");
  assert.equal(toIsoDate("18-Jun-2026"), "2026-06-18");
  assert.equal(toIsoDate("1 Agustus 2026"), "2026-08-01");
  assert.equal(toIsoDate("18 June 2026"), "2026-06-18");
  assert.equal(toIsoDate("Jun 18, 2026"), "2026-06-18");
  assert.equal(toIsoDate("Juni 18 2026"), "2026-06-18");
});

test("toIsoDate mengembalikan null untuk masukan yang tidak bisa diurai", () => {
  // Pengganti gagalnya seluruh batch: nilai buruk cukup menjadi null.
  assert.equal(toIsoDate("31/02/2026"), null, "31 Februari");
  assert.equal(toIsoDate("18/13/2026"), null, "bulan 13 di kedua posisi");
  assert.equal(toIsoDate("bukan tanggal"), null);
  assert.equal(toIsoDate("-"), null);
  assert.equal(toIsoDate("0"), null);
  assert.equal(toIsoDate("99/99/9999"), null);
  assert.equal(toIsoDate("2026"), null, "tahun saja bukan tanggal");
});

test("toIsoDate membaca serial Excel dan objek Date", () => {
  assert.equal(toIsoDate(45870), "2025-08-01");
  assert.equal(toIsoDate(new Date(2026, 5, 18)), "2026-06-18");
});

test("toPeriode selalu menghasilkan tanggal 1 yang sah", () => {
  assert.equal(toPeriode("18/06/2026"), "2026-06-01");
  assert.equal(toPeriode("01/18/2026"), "2026-01-01");
  assert.equal(toPeriode("31/02/2026"), null);
});

/* ------------------------------------------------------------------ */
/* Perilaku saat pemetaan baris                                        */
/* ------------------------------------------------------------------ */

test("tanggal bermasalah tidak menggagalkan baris lain", () => {
  const { rows, issues } = mapKreditRecords(
    [
      { kode_fasilitas: "A", cabang: "KCP A", periode: "01/18/2026", baki_debet: "1000" },
      { kode_fasilitas: "B", cabang: "KCP A", periode: "18/06/2026", baki_debet: "2000" },
      // Tidak bisa diurai: mundur ke periode default, baris tetap tersimpan.
      { kode_fasilitas: "C", cabang: "KCP A", periode: "31/02/2026", baki_debet: "3000" },
      {
        kode_fasilitas: "D",
        cabang: "KCP A",
        periode: "18/06/2026",
        baki_debet: "4000",
        tanggal_booking: "bukan tanggal",
      },
    ],
    "2026-08-01",
  );

  assert.equal(rows.length, 4, "tidak ada baris yang hilang");
  assert.equal(rows[0].periode, "2026-01-01");
  assert.equal(rows[1].periode, "2026-06-01");
  assert.equal(rows[2].periode, "2026-08-01", "mundur ke periode default");
  assert.equal(rows[3].tanggal_booking, null, "tanggal booking buruk menjadi null");

  // Perubahannya dilaporkan, bukan diam-diam.
  assert.equal(issues.length, 2);
  assert.ok(issues.some((i) => i.row === 4 && i.message.includes("31/02/2026")));
  assert.ok(issues.some((i) => i.row === 5 && i.message.includes("bukan tanggal")));

  // Seluruh tanggal yang tersimpan sah menurut PostgreSQL.
  for (const row of rows) {
    assert.ok(isValidIsoDate(row.periode), `periode tidak sah: ${row.periode}`);
    assert.ok(
      row.tanggal_booking === null || isValidIsoDate(row.tanggal_booking),
      `tanggal booking tidak sah: ${row.tanggal_booking}`,
    );
  }
});
