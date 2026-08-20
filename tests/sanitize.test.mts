import assert from "node:assert/strict";
import test from "node:test";

import {
  hasUnsafeCharacters,
  sanitizeDeep,
  sanitizeText,
  type SanitizeStats,
} from "../src/lib/sanitize.ts";
import { mapKreditRecords, readWorkbook, toText } from "../src/lib/excel.ts";

const NUL = "\u0000";
const HIGH_SURROGATE = "\uD83D"; // separuh dari emoji, tanpa pasangan
const LOW_SURROGATE = "\uDE00";

test("sanitizeText membuang NUL", () => {
  assert.equal(sanitizeText(`PT Maju${NUL} Sentosa`), "PT Maju Sentosa");
  assert.equal(sanitizeText(`${NUL}${NUL}`), "");
  assert.equal(sanitizeText("tanpa masalah"), "tanpa masalah");
});

test("sanitizeText membuang kontrol C0 tetapi mempertahankan tab dan newline", () => {
  assert.equal(sanitizeText("a\u0001b\u001Fc"), "abc");
  assert.equal(sanitizeText("a\tb\nc\rd"), "a\tb\nc\rd");
});

test("sanitizeText membuang surrogate yatim tanpa merusak emoji utuh", () => {
  assert.equal(sanitizeText(`KCP${HIGH_SURROGATE} Menteng`), "KCP Menteng");
  assert.equal(sanitizeText(`${LOW_SURROGATE}Bandung`), "Bandung");

  // Pasangan yang sah harus tetap utuh.
  const emoji = `${HIGH_SURROGATE}${LOW_SURROGATE}`;
  assert.equal(sanitizeText(`Cabang ${emoji}`), `Cabang ${emoji}`);
  assert.equal(sanitizeText("Kopi ☕ aman"), "Kopi ☕ aman");
});

test("sanitizeText menghitung karakter yang dibuang", () => {
  const stats: SanitizeStats = { removed: 0 };
  sanitizeText(`a${NUL}b${NUL}c`, stats);
  sanitizeText("bersih", stats);
  sanitizeText(`x${HIGH_SURROGATE}`, stats);
  assert.equal(stats.removed, 3);
});

test("hasUnsafeCharacters menandai string bermasalah", () => {
  assert.equal(hasUnsafeCharacters(`a${NUL}b`), true);
  assert.equal(hasUnsafeCharacters(HIGH_SURROGATE), true);
  assert.equal(hasUnsafeCharacters("PT Maju Sentosa"), false);
});

test("sanitizeDeep menelusuri objek, array, dan kunci", () => {
  const stats: SanitizeStats = { removed: 0 };
  const cleaned = sanitizeDeep(
    {
      [`nama${NUL}_cab`]: `KCP${NUL} Menteng`,
      baki_debet: 1_000_000,
      aktif: true,
      kosong: null,
      daftar: [`a${NUL}`, 2, `b${HIGH_SURROGATE}`],
      bersarang: { catatan: `oke${NUL}` },
    },
    stats,
  );

  assert.deepEqual(cleaned, {
    nama_cab: "KCP Menteng",
    baki_debet: 1_000_000,
    aktif: true,
    kosong: null,
    daftar: ["a", 2, "b"],
    bersarang: { catatan: "oke" },
  });
  assert.equal(stats.removed, 5);
});

test("sanitizeDeep menolak kunci yang mencemari prototipe", () => {
  const cleaned = sanitizeDeep({ __proto__: { jahat: true }, aman: "ya" }) as Record<
    string,
    unknown
  >;
  assert.equal(cleaned.aman, "ya");
  assert.equal(Object.hasOwn(cleaned, "__proto__"), false);
  assert.equal((cleaned as { jahat?: boolean }).jahat, undefined);
});

test("hasil sanitizeDeep aman dilewatkan JSON tanpa escape terlarang", () => {
  // PostgreSQL menolak dokumen jsonb yang memuat escape \\u0000 maupun
  // surrogate yatim. Inilah bentuk galat yang dilaporkan pengguna.
  const kotor = {
    nama: `PT Maju${NUL} Sentosa`,
    catatan: `terpotong${HIGH_SURROGATE}`,
  };

  const sebelum = JSON.stringify(kotor);
  assert.ok(sebelum.includes("\\u0000"), "payload mentah memang bermasalah");
  assert.ok(/\\ud[89ab][0-9a-f]{2}/i.test(sebelum), "ada surrogate yatim");

  const sesudah = JSON.stringify(sanitizeDeep(kotor));
  assert.equal(sesudah.includes("\\u0000"), false);
  assert.equal(/\\ud[89ab][0-9a-f]{2}/i.test(sesudah), false);
  assert.equal(JSON.parse(sesudah).nama, "PT Maju Sentosa");
});

