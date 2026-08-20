import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "@/lib/supabase/config";
import { LOGIN_PATH, safeNextPath } from "@/lib/navigation";

/**
 * Menyegarkan sesi Supabase pada setiap request dan mewajibkan login untuk
 * seluruh permukaan yang menyentuh data kredit: dashboard, endpoint data
 * detail, dan halaman admin.
 *
 * Pembatasan lebih ketat (allowlist ADMIN_EMAILS untuk unggah data) ditegakkan
 * di halaman `/admin` dan route `/api/upload`, bukan di sini, supaya user yang
 * sudah login tetapi bukan admin mendapat pesan yang jelas alih-alih
 * dilempar bolak-balik ke halaman login.
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  // Tanpa konfigurasi Supabase tidak ada data asli yang bisa dibuka:
  // dashboard hanya menampilkan data contoh dan halaman admin menampilkan
  // instruksi setup, jadi request dibiarkan lewat.
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

  const { pathname, searchParams } = request.nextUrl;

  if (pathname === LOGIN_PATH) {
    if (user) {
      const target = safeNextPath(searchParams.get("next"));
      return NextResponse.redirect(new URL(target, request.url));
    }
    return response;
  }

  if (!user) {
    // Endpoint data menjawab 401 alih-alih redirect, supaya pemanggil
    // menerima kegagalan yang bisa ditangani, bukan HTML halaman login.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Sesi tidak ditemukan. Silakan login terlebih dahulu." },
        { status: 401 },
      );
    }

    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/", "/admin/:path*", "/api/records"],
};
