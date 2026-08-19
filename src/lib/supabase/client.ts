"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

/**
 * Klien Supabase untuk komponen client (dipakai di form login admin).
 * Mengembalikan `null` bila env belum dikonfigurasi supaya UI bisa
 * menampilkan pesan setup alih-alih melempar error saat render.
 */
export function createClient() {
  if (!isSupabaseConfigured) return null;
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
