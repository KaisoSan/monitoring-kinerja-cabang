import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { isAdminEmail, isSupabaseConfigured } from "@/lib/supabase/config";
import { sanitizeDeep, sanitizeText, type SanitizeStats } from "@/lib/sanitize";
import { isValidIsoDate } from "@/lib/dates";
import {
  PIPELINE_DROPPED,
  PIPELINE_STAGES,
  UPLOAD_CONFLICT_KEYS,
  UPLOAD_DATASETS,
  type UploadDataset,
} from "@/lib/types";

/** Baris dikirim per batch agar request ke PostgREST tidak timeout. */
const BATCH_SIZE = 500;
const MAX_ROWS = 50_000;
/** Batas snapshot kolom asli per baris, menjaga ukuran baris tetap wajar. */
const MAX_RAW_KEYS = 200;
const MAX_RAW_VALUE_LENGTH = 500;

const VALID_STATUS = new Set<string>([...PIPELINE_STAGES, ...PIPELINE_DROPPED]);

type Json = Record<string, unknown>;

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Supabase belum dikonfigurasi pada server." },
      { status: 503 },
    );
  }

  // --- 1. Autentikasi & otorisasi -------------------------------------
  const supabase = await createServerSupabase();
  const { data: userData } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  const user = userData?.user ?? null;

  if (!user) {
    return NextResponse.json({ error: "Sesi tidak ditemukan. Silakan login ulang." }, { status: 401 });
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json(
      { error: "Akun ini tidak memiliki akses admin." },
      { status: 403 },
    );
  }

  // --- 2. Validasi payload --------------------------------------------
  let body: Json;
  try {
    body = (await request.json()) as Json;
  } catch {
    return NextResponse.json({ error: "Body request bukan JSON yang valid." }, { status: 400 });
  }

  const dataset = body.dataset;
  if (typeof dataset !== "string" || !UPLOAD_DATASETS.includes(dataset as UploadDataset)) {
    return NextResponse.json({ error: "Dataset tujuan tidak dikenal." }, { status: 400 });
  }

  const rawRows = body.rows;
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return NextResponse.json({ error: "Tidak ada baris yang dikirim." }, { status: 400 });
  }
  if (rawRows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `Maksimal ${MAX_ROWS.toLocaleString("id-ID")} baris per unggahan.` },
      { status: 413 },
    );
  }

  // Payload dari klien tidak dipercaya: hanya kolom yang dikenal yang lolos.
  const SANITIZERS: Record<UploadDataset, (row: Json) => Json | null> = {
    kredit_records: sanitizeKreditRecord,
    target_cabang: sanitizeTargetCabang,
    dpk_looser: sanitizeDpkLooser,
    akun_records: sanitizeAkunRecord,
  };
  const sanitize = SANITIZERS[dataset as UploadDataset];

  // Lapis terakhir sebelum menyentuh database: apa pun yang lolos dari
  // pemetaan di atas tetap disapu ulang secara rekursif, sehingga tidak ada
  // NUL atau surrogate yatim yang sampai ke PostgreSQL.
  const stats: SanitizeStats = { removed: 0 };
  const rows: Json[] = [];
  for (const row of rawRows) {
    if (!row || typeof row !== "object") continue;
    const clean = sanitize(row as Json);
    if (clean) rows.push(sanitizeDeep(clean, stats));
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Semua baris ditolak saat validasi server." },
      { status: 422 },
    );
  }

  // --- 3. Upsert batch dengan service role ----------------------------
  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY belum diatur di server." },
      { status: 503 },
    );
  }

  let processed = 0;
  const totalBatches = Math.ceil(rows.length / BATCH_SIZE);

  for (let index = 0; index < totalBatches; index += 1) {
    const batch = rows.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE);
    const { error } = await admin
      .from(dataset)
      .upsert(batch, { onConflict: UPLOAD_CONFLICT_KEYS[dataset as UploadDataset] });

    if (error) {
      return NextResponse.json(
        {
          error: `Gagal menyimpan batch ${index + 1} dari ${totalBatches}: ${error.message}`,
          processed,
        },
        { status: 500 },
      );
    }
    processed += batch.length;
  }

  // --- 4. Catat jejak unggahan (tidak fatal bila gagal) ---------------
  const fileName = typeof body.fileName === "string" ? body.fileName.slice(0, 255) : "tanpa-nama";
  await admin.from("upload_logs").insert({
    dataset,
    file_name: fileName,
    row_count: processed,
    uploaded_by: user.email ?? null,
  });

  return NextResponse.json({
    processed,
    batches: totalBatches,
    skipped: rawRows.length - rows.length,
    /** Jumlah karakter tidak valid yang dibuang sebelum penyimpanan. */
    sanitized: stats.removed,
  });
}

