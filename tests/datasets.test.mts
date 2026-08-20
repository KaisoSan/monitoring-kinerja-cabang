import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";

import { readAllSheets } from "../src/lib/excel.ts";
import { mapAkunRecords, mapDpkLooser, parseUploadFile } from "../src/lib/datasets.ts";

function toFile(sheets: Record<string, unknown[][]>, name: string): File {
  const book = XLSX.utils.book_new();
  for (const [sheetName, aoa] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(aoa), sheetName);
  }
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new File([new Uint8Array(buffer)], name);
}

/* ------------------------------------------------------------------ */
/* Top 30 Looser DPK                                                   */
/* ------------------------------------------------------------------ */

/**
 * Meniru struktur berkas asli: judul di baris 2, judul kolom di baris 4,
 * kolom dimensi hanya terisi pada baris data pertama, dan tanggal pembanding
 * hanya tersedia di judul kolom.
 */
const DPK_HEADER = [
  "S/C", "Cabang", "Outlet", "Jenis Produk", "Ranking", "CIF", "Nama", "Segmen",
  "Saldo 31 Juli 2026", "Saldo 11 Agustus 2026", "∆Saldo",
];

function dpkSheet(outlet: string, cabang: string, rows: unknown[][]): unknown[][] {
  return [
    ["TOP 30 LOOSER PER 31 JULI 2026 VS 11 AGUSTUS 2026"],
    [],
    DPK_HEADER,
    ...rows.map((row, index) =>
      index === 0 ? ["W18", cabang, outlet, "DPK", ...row] : ["", "", "", "", ...row],
    ),
  ];
}

test("DPK: membaca seluruh sheet outlet dan meneruskan kolom dimensi", async () => {
  const file = toFile(
    {
      ASEMBAGUS: dpkSheet("ASEMBAGUS", "SITUBONDO", [
        [1, "10675490809", "SMAS DARUL ULUM", "SME", "617001000", "467001000", "-150000000"],
        [2, "10585427634", "YAYASAN P2S3", "SBP", "95602078", "35602078", "-60000000"],
      ]),
      // Cabang sengaja dikosongkan, seperti pada berkas asli.
      BESUKI: dpkSheet("BESUKI", "", [
        [1, "9892472541", "KARINDA HUSADA", "SBP", "439541930", "90541930", "-349000000"],
      ]),
      Sheet3: [],
    },
    "looser.xlsx",
  );

  const { sheets } = await readAllSheets(file);
  const result = mapDpkLooser(sheets, "2026-12-01");

  assert.equal(result.rows.length, 3);
  assert.deepEqual(result.skippedSheets, ["Sheet3"], "sheet kosong dilewati, bukan menggagalkan");

  // Tanggal pembanding hanya ada di judul kolom.
  assert.equal(result.tanggalAwal, "2026-07-31");
  assert.equal(result.tanggalAkhir, "2026-08-11");
  // Periode mengikuti tanggal akhir, bukan periode default.
  assert.equal(result.rows[0].periode, "2026-08-01");

  // Kolom dimensi hanya ditulis di baris pertama tiap sheet.
  const asembagus = result.rows.filter((row) => row.outlet === "ASEMBAGUS");
  assert.equal(asembagus.length, 2);
  assert.equal(asembagus[1].sc, "W18", "S/C diteruskan ke baris berikutnya");
  assert.equal(asembagus[1].jenis_produk, "DPK");
  assert.equal(asembagus[1].cabang, "SITUBONDO");

  // Sheet BESUKI tidak menuliskan cabang; diisi dari sheet lain pada berkas sama.
  const besuki = result.rows.find((row) => row.outlet === "BESUKI");
  assert.equal(besuki?.cabang, "SITUBONDO");

  // "Segmen" dan "Jenis Produk" tidak boleh saling menimpa.
  assert.equal(asembagus[0].segmen, "SME");
  assert.equal(asembagus[1].segmen, "SBP");
  assert.equal(asembagus[0].jenis_produk, "DPK");
});

