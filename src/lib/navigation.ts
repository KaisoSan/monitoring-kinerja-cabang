export const LOGIN_PATH = "/admin/login";

/**
 * Menyaring parameter `next` sebelum dipakai sebagai tujuan redirect.
 *
 * Hanya path internal yang diterima. Tanpa penyaringan ini, tautan seperti
 * `/admin/login?next=https://situs-lain` atau `next=//situs-lain` akan
 * memantulkan pengguna ke luar aplikasi setelah login (open redirect).
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next) return fallback;
  // Harus path absolut internal, bukan URL penuh maupun protocol-relative.
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  // Jangan kembalikan pengguna ke halaman login itu sendiri.
  if (next === LOGIN_PATH || next.startsWith(`${LOGIN_PATH}?`)) return fallback;
  return next;
}
