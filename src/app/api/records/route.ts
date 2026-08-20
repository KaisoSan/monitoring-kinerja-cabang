import { NextResponse } from "next/server";
import { loadDetailRecords } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabase } from "@/lib/supabase/server";
import { EMPTY_SLICER, SLICER_KEYS, type SlicerState } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/**
 * Satu halaman data level rekening untuk Tabel Data Detail, mengikuti
 * slicer yang sedang aktif di dashboard.
 *
 * Endpoint ini mengembalikan field level rekening (CIF, nomor rekening, nama
 * nasabah), jadi wajib login. Ada tiga lapis penjagaan yang saling menutupi:
 * proxy menolak request tanpa sesi, pemeriksaan di bawah mengulanginya di
 * dalam route (kalau-kalau matcher proxy meleset), dan RLS `to authenticated`
 * pada tabel menjadi penjaga terakhir di sisi database.
 */
export async function GET(request: Request) {
  if (isSupabaseConfigured) {
    const supabase = await createServerSupabase();
    const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };

    if (!data?.user) {
      return NextResponse.json(
        { error: "Sesi tidak ditemukan. Silakan login terlebih dahulu." },
        { status: 401 },
      );
    }
  }

  const params = new URL(request.url).searchParams;

  const slicer: SlicerState = { ...EMPTY_SLICER };
  for (const key of SLICER_KEYS) {
    const value = params.get(key);
    if (value) slicer[key] = value;
  }

  const page = Number.parseInt(params.get("page") ?? "0", 10);
  const pageSize = Number.parseInt(params.get("pageSize") ?? "", 10);

  const result = await loadDetailRecords({
    slicer,
    periode: params.get("periode") ?? undefined,
    page: Number.isFinite(page) ? page : 0,
    pageSize: Number.isFinite(pageSize)
      ? Math.min(pageSize, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE,
  });

  return NextResponse.json(result);
}
