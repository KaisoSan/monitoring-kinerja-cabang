import assert from "node:assert/strict";
import test from "node:test";

import { parseNominal } from "../src/components/ui/NeuCurrencyInput.tsx";

test("parseNominal menyaring apa pun yang diketik menjadi angka bulat", () => {
  assert.equal(parseNominal("5000000000"), 5_000_000_000);
  // Pemisah ribuan yang ditampilkan ikut terbaca kembali.
  assert.equal(parseNominal("5.000.000.000"), 5_000_000_000);
  assert.equal(parseNominal("Rp 1.250.000"), 1_250_000);
  assert.equal(parseNominal("1 250 000"), 1_250_000);
});

test("parseNominal memperlakukan isian kosong dan tak bernilai sebagai nol", () => {
  assert.equal(parseNominal(""), 0);
  assert.equal(parseNominal("abc"), 0);
  assert.equal(parseNominal("-"), 0);
  assert.equal(parseNominal("Rp"), 0);
});

test("parseNominal tidak menghasilkan angka negatif atau pecahan", () => {
  // Tanda minus dan koma ikut tersaring, sehingga nominal selalu bulat positif.
  assert.equal(parseNominal("-5000"), 5000);
  assert.equal(parseNominal("1.500,75"), 150075);
  assert.ok(Number.isSafeInteger(parseNominal("999999999999999")));
});

test("parseNominal tidak mengembalikan nilai di luar rentang aman", () => {
  // Ketikan yang terlalu panjang tidak boleh berubah menjadi angka yang
  // kehilangan presisi lalu tersimpan diam-diam.
  const kepanjangan = "9".repeat(25);
  assert.equal(parseNominal(kepanjangan), 0);
});
