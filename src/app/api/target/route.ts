import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { isAdminEmail, isSupabaseConfigured } from "@/lib/supabase/config";
import { isValidIsoDate, toFirstOfMonth } from "@/lib/dates";
import { sanitizeText } from "@/lib/sanitize";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/** Batas atas yang masih masuk akal untuk target satu cabang (Rp 1.000 T). */
const MAX_NOMINAL = 1e15;

type Json = Record<string, unknown>;

/**
 * Manajemen Target: mengisi dropdown dan menyimpan target dari layar.
 *
 * Penjagaannya sama seperti route unggah — membaca cukup sesi yang valid,
 * sedangkan menyimpan menuntut email yang terdaftar pada `ADMIN_EMAILS`.
 * Penulisan memakai service role karena `target_cabang` sengaja tidak punya
 * kebijakan RLS untuk tulis.
 */

async function requireSession() {
  if (!isSupabaseConfigured) {
    return {
      error: NextResponse.json(
        { error: "Supabase belum dikonfigurasi pada server." },
        { status: 503 },
      ),
    };
  }

  const supabase = await createServerSupabase();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  const user = data?.user ?? null;

  if (!user || !supabase) {
    return {
      error: NextResponse.json(
        { error: "Sesi tidak ditemukan. Silakan login terlebih dahulu." },
        { status: 401 },
      ),
    };
  }

  return { supabase, user };
}

/* ------------------------------------------------------------------ */
/* GET — pilihan dropdown + target yang sudah tersimpan                */
/* ------------------------------------------------------------------ */

export async function GET(request: Request) {
  const session = await requireSession();
  if ("error" in session) return session.error;
  const { supabase } = session;

  const params = new URL(request.url).searchParams;
  const periode = toFirstOfMonth(params.get("periode") ?? "") ?? null;

  const [dimensiQuery, targetQuery] = await Promise.all([
    supabase.from("dimensi_kredit").select("area_head, cabang, produk"),
    periode
      ? supabase
          .from("target_cabang")
          .select("periode, area_head, cabang, produk, target_baki_debet, target_booking_nominal")
          .eq("periode", periode)
          .order("cabang", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (dimensiQuery.error) {
    return NextResponse.json(
      {
        error:
          `Gagal membaca daftar cabang: ${dimensiQuery.error.message}. ` +
          "Jalankan ulang supabase/schema.sql agar view dimensi_kredit terbentuk.",
      },
      { status: 500 },
    );
  }
  if (targetQuery.error) {
    return NextResponse.json(
      { error: `Gagal membaca target tersimpan: ${targetQuery.error.message}` },
      { status: 500 },
    );
  }

  const dimensi = (dimensiQuery.data ?? []) as unknown as Json[];
  const tersimpan = (targetQuery.data ?? []) as unknown as Json[];

  // Cabang boleh punya beberapa produk; daftarnya diringkas di sini supaya
  // browser tidak perlu mengolah ulang.
  const areaPerCabang = new Map<string, string>();
  const cabangSet = new Set<string>();
  const produkSet = new Set<string>();

  for (const row of dimensi) {
    const cabang = str(row.cabang);
    const produk = str(row.produk);
    if (cabang) {
      cabangSet.add(cabang);
      if (!areaPerCabang.has(cabang)) areaPerCabang.set(cabang, str(row.area_head, "Tanpa Area Head"));
    }
    if (produk) produkSet.add(produk);
  }

  // Produk yang hanya pernah muncul di target tetap ditawarkan.
  for (const row of tersimpan) {
    const produk = str(row.produk);
    const cabang = str(row.cabang);
    if (produk) produkSet.add(produk);
    if (cabang) cabangSet.add(cabang);
  }

  return NextResponse.json({
    periode,
    cabang: [...cabangSet].sort((a, b) => a.localeCompare(b, "id-ID")),
    produk: [...produkSet].sort((a, b) => a.localeCompare(b, "id-ID")),
    areaPerCabang: Object.fromEntries(areaPerCabang),
    targets: tersimpan.map((row) => ({
      periode: str(row.periode),
      area_head: str(row.area_head, "Tanpa Area Head"),
      cabang: str(row.cabang),
      produk: str(row.produk),
      target_baki_debet: num(row.target_baki_debet),
      target_booking_nominal: num(row.target_booking_nominal),
    })),
  });
}

/* ------------------------------------------------------------------ */
/* POST — simpan satu target (upsert)                                  */
/* ------------------------------------------------------------------ */

export async function POST(request: Request) {
  const session = await requireSession();
  if ("error" in session) return session.error;
  const { user } = session;

  if (!isAdminEmail(user.email)) {
    return NextResponse.json(
      { error: "Akun ini tidak memiliki akses untuk mengubah target." },
      { status: 403 },
    );
  }

  let body: Json;
  try {
    body = (await request.json()) as Json;
  } catch {
    return NextResponse.json({ error: "Body request bukan JSON yang valid." }, { status: 400 });
  }

  // Periode dinormalkan ke tanggal 1, sama seperti data yang masuk dari Excel,
  // supaya keduanya bertemu pada kunci unik yang sama.
  const periode = toFirstOfMonth(text(body.periode, "", 10)) ?? null;
  const cabang = text(body.cabang, "", 120);
  const produk = text(body.produk, "", 60).toUpperCase();

  const masalah: string[] = [];
  if (!periode || !isValidIsoDate(periode)) masalah.push("Periode belum dipilih atau tidak sah.");
  if (!cabang) masalah.push("Cabang belum dipilih.");
  if (!produk) masalah.push("Produk belum dipilih.");

  const bakiDebet = nominal(body.target_baki_debet);
  const booking = nominal(body.target_booking_nominal);
  if (bakiDebet === null) masalah.push("Target Outstanding harus berupa angka 0 atau lebih.");
  if (booking === null) masalah.push("Target Booking harus berupa angka 0 atau lebih.");

  if (masalah.length > 0) {
    return NextResponse.json({ error: masalah.join(" ") }, { status: 400 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY belum diatur di server." },
      { status: 503 },
    );
  }

  const baris = {
    periode: periode!,
    area_head: text(body.area_head, "Tanpa Area Head", 120),
    cabang,
    produk,
    target_baki_debet: bakiDebet!,
    target_booking_nominal: booking!,
  };

  const { error } = await admin
    .from("target_cabang")
    .upsert(baris, { onConflict: "periode,cabang,produk" });

  if (error) {
    return NextResponse.json(
      { error: `Gagal menyimpan target: ${error.message}` },
      { status: 500 },
    );
  }

  // Jejak perubahan dicatat setelahnya; kegagalannya tidak membatalkan
  // penyimpanan target yang sudah berhasil.
  await admin.from("target_logs").insert({
    periode: baris.periode,
    cabang: baris.cabang,
    produk: baris.produk,
    target_baki_debet: baris.target_baki_debet,
    target_booking_nominal: baris.target_booking_nominal,
    changed_by: user.email ?? null,
  });

  return NextResponse.json({ saved: baris });
}

/* ------------------------------------------------------------------ */
/* Util                                                                */
/* ------------------------------------------------------------------ */

function text(value: unknown, fallback: string, maxLength = 200): string {
  if (typeof value !== "string") return fallback;
  const trimmed = sanitizeText(value).trim().slice(0, maxLength);
  return trimmed || fallback;
}

/** Nominal wajib berupa angka terhingga, tidak negatif, dan masuk akal. */
function nominal(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0 || parsed > MAX_NOMINAL) return null;
  return Math.round(parsed);
}

function num(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}
