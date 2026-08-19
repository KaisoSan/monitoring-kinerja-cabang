import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

/**
 * Klien Supabase untuk Server Component / Route Handler.
 * Sesi disimpan di cookie sehingga status login admin ikut terbaca di server.
 */
export async function createServerSupabase() {
  if (!isSupabaseConfigured) return null;
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component tidak boleh menulis cookie; refresh sesi
          // sudah ditangani oleh middleware, jadi aman untuk diabaikan.
        }
      },
    },
  });
}