test("toText membersihkan NUL saat parsing di browser", () => {
  assert.equal(toText(`KCP${NUL} Menteng`), "KCP Menteng");
  assert.equal(toText(`${NUL}`), "");
  assert.equal(toText(`${NUL}`, "cadangan"), "cadangan");
});

test("mapKreditRecords menghasilkan baris tanpa karakter terlarang", () => {
  const { rows } = mapKreditRecords(
    [
      {
        kode_fasilitas: `FAS-001${NUL}`,
        cabang: `KCP${NUL} Menteng`,
        produk: "sme",
        pengelola: `Andi${HIGH_SURROGATE} Pratama`,
        nama_debitur: `PT Maju${NUL} Sentosa`,
        baki_debet: "1.000.000.000",
        periode: "2026-08-01",
      },
    ],
    "2026-08-01",
    [{ nama_nas: `PT Maju${NUL} Sentosa`, cek_bcm: `OK${NUL}` }],
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].kode_fasilitas, "FAS-001");
  assert.equal(rows[0].cabang, "KCP Menteng");
  // Lewat round-trip XLSX, surrogate yatim sudah diganti menjadi U+FFFD oleh
  // penulis XML-nya. U+FFFD sah disimpan PostgreSQL, jadi sengaja tidak ikut
  // dibuang: karakter itu justru penanda ada kerusakan data di hulu.
  assert.ok(rows[0].pengelola.startsWith("Andi Pratama"));
  assert.equal(rows[0].nama_debitur, "PT Maju Sentosa");
  assert.equal(rows[0].raw?.nama_nas, "PT Maju Sentosa");
  assert.equal(rows[0].raw?.cek_bcm, "OK");

  const serialized = JSON.stringify(rows);
  assert.equal(serialized.includes("\\u0000"), false);
  assert.equal(/\\ud[89ab][0-9a-f]{2}/i.test(serialized), false);
});

test("file Excel berisi NUL terbaca dan tersimpan bersih (jalur nyata)", async () => {
  const XLSX = await import("xlsx");

  // Meniru ekstrak sistem inti: NUL menempel di nilai sel maupun di nama
  // kolom, plus satu surrogate yatim sisa pemotongan teks.
  const sheet = XLSX.utils.aoa_to_sheet([
    ["LAPORAN KREDIT"],
    [],
    ["No Rek.", "Nama Cab\u0000", "Nama Nas", "Nama Pengelola", "Bk Debet", "CEK BCM"],
    [
      "FAS-0001\u0000",
      "KCP\u0000 Menteng",
      "PT Maju\u0000 Sentosa",
      "Andi Pratama\uD83D",
      "1.000.000.000",
      "OK\u0000",
    ],
  ]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Data");
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const file = new File([new Uint8Array(buffer)], "kotor.xlsx");
  const workbook = await readWorkbook(file);
  const { rows, issues } = mapKreditRecords(workbook.rows, "2026-08-01", workbook.rawRows);

  assert.equal(issues.length, 0);
  assert.equal(rows.length, 1);

  // Kolom tetap terpetakan walau nama headernya membawa NUL.
  assert.equal(rows[0].cabang, "KCP Menteng");
  assert.equal(rows[0].kode_fasilitas, "FAS-0001");
  assert.equal(rows[0].nama_debitur, "PT Maju Sentosa");
  // Lewat round-trip XLSX, surrogate yatim sudah diganti menjadi U+FFFD oleh
  // penulis XML-nya. U+FFFD sah disimpan PostgreSQL, jadi sengaja tidak ikut
  // dibuang: karakter itu justru penanda ada kerusakan data di hulu.
  assert.ok(rows[0].pengelola.startsWith("Andi Pratama"));
  assert.equal(rows[0].baki_debet, 1_000_000_000);
  assert.equal(rows[0].raw?.cek_bcm, "OK");

  // Inilah yang sebelumnya membuat PostgreSQL menolak seluruh batch.
  const payload = JSON.stringify({ dataset: "kredit_records", rows });
  assert.equal(payload.includes("\\u0000"), false, "payload masih memuat NUL");
  assert.equal(
    /\\ud[89ab][0-9a-f]{2}/i.test(payload),
    false,
    "payload masih memuat surrogate yatim",
  );
});