/* ------------------------------------------------------------------ */
/* Sanitasi baris                                                      */
/* ------------------------------------------------------------------ */

function text(value: unknown, fallback: string, maxLength = 200): string {
  if (typeof value !== "string") return fallback;
  const trimmed = sanitizeText(value).trim().slice(0, maxLength);
  return trimmed || fallback;
}

function numeric(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Memeriksa bentuk SEKALIGUS keabsahan kalender. Memeriksa bentuk saja tidak
 * cukup: `2026-18-01` lolos pola `\d{4}-\d{2}-\d{2}` tetapi ditolak
 * PostgreSQL dan menggagalkan seluruh batch.
 */
function isoDate(value: unknown): string | null {
  return isValidIsoDate(value) ? value : null;
}

function sanitizeKreditRecord(row: Json): Json | null {
  const kode = text(row.kode_fasilitas, "", 120);
  const cabang = text(row.cabang, "");
  if (!kode || !cabang) return null;

  const periode = isoDate(row.periode);
  if (!periode) return null;

  const status = text(row.status_pipeline, "prospek", 20).toLowerCase();
  const kol = Math.min(5, Math.max(1, Math.round(numeric(row.kolektibilitas)) || 1));

  return {
    kode_fasilitas: kode,
    periode,
    area_head: text(row.area_head, "Tanpa Area Head"),
    cabang,
    produk: text(row.produk, "Lainnya", 60),
    pengelola: text(row.pengelola, "Tanpa Pengelola"),
    nama_debitur: text(row.nama_debitur, "-"),
    status_pipeline: VALID_STATUS.has(status) ? status : "prospek",
    plafon: Math.max(0, numeric(row.plafon)),
    baki_debet: Math.max(0, numeric(row.baki_debet)),
    baki_debet_awal: Math.max(0, numeric(row.baki_debet_awal)),
    kolektibilitas: kol,
    dpd: Math.max(0, Math.round(numeric(row.dpd))),
    is_restruktur: Boolean(row.is_restruktur),
    tanggal_booking: isoDate(row.tanggal_booking),
    raw: sanitizeRaw(row.raw),
  };
}

/**
 * Snapshot kolom asli dibatasi jumlah kunci dan panjang nilainya, dan hanya
 * menerima tipe primitif — payload dari browser tidak dipercaya apa adanya.
 */
function sanitizeRaw(value: unknown): Json {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const result: Json = {};
  let count = 0;
  for (const [rawKey, cell] of Object.entries(value as Json)) {
    if (count >= MAX_RAW_KEYS) break;
    if (cell === null || cell === undefined || cell === "") continue;

    const key = sanitizeText(rawKey);
    // `__proto__` pada objek biasa mengubah prototipe, bukan menambah properti.
    if (!key || key === "__proto__") continue;

    if (typeof cell === "number" && Number.isFinite(cell)) result[key] = cell;
    else if (typeof cell === "boolean") result[key] = cell;
    else if (typeof cell === "string") {
      const clean = sanitizeText(cell).slice(0, MAX_RAW_VALUE_LENGTH);
      if (!clean) continue;
      result[key] = clean;
    }
    else continue;

    count += 1;
  }
  return result;
}

function sanitizeDpkLooser(row: Json): Json | null {
  const cif = text(row.cif, "", 60);
  const outlet = text(row.outlet, "", 120);
  const periode = isoDate(row.periode);
  if (!cif || !outlet || !periode) return null;

  const saldoAwal = numeric(row.saldo_awal);
  const saldoAkhir = numeric(row.saldo_akhir);

  return {
    periode,
    tanggal_awal: isoDate(row.tanggal_awal),
    tanggal_akhir: isoDate(row.tanggal_akhir),
    sc: text(row.sc, "", 20),
    cabang: text(row.cabang, "Tanpa Cabang", 120),
    outlet,
    jenis_produk: text(row.jenis_produk, "", 60),
    ranking: Math.max(0, Math.round(numeric(row.ranking))),
    cif,
    nama: text(row.nama, "-"),
    segmen: text(row.segmen, "", 40),
    saldo_awal: saldoAwal,
    saldo_akhir: saldoAkhir,
    // Dihitung ulang di server agar tetap konsisten walau klien mengirim
    // selisih yang berbeda.
    delta_saldo: saldoAkhir - saldoAwal,
    raw: sanitizeRaw(row.raw),
  };
}

const AKUN_SUMBER_VALID = new Set(["old", "new"]);

function sanitizeAkunRecord(row: Json): Json | null {
  const periode = isoDate(row.periode);
  const sumber = text(row.sumber, "", 10).toLowerCase();
  const kodeAkun = text(row.kode_akun, "", 160);
  if (!periode || !kodeAkun || !AKUN_SUMBER_VALID.has(sumber)) return null;

  const golongan = Math.round(numeric(row.golongan));
  const sukuBunga = row.suku_bunga === null || row.suku_bunga === undefined
    ? null
    : numeric(row.suku_bunga);

  return {
    periode,
    sumber,
    kode_akun: kodeAkun,
    cif: text(row.cif, "", 60),
    nama_debitur: text(row.nama_debitur, "-"),
    no_pk: text(row.no_pk, "", 120),
    area: text(row.area, "", 120),
    branch_code: text(row.branch_code, "", 40),
    branch_name: text(row.branch_name, "Tanpa Cabang", 120),
    kode_outlet: text(row.kode_outlet, "", 40),
    nama_outlet: text(row.nama_outlet, "", 120),
    nama_akk: text(row.nama_akk, "", 160),
    produk: text(row.produk, "", 120),
    tipe: text(row.tipe, "", 40),
    program: text(row.program, "", 80),
    segmen_ews: text(row.segmen_ews, "", 80),
    segmen_kelola: text(row.segmen_kelola, "", 80),
    sektor_ekonomi: text(row.sektor_ekonomi, "", 120),
    ket_status: text(row.ket_status, "", 80),
    plafon: Math.max(0, numeric(row.plafon)),
    baki_debet: Math.max(0, numeric(row.baki_debet)),
    outstanding: Math.max(0, numeric(row.outstanding)),
    saldo_akhir: numeric(row.saldo_akhir),
    total_tunggakan: Math.max(0, numeric(row.total_tunggakan)),
    total_kewajiban: Math.max(0, numeric(row.total_kewajiban)),
    dpd_kategori: text(row.dpd_kategori, "", 60),
    dpd_hari: Math.max(0, Math.round(numeric(row.dpd_hari))),
    golongan: golongan >= 1 && golongan <= 5 ? golongan : 1,
    suku_bunga: sukuBunga !== null && Number.isFinite(sukuBunga) ? sukuBunga : null,
    tanggal_buka: isoDate(row.tanggal_buka),
    tanggal_jatuh_tempo: isoDate(row.tanggal_jatuh_tempo),
  };
}

function sanitizeTargetCabang(row: Json): Json | null {
  const cabang = text(row.cabang, "");
  const periode = isoDate(row.periode);
  if (!cabang || !periode) return null;

  return {
    periode,
    area_head: text(row.area_head, "Tanpa Area Head"),
    cabang,
    produk: text(row.produk, "SEMUA", 60),
    target_baki_debet: Math.max(0, numeric(row.target_baki_debet)),
    target_booking_nominal: Math.max(0, numeric(row.target_booking_nominal)),
  };
}