test("DPK: selisih dihitung ulang dari kedua kolom saldo", async () => {
  const file = toFile(
    {
      // Kolom ∆Saldo sengaja diisi angka yang salah.
      OUTLET_A: dpkSheet("OUTLET_A", "CABANG_A", [
        [1, "111", "NASABAH SATU", "SME", "1000000", "400000", "999"],
      ]),
    },
    "looser.xlsx",
  );

  const { sheets } = await readAllSheets(file);
  const { rows } = mapDpkLooser(sheets, "2026-08-01");

  assert.equal(rows[0].saldo_awal, 1_000_000);
  assert.equal(rows[0].saldo_akhir, 400_000);
  assert.equal(rows[0].delta_saldo, -600_000, "diambil dari selisih, bukan kolom ∆Saldo");
});

test("DPK: sheet tanpa dua kolom saldo bertanggal dilewati dengan catatan", async () => {
  const file = toFile(
    {
      RUSAK: [
        ["JUDUL"],
        [],
        ["S/C", "Cabang", "Outlet", "CIF", "Nama", "∆Saldo"],
        ["W18", "CAB", "RUSAK", "111", "NASABAH", "-100"],
      ],
    },
    "looser.xlsx",
  );

  const { sheets } = await readAllSheets(file);
  const result = mapDpkLooser(sheets, "2026-08-01");

  assert.equal(result.rows.length, 0);
  assert.deepEqual(result.skippedSheets, ["RUSAK"]);
  assert.ok(result.issues[0]?.message.includes("Saldo <tanggal>"));
});

/* ------------------------------------------------------------------ */
/* Data mentah akun                                                    */
/* ------------------------------------------------------------------ */

const AKUN_HEADER = [
  "BNI_CIF_KEY", "NAMA_DEBITUR", "No_PK", "AREA", "BRANCH_CODE", "BRANCH_NAME",
  "KODE_OUTLET", "NAMA_OUTLET", "NAMA_AKK", "Product_Name5", "TYPE2", "program",
  "SEGMEN_EWS", "SEGMEN_KELOLA", "Sektor_Ekonomi", "Ket_Status",
  // Nama persis dari berkas asli; akhiran IDR bagian dari judul kolom.
  "BNI_COMMITMENT_BAL_IDR", "BAKI_DEBET", "OUTSTANDING", "SALDO_AKHIR_",
  "Total_Tunggakkan", "Total_Kewajiban", "DPD", "DPD_Num", "GOLONGAN",
  "RATE_NEW", "ACCOUNT_OPEN_DATE", "Tgl_Jatuh_Tempo", "ID_NUMBER", "TELP_HP1",
];

const akunRow = (cif: string, pk: string, cabang: string, extra: Partial<Record<string, unknown>> = {}) => [
  cif, "NASABAH UJI", pk, "Malang", "121", cabang, "0", cabang, "AKK SATU",
  "BNI Griya", "STA", "REGULER", "", "Stay", "11", "Fully Advance",
  "100000000", extra.baki ?? "6114388", "6114388", "6114388",
  extra.tunggak ?? "916410", "1991356", extra.dpd ?? "2. x-days", extra.dpdNum ?? "2",
  extra.golongan ?? "2", "13.5", "02/12/2011", "01/12/2026",
  "3573xxxxxxxx0001", "081200000000",
];

