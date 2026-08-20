/**
 * Pembersih karakter yang ditolak PostgreSQL.
 *
 * Ekstrak dari sistem inti (host/mainframe) kerap membawa sisa byte yang tidak
 * pernah terlihat di Excel tetapi membuat penyimpanan gagal:
 *
 * - **NUL (`U+0000`)** — ditolak PostgreSQL pada tipe `text` MAUPUN `jsonb`.
 *   Pada `jsonb` galatnya muncul sebagai `unsupported Unicode escape
 *   sequence`, karena karakter tersebut tidak punya representasi yang sah di
 *   dalam dokumen JSON milik PostgreSQL.
 * - **Surrogate yatim** — separuh pasangan UTF-16 yang pasangannya hilang saat
 *   data dipotong. `JSON.stringify` menuliskannya apa adanya sebagai
 *   `\uD8xx`, dan PostgreSQL menolaknya dengan galat serupa.
 * - **Kontrol C0 lain** (kecuali tab, newline, carriage return) — diterima
 *   PostgreSQL, tetapi merusak tampilan tabel dan hasil ekspor.
 *
 * Pembersihan dijalankan di dua tempat: saat parsing di browser (agar
 * pratinjau dan payload sudah bersih) dan sekali lagi di server sebelum
 * upsert — payload dari browser tidak pernah dipercaya apa adanya.
 */

/** Menghitung karakter yang dibuang, untuk dilaporkan ke pengguna. */
export type SanitizeStats = { removed: number };

/** NUL dan kontrol C0 lain, kecuali tab (09), newline (0A), dan CR (0D). */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;
const HAS_SURROGATE = /[\uD800-\uDFFF]/;

/**
 * Membuang separuh pasangan surrogate yang tidak punya pasangan sah.
 * Ditulis manual (bukan regex lookbehind atau `String.prototype.toWellFormed`)
 * supaya hasilnya sama persis di server maupun di browser lama.
 */
function stripLoneSurrogates(text: string): string {
  let result = "";
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);

    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        result += text[i] + text[i + 1];
        i += 1;
      }
      // Surrogate tinggi tanpa pasangan: dibuang.
      continue;
    }

    // Surrogate rendah yang berdiri sendiri: dibuang.
    if (code >= 0xdc00 && code <= 0xdfff) continue;

    result += text[i];
  }
  return result;
}

/** Membersihkan satu string agar aman disimpan PostgreSQL. */
export function sanitizeText(value: string, stats?: SanitizeStats): string {
  let result = value.replace(CONTROL_CHARS, "");
  if (HAS_SURROGATE.test(result)) result = stripLoneSurrogates(result);

  if (stats && result.length !== value.length) {
    stats.removed += value.length - result.length;
  }
  return result;
}

/** `true` bila string mengandung karakter yang akan ditolak PostgreSQL. */
export function hasUnsafeCharacters(value: string): boolean {
  return sanitizeText(value) !== value;
}

/** Kunci yang tidak boleh ditulis ke objek biasa. */
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Membersihkan nilai apa pun secara rekursif: string dibersihkan, angka dan
 * boolean diteruskan, objek dan array ditelusuri isinya.
 *
 * Sengaja tidak memakai `JSON.parse(JSON.stringify(...).replace(...))`:
 * pendekatan itu hanya menangkap escape NUL yang terlihat di teks JSON,
 * melewatkan surrogate yatim, dan menyalin seluruh payload dua kali.
 */
export function sanitizeDeep<T>(value: T, stats?: SanitizeStats): T {
  if (typeof value === "string") {
    return sanitizeText(value, stats) as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeDeep(entry, stats)) as unknown as T;
  }

  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(key)) continue;
      result[sanitizeText(key, stats)] = sanitizeDeep(entry, stats);
    }
    return result as unknown as T;
  }

  return value;
}
