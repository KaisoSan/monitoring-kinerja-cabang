import { NextResponse } from "next/server";
import { loadDetailRecords } from "@/lib/data";
import { EMPTY_SLICER, SLICER_KEYS, type SlicerState } from "@/lib/types";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/**
 * Satu halaman data level rekening untuk Tabel Data Detail, mengikuti
 * slicer yang sedang aktif di dashboard.
 *
 * Catatan: endpoint ini mengembalikan field level rekening (CIF, nomor
 * rekening, nama nasabah). Aksesnya mengikuti kebijakan RLS pada
 * `kredit_records` — perketat kebijakan tersebut sebelum dipakai produksi.
 */
export async function GET(request: Request) {
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
    page: Number.isFinite(page) ? page : 0,
    pageSize: Number.isFinite(pageSize)
      ? Math.min(pageSize, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE,
  });

  return NextResponse.json(result);
}
