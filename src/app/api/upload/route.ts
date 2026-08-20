import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { isAdminEmail, isSupabaseConfigured } from "@/lib/supabase/config";
import { sanitizeDeep, sanitizeText, type SanitizeStats } from "@/lib/sanitize";
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
  const sanitize =
    dataset === "kredit_records" ? sanitizeKreditRecord : sanitizeTargetCabang;

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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function text(value: unknown, fallback: string, maxLength = 200): string {
  if (typeof value !== "string") return fallback;
  const trimmed = sanitizeText(value).trim().slice(0, maxLength);
  return trimmed || fallback;
}

function numeric(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isoDate(value: unknown): string | null {
  return typeof value === "string" && ISO_DATE.test(value) ? value : null;
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
