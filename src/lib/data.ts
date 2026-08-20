import "server-only";

import { buildSampleRaw, buildSampleRecords, buildSampleTargets } from "./sample-data";
import { filterRecords } from "./metrics";
import { EMPTY_SLICER, type SlicerState } from "./types";
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

/**
 * Kolom bertipe yang dibutuhkan agregasi. Snapshot `raw` sengaja TIDAK ikut
 * dimuat di sini: dashboard mengirim seluruh baris ke browser, dan membawa
 * 86 kolom per baris akan membengkakkan payload. Tabel Data Detail mengambil
 * `raw` sendiri per halaman lewat `loadDetailRecords`.
 */
const TYPED_COLUMNS =
  "kode_fasilitas, periode, area_head, cabang, produk, pengelola, nama_debitur, " +
  "status_pipeline, plafon, baki_debet, baki_debet_awal, kolektibilitas, dpd, " +
  "is_restruktur, tanggal_booking";

/**
 * Dataset contoh dibangkitkan sekali lalu dipakai ulang: generatornya
 * deterministik, jadi memoisasi menjaga nomor urut baris tetap konsisten
 * antara dashboard dan Tabel Data Detail.
 */
let sampleCache: { records: KreditRecord[]; targets: TargetCabang[] } | null = null;

function sampleDataset() {
  if (!sampleCache) {
    const records = buildSampleRecords();
    sampleCache = { records, targets: buildSampleTargets(records) };
  }
  return sampleCache;
}

function sampleData(notice: string | null): DashboardData {
  const { records, targets } = sampleDataset();
  return {
    records,
    targets,
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
      .select(TYPED_COLUMNS)
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

/* ------------------------------------------------------------------ */
/* Tabel Data Detail                                                   */
/* ------------------------------------------------------------------ */

export type DetailQuery = {
  slicer: SlicerState;
  page: number;
  pageSize: number;
};

export type DetailPage = {
  rows: KreditRecord[];
  total: number;
  source: DashboardSource;
  periode: string | null;
};

/**
 * Mengambil satu halaman data level rekening lengkap dengan snapshot kolom
 * asli. Dipisah dari `loadDashboardData` supaya payload dashboard tetap
 * ringan sementara tabel detail tetap bisa menampilkan 86 kolom.
 */
export async function loadDetailRecords({
  slicer,
  page,
  pageSize,
}: DetailQuery): Promise<DetailPage> {
  const safePage = Math.max(0, Math.floor(page));
  const safeSize = Math.min(200, Math.max(1, Math.floor(pageSize)));
  const from = safePage * safeSize;

  const supabase = isSupabaseConfigured ? await createServerSupabase() : null;

  if (supabase) {
    const latest = await supabase
      .from("kredit_records")
      .select("periode")
      .order("periode", { ascending: false })
      .limit(1)
      .maybeSingle();

    const periode = latest.error ? null : (latest.data?.periode ?? null);

    if (periode) {
      let query = supabase
        .from("kredit_records")
        .select(`${TYPED_COLUMNS}, raw`, { count: "exact" })
        .eq("periode", periode);

      for (const key of ["area_head", "cabang", "produk", "pengelola"] as const) {
        const value = slicer[key];
        if (value) query = query.eq(key, value);
      }

      const { data, error, count } = await query
        .order("kode_fasilitas", { ascending: true })
        .range(from, from + safeSize - 1);

      if (!error) {
        const rows = (data ?? []) as unknown as RawRecord[];
        return {
          rows: rows.map((row) => ({
            ...normalizeRecord(row),
            raw:
              row.raw && typeof row.raw === "object"
                ? (row.raw as Record<string, unknown>)
                : {},
          })),
          total: count ?? rows.length,
          source: "supabase",
          periode,
        };
      }
    }
  }

  // Mode data contoh: filter dan potong di memori, lalu lampirkan snapshot.
  const { records } = sampleDataset();
  const filtered = filterRecords(records, { ...EMPTY_SLICER, ...slicer });
  // Nomor urut ("No") mengikuti posisi baris pada dataset penuh, bukan
  // posisi setelah difilter, agar identitas barisnya tetap sama.
  const positions = new Map(records.map((record, index) => [record.kode_fasilitas, index]));

  return {
    rows: filtered.slice(from, from + safeSize).map((record) => ({
      ...record,
      raw: buildSampleRaw(record, positions.get(record.kode_fasilitas) ?? 0),
    })),
    total: filtered.length,
    source: "sample",
    periode: records[0]?.periode ?? null,
  };
}
