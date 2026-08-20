import "server-only";

import { createServerSupabase } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/config";
import { pilihPeriode } from "./dates";
import type { KreditRecord, SlicerState, TargetCabang } from "./types";

/**
 * Dashboard HANYA menampilkan data dari Supabase.
 *
 * Sebelumnya ada dataset contoh yang otomatis dipakai ketika pembacaan gagal.
 * Perilaku itu dicabut: pada dashboard kredit, angka contoh yang tampil
 * seolah-olah data asli jauh lebih berbahaya daripada halaman kosong. Kini
 * setiap kegagalan dilaporkan apa adanya lewat `state` dan `message`.
 */
export type DashboardState =
  /** Data berhasil dimuat (boleh saja kosong bila tabel memang kosong). */
  | "ok"
  /** Environment Supabase belum diisi. */
  | "belum-dikonfigurasi"
  /** Tidak ada sesi login, sehingga RLS menutup seluruh baris. */
  | "tanpa-sesi"
  /** Kueri ke Supabase gagal. */
  | "galat";

export type DashboardData = {
  records: KreditRecord[];
  targets: TargetCabang[];
  /** Periode yang sedang ditampilkan, format `YYYY-MM-DD`. */
  periode: string | null;
  /** Seluruh periode yang ada di database, terbaru lebih dulu. */
  periodeTersedia: string[];
  state: DashboardState;
  /** Penjelasan yang ditampilkan ke pengguna saat `state` bukan `ok`. */
  message: string | null;
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

const NOT_CONFIGURED =
  "Environment Supabase belum diisi. Salin .env.example menjadi .env.local, " +
  "isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY, lalu " +
  "jalankan ulang aplikasi.";

const NO_SESSION =
  "Sesi tidak ditemukan atau sudah berakhir. Kebijakan RLS hanya mengizinkan " +
  "pembacaan untuk pengguna yang sudah login, jadi silakan masuk kembali.";

function emptyResult(state: DashboardState, message: string | null): DashboardData {
  return { records: [], targets: [], periode: null, periodeTersedia: [], state, message };
}

/**
 * Daftar periode yang tersedia, terbaru lebih dulu.
 *
 * Dibaca dari view `kredit_periode` supaya PostgreSQL yang mengelompokkan;
 * menarik seluruh baris hanya untuk menyusun daftar bulan jelas berlebihan.
 */
async function bacaPeriodeTersedia(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabase>>>,
): Promise<{ list: string[]; error: string | null }> {
  const { data, error } = await supabase
    .from("kredit_periode")
    .select("periode")
    .order("periode", { ascending: false });

  if (error) return { list: [], error: error.message };

  const rows = (data ?? []) as unknown as RawRecord[];
  return { list: rows.map((row) => str(row.periode)).filter(Boolean), error: null };
}

/**
 * Memuat data periode terakhir dari Supabase. Tidak pernah mengarang data:
 * bila gagal, `records` kosong dan alasannya dibawa di `message`.
 */
export async function loadDashboardData(periodeDiminta?: string): Promise<DashboardData> {
  if (!isSupabaseConfigured) return emptyResult("belum-dikonfigurasi", NOT_CONFIGURED);

  const supabase = await createServerSupabase();
  if (!supabase) return emptyResult("belum-dikonfigurasi", NOT_CONFIGURED);

  const { data: session } = await supabase.auth.getUser();
  if (!session?.user) return emptyResult("tanpa-sesi", NO_SESSION);

  const tersedia = await bacaPeriodeTersedia(supabase);
  if (tersedia.error) {
    return emptyResult(
      "galat",
      `Gagal membaca daftar periode: ${tersedia.error}. ` +
        "Pastikan supabase/schema.sql sudah dijalankan pada project ini.",
    );
  }

  const periode = pilihPeriode(periodeDiminta, tersedia.list);

  // Tabel kosong bukan kegagalan; dashboard menampilkan keadaan kosong apa adanya.
  if (!periode) {
    return {
      records: [],
      targets: [],
      periode: null,
      periodeTersedia: tersedia.list,
      state: "ok",
      message: null,
    };
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
      return emptyResult("galat", `Gagal memuat data kredit: ${error.message}`);
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

  return {
    records,
    targets: targetRows.map(normalizeTarget),
    periode,
    periodeTersedia: tersedia.list,
    state: "ok",
    message: null,
  };
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
  /** Periode yang sedang dipilih di header; kosong berarti periode terbaru. */
  periode?: string;
};

export type DetailPage = {
  rows: KreditRecord[];
  total: number;
  periode: string | null;
  state: DashboardState;
  message: string | null;
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
  periode: periodeDiminta,
}: DetailQuery): Promise<DetailPage> {
  const empty = (state: DashboardState, message: string | null): DetailPage => ({
    rows: [],
    total: 0,
    periode: null,
    state,
    message,
  });

  if (!isSupabaseConfigured) return empty("belum-dikonfigurasi", NOT_CONFIGURED);

  const supabase = await createServerSupabase();
  if (!supabase) return empty("belum-dikonfigurasi", NOT_CONFIGURED);

  const { data: session } = await supabase.auth.getUser();
  if (!session?.user) return empty("tanpa-sesi", NO_SESSION);

  const safePage = Math.max(0, Math.floor(page));
  const safeSize = Math.min(200, Math.max(1, Math.floor(pageSize)));
  const from = safePage * safeSize;

  // Tabel detail harus menampilkan periode yang sama dengan pilar di atasnya,
  // jadi periodenya ikut dikirim dari header, bukan selalu yang terbaru.
  const tersedia = await bacaPeriodeTersedia(supabase);
  if (tersedia.error) {
    return empty("galat", `Gagal membaca daftar periode: ${tersedia.error}`);
  }

  const periode = pilihPeriode(periodeDiminta, tersedia.list);

  if (!periode) return { rows: [], total: 0, periode: null, state: "ok", message: null };

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

  if (error) {
    return empty("galat", `Gagal memuat data detail: ${error.message}`);
  }

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
    periode,
    state: "ok",
    message: null,
  };
}

