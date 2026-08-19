import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isAdminEmail,
  isSupabaseConfigured,
} from "@/lib/supabase/config";

/**
 * Menyegarkan sesi Supabase pada setiap request dan menjaga halaman `/admin`
 * agar hanya bisa diakses user yang sudah login dan masuk allowlist admin.
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  // Tanpa konfigurasi Supabase, halaman admin sendiri yang menampilkan
  // instruksi setup, jadi biarkan request lewat.
  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Kegagalan jaringan ke Supabase tidak boleh membuat seluruh request 500;
  // anggap saja belum login sehingga user diarahkan ke halaman login.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }

  const isAdminRoute = request.nextUrl.pathname.startsWith("/admin");
  const isLoginRoute = request.nextUrl.pathname === "/admin/login";

  if (isAdminRoute && !isLoginRoute && !isAdminEmail(user?.email)) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoginRoute && isAdminEmail(user?.email)) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