test("Akun: membaca OLD_ACCOUNT dan NEW_ACCOUNT, mengabaikan sheet lain", async () => {
  const file = toFile(
    {
      // Nama sheet asli memakai akhiran garis bawah.
      OLD_ACCOUNT_: [AKUN_HEADER, akunRow("9057576889", "2011/368/GRIYA", "MALANG")],
      NEW_ACCOUNT_: [AKUN_HEADER, akunRow("9218241582", "2012/036/GRIYA", "SITUBONDO")],
      Catatan: [["ini bukan tabel akun"]],
    },
    "akun.xlsx",
  );

  const { sheets } = await readAllSheets(file);
  const result = mapAkunRecords(sheets, "2026-06-01");

  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.skippedSheets, ["Catatan"]);
  assert.deepEqual(
    result.perSumber.map((entry) => [entry.sumber, entry.jumlah]),
    [["old", 1], ["new", 1]],
  );

  const old = result.rows.find((row) => row.sumber === "old")!;
  assert.equal(old.cif, "9057576889");
  assert.equal(old.branch_name, "MALANG");
  assert.equal(old.nama_akk, "AKK SATU");
  assert.equal(old.produk, "BNI Griya");
  assert.equal(old.baki_debet, 6_114_388);
  assert.equal(old.plafon, 100_000_000, "kolom BNI_COMMITMENT_BAL_IDR terbaca");
  assert.equal(old.total_tunggakan, 916_410, "kolom sumber dieja Tunggakkan");
  assert.equal(old.dpd_kategori, "2. x-days");
  assert.equal(old.dpd_hari, 2);
  assert.equal(old.golongan, 2);
  assert.equal(old.suku_bunga, 13.5);
  assert.equal(old.tanggal_buka, "2011-12-02");
  assert.equal(old.tanggal_jatuh_tempo, "2026-12-01");
  assert.equal(old.periode, "2026-06-01");

  // Kolom PII tidak boleh ikut tersimpan.
  const serialized = JSON.stringify(result.rows);
  assert.equal(serialized.includes("3573xxxxxxxx0001"), false, "NIK ikut tersimpan");
  assert.equal(serialized.includes("081200000000"), false, "nomor telepon ikut tersimpan");
});

test("Akun: sheet NEW_ACCOUNT tanpa data dicatat, bukan dianggap gagal", async () => {
  const file = toFile(
    {
      OLD_ACCOUNT_: [AKUN_HEADER, akunRow("1", "PK-1", "MALANG")],
      NEW_ACCOUNT_: [AKUN_HEADER],
    },
    "akun.xlsx",
  );

  const { sheets } = await readAllSheets(file);
  const result = mapAkunRecords(sheets, "2026-06-01");

  assert.equal(result.rows.length, 1);
  assert.equal(result.issues.length, 0);
  const kosong = result.perSumber.find((entry) => entry.sumber === "new");
  assert.equal(kosong?.jumlah, 0);
});

test("Akun: kode_akun tetap unik walau No_PK dan CIF kembar", async () => {
  const file = toFile(
    {
      OLD_ACCOUNT_: [
        AKUN_HEADER,
        akunRow("999", "PK-SAMA", "MALANG"),
        akunRow("999", "PK-SAMA", "MALANG"),
        akunRow("999", "PK-SAMA", "MALANG"),
      ],
    },
    "akun.xlsx",
  );

  const { sheets } = await readAllSheets(file);
  const { rows } = mapAkunRecords(sheets, "2026-06-01");

  assert.equal(rows.length, 3, "baris kembar tidak boleh hilang");
  assert.equal(new Set(rows.map((row) => row.kode_akun)).size, 3);
  // Berkas yang sama menghasilkan kunci yang sama pada unggahan berikutnya.
  const ulang = mapAkunRecords(sheets, "2026-06-01").rows.map((row) => row.kode_akun);
  assert.deepEqual(rows.map((row) => row.kode_akun), ulang);
});

/* ------------------------------------------------------------------ */
/* Gerbang unggah                                                      */
/* ------------------------------------------------------------------ */

test("parseUploadFile menyeragamkan hasil untuk dataset multi-sheet", async () => {
  const dpk = await parseUploadFile(
    toFile(
      { A: dpkSheet("A", "CAB", [[1, "111", "NAS", "SME", "1000", "400", "-600"]]), Kosong: [] },
      "looser.xlsx",
    ),
    "dpk_looser",
    "2026-08-01",
  );

  assert.equal(dpk.multiSheet, true);
  assert.equal(dpk.rows.length, 1);
  assert.equal(dpk.sheetLabel, "A");
  assert.ok(dpk.notes.some((note) => note.includes("2026-07-31")));
  assert.ok(dpk.notes.some((note) => note.includes("Kosong")));

  const akun = await parseUploadFile(
    toFile({ OLD_ACCOUNT_: [AKUN_HEADER, akunRow("1", "PK-1", "MALANG")] }, "akun.xlsx"),
    "akun_records",
    "2026-06-01",
  );

  assert.equal(akun.multiSheet, true);
  assert.equal(akun.rows.length, 1);
  assert.ok(akun.notes.some((note) => note.includes("PII")));
});