/* ------------------------------------------------------------------ */
/* Dataset DPK (Top 30 Looser)                                         */
/* ------------------------------------------------------------------ */

export type DpkRow = {
  cabang: string;
  outlet: string;
  segmen: string;
  ranking: number;
  cif: string;
  nama: string;
  saldo_awal: number;
  saldo_akhir: number;
  delta_saldo: number;
};

export type DpkData = {
  rows: DpkRow[];
  periode: string | null;
  tanggalAwal: string | null;
  tanggalAkhir: string | null;
  state: DashboardState;
  message: string | null;
};

const DPK_MAX_ROWS = 5000;

export async function loadDpkData(): Promise<DpkData> {
  const empty = (state: DashboardState, message: string | null): DpkData => ({
    rows: [],
    periode: null,
    tanggalAwal: null,
    tanggalAkhir: null,
    state,
    message,
  });

  if (!isSupabaseConfigured) return empty("belum-dikonfigurasi", NOT_CONFIGURED);
  const supabase = await createServerSupabase();
  if (!supabase) return empty("belum-dikonfigurasi", NOT_CONFIGURED);

  const { data: session } = await supabase.auth.getUser();
  if (!session?.user) return empty("tanpa-sesi", NO_SESSION);

  const latest = await supabase
    .from("dpk_looser")
    .select("periode")
    .order("periode", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest.error) {
    return empty(
      "galat",
      `Gagal membaca tabel dpk_looser: ${latest.error.message}. ` +
        "Pastikan bagian 2 pada supabase/schema.sql sudah dijalankan.",
    );
  }

  const periode = latest.data?.periode ?? null;
  if (!periode) return { ...empty("ok", null), periode: null };

  const { data, error } = await supabase
    .from("dpk_looser")
    .select(
      "cabang, outlet, segmen, ranking, cif, nama, saldo_awal, saldo_akhir, " +
        "delta_saldo, tanggal_awal, tanggal_akhir",
    )
    .eq("periode", periode)
    .order("delta_saldo", { ascending: true })
    .limit(DPK_MAX_ROWS);

  if (error) return empty("galat", `Gagal memuat data DPK: ${error.message}`);

  const rows = (data ?? []) as unknown as RawRecord[];
  return {
    rows: rows.map((row) => ({
      cabang: str(row.cabang, "Tanpa Cabang"),
      outlet: str(row.outlet, "Tanpa Outlet"),
      segmen: str(row.segmen, "-"),
      ranking: num(row.ranking),
      cif: str(row.cif),
      nama: str(row.nama, "-"),
      saldo_awal: num(row.saldo_awal),
      saldo_akhir: num(row.saldo_akhir),
      delta_saldo: num(row.delta_saldo),
    })),
    periode,
    tanggalAwal: typeof rows[0]?.tanggal_awal === "string" ? rows[0].tanggal_awal : null,
    tanggalAkhir: typeof rows[0]?.tanggal_akhir === "string" ? rows[0].tanggal_akhir : null,
    state: "ok",
    message: null,
  };
}

