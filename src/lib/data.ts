import "server-only";

import { buildSampleRecords, buildSampleTargets } from "./sample-data";
import { createServerSupabase } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/config";
import type { KreditRecord, TargetCabang } from "./types";

export type DashboardSource = "supabase" | "sample";

export type DashboardData = {
  records: KreditRecord[];
  targets: TargetCabang[];
  source: DashboardSource;
  /** Periode terakhir yang tersedia, format `YYYY-MM-DD`. */
  periode: string | null;
  /** Alasan fallback ke data contoh, ditampilkan sebagai banner. */
  notice: string | null;
};

const PAGE_SIZE = 1000;
const MAX_PAGES = 25; // batas aman: 25.000 baris per periode

function sampleData(notice: string | null): DashboardData {
  const records = buildSampleRecords();
  return {
    records,
    targets: buildSampleTargets(records),
    source: "sample",
    periode: records[0]?.periode ?? null,
    notice,
  };
}

/**
 * Mengambil data periode terakhir dari Supabase. Bila Supabase belum
 * dikonfigurasi, tabel belum dibuat, atau masih kosong, dashboard memakai
 * dataset contoh agar tetap bisa dibuka.
 */
export async function loadDashboardData(): Promise<DashboardData> {
  if (!isSupabaseConfigured) {
    return sampleData(
      "Supabase belum dikonfigurasi. Dashboard sedang menampilkan data contoh.",
    );
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    return sampleData("Klien Supabase gagal dibuat. Menampilkan data contoh.");
  }

  const latest = await supabase
    .from("kredit_records")
    .select("periode")
    .order("periode", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest.error) {
    return sampleData(
      `Gagal membaca tabel kredit_records (${latest.error.message}). ` +
        "Pastikan supabase/schema.sql sudah dijalankan. Menampilkan data contoh.",
    );
  }

  const periode = latest.data?.periode ?? null;
  if (!periode) {
    return sampleData(
      "Tabel kredit_records masih kosong. Unggah data lewat /admin. " +
        "Sementara ini dashboard menampilkan data contoh.",
    );
  }

  const records: KreditRecord[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from("kredit_records")
      .select(
        "kode_fasilitas, periode, area_head, cabang, produk, pengelola, nama_debitur, " +
          "status_pipeline, plafon, baki_debet, baki_debet_awal, kolektibilitas, dpd, " +
          "is_restruktur, tanggal_booking",
      )
      .eq("periode", periode)
      .order("kode_fasilitas", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      return sampleData(
        `Gagal memuat data kredit (${error.message}). Menampilkan data contoh.`,
      );
    }
    if (!data || data.length === 0) break;

    records.push(...(data as unknown as RawRecord[]).map(normalizeRecord));
    if (data.length < PAGE_SIZE) break;
  }

  const targetQuery = await supabase
    .from("target_cabang")
    .select("periode, area_head, cabang, produk, target_baki_debet, target_booking_nominal")
    .eq("periode", periode);

  // Target opsional: dashboard tetap tampil walau target belum diunggah.
  // Cast: tanpa tipe hasil generate Supabase, inferensi select string tidak
  // menghasilkan bentuk baris yang berguna.
  const targetRows = (targetQuery.data ?? []) as unknown as RawRecord[];
  const targets = targetRows.map(normalizeTarget);

  return { records, targets, source: "supabase", periode, notice: null };
}

/* Supabase mengembalikan kolom numeric sebagai string; normalkan ke number. */

type RawRecord = Record<string, unknown>;

function num(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function normalizeRecord(row: RawRecord): KreditRecord {
  return {
    kode_fasilitas: str(row.kode_fasilitas),
    periode: str(row.periode),
    area_head: str(row.area_head, "Tanpa Area Head"),
    cabang: str(row.cabang, "Tanpa Cabang"),
    produk: str(row.produk, "Lainnya"),
    pengelola: str(row.pengelola, "Tanpa Pengelola"),
    nama_debitur: str(row.nama_debitur, "-"),
    status_pipeline: str(row.status_pipeline, "prospek") as KreditRecord["status_pipeline"],
    plafon: num(row.plafon),
    baki_debet: num(row.baki_debet),
    baki_debet_awal: num(row.baki_debet_awal),
    kolektibilitas: num(row.kolektibilitas) || 1,
    dpd: num(row.dpd),
    is_restruktur: Boolean(row.is_restruktur),
    tanggal_booking: typeof row.tanggal_booking === "string" ? row.tanggal_booking : null,
  };
}

function normalizeTarget(row: RawRecord): TargetCabang {
  return {
    periode: str(row.periode),
    area_head: str(row.area_head, "Tanpa Area Head"),
    cabang: str(row.cabang, "Tanpa Cabang"),
    produk: str(row.produk, "Lainnya"),
    target_baki_debet: num(row.target_baki_debet),
    target_booking_nominal: num(row.target_booking_nominal),
  };
}
