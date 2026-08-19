export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Dashboard tetap bisa dijalankan sebelum Supabase dikonfigurasi; saat env
 * belum diisi, data dashboard jatuh ke dataset contoh (lihat `sample-data.ts`).
 */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Email yang diizinkan mengakses halaman admin & endpoint upload. */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Kalau `ADMIN_EMAILS` dikosongkan, setiap user Supabase yang berhasil login
 * dianggap admin. Isi env tersebut di produksi untuk mempersempit akses.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowlist = adminEmails();
  if (allowlist.length === 0) return true;
  return allowlist.includes(email.toLowerCase());
}