/* ------------------------------------------------------------------ */
/* Dataset Akun (OLD_ACCOUNT / NEW_ACCOUNT)                            */
/* ------------------------------------------------------------------ */

export type AkunCabangRow = {
  sumber: string;
  area: string;
  branch_name: string;
  jumlah_rekening: number;
  total_baki_debet: number;
  total_tunggakan: number;
  jumlah_npl: number;
  baki_debet_npl: number;
  jumlah_menunggak: number;
};

export type AkunDpdRow = {
  sumber: string;
  dpd_kategori: string;
  jumlah_rekening: number;
  total_baki_debet: number;
};

export type AkunData = {
  cabang: AkunCabangRow[];
  dpd: AkunDpdRow[];
  periode: string | null;
  state: DashboardState;
  message: string | null;
};

/**
 * Membaca ringkasan akun dari view agregat, bukan dari tabel barisnya.
 * Satu unggahan bisa berisi puluhan ribu rekening, jadi peringkasan
 * dikerjakan PostgreSQL dan browser hanya menerima hasilnya.
 */
export async function loadAkunData(): Promise<AkunData> {
  const empty = (state: DashboardState, message: string | null): AkunData => ({
    cabang: [],
    dpd: [],
    periode: null,
    state,
    message,
  });

  if (!isSupabaseConfigured) return empty("belum-dikonfigurasi", NOT_CONFIGURED);
  const supabase = await createServerSupabase();
  if (!supabase) return empty("belum-dikonfigurasi", NOT_CONFIGURED);

  const { data: session } = await supabase.auth.getUser();
  if (!session?.user) return empty("tanpa-sesi", NO_SESSION);

  const latest = await supabase
    .from("akun_records")
    .select("periode")
    .order("periode", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest.error) {
    return empty(
      "galat",
      `Gagal membaca tabel akun_records: ${latest.error.message}. ` +
        "Pastikan bagian 2 pada supabase/schema.sql sudah dijalankan.",
    );
  }

  const periode = latest.data?.periode ?? null;
  if (!periode) return { ...empty("ok", null), periode: null };

  const [cabangQuery, dpdQuery] = await Promise.all([
    supabase
      .from("akun_ringkasan_cabang")
      .select(
        "sumber, area, branch_name, jumlah_rekening, total_baki_debet, " +
          "total_tunggakan, jumlah_npl, baki_debet_npl, jumlah_menunggak",
      )
      .eq("periode", periode),
    supabase
      .from("akun_sebaran_dpd")
      .select("sumber, dpd_kategori, jumlah_rekening, total_baki_debet")
      .eq("periode", periode)
      .order("dpd_kategori", { ascending: true }),
  ]);

  if (cabangQuery.error || dpdQuery.error) {
    const message = cabangQuery.error?.message ?? dpdQuery.error?.message ?? "";
    return empty(
      "galat",
      `Gagal memuat ringkasan akun: ${message}. ` +
        "View agregat mungkin belum dibuat; jalankan ulang supabase/schema.sql.",
    );
  }

  const cabangRows = (cabangQuery.data ?? []) as unknown as RawRecord[];
  const dpdRows = (dpdQuery.data ?? []) as unknown as RawRecord[];

  return {
    cabang: cabangRows.map((row) => ({
      sumber: str(row.sumber, "old"),
      area: str(row.area, "-"),
      branch_name: str(row.branch_name, "Tanpa Cabang"),
      jumlah_rekening: num(row.jumlah_rekening),
      total_baki_debet: num(row.total_baki_debet),
      total_tunggakan: num(row.total_tunggakan),
      jumlah_npl: num(row.jumlah_npl),
      baki_debet_npl: num(row.baki_debet_npl),
      jumlah_menunggak: num(row.jumlah_menunggak),
    })),
    dpd: dpdRows.map((row) => ({
      sumber: str(row.sumber, "old"),
      dpd_kategori: str(row.dpd_kategori, "Tidak diketahui"),
      jumlah_rekening: num(row.jumlah_rekening),
      total_baki_debet: num(row.total_baki_debet),
    })),
    periode,
    state: "ok",
    message: null,
  };
}
