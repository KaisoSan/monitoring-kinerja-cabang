import assert from "node:assert/strict";
import test from "node:test";

import { LOGIN_PATH, safeNextPath } from "../src/lib/navigation.ts";

test("safeNextPath meloloskan path internal", () => {
  assert.equal(safeNextPath("/"), "/");
  assert.equal(safeNextPath("/admin"), "/admin");
  assert.equal(safeNextPath("/admin/pengaturan?tab=1"), "/admin/pengaturan?tab=1");
});

test("safeNextPath menolak tujuan di luar aplikasi", () => {
  // URL penuh dan protocol-relative adalah jalur klasik open redirect.
  assert.equal(safeNextPath("https://situs-lain.example"), "/");
  assert.equal(safeNextPath("//situs-lain.example"), "/");
  assert.equal(safeNextPath("/\\situs-lain.example"), "/");
  assert.equal(safeNextPath("javascript:alert(1)"), "/");
  assert.equal(safeNextPath("admin"), "/");
});

test("safeNextPath tidak memantulkan pengguna kembali ke halaman login", () => {
  assert.equal(safeNextPath(LOGIN_PATH), "/");
  assert.equal(safeNextPath(`${LOGIN_PATH}?next=/admin`), "/");
});

test("safeNextPath memakai fallback saat nilainya kosong", () => {
  assert.equal(safeNextPath(null), "/");
  assert.equal(safeNextPath(undefined), "/");
  assert.equal(safeNextPath(""), "/");
  assert.equal(safeNextPath(null, "/admin"), "/admin");
});
