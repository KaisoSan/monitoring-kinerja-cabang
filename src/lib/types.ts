/**
 * Model data inti dashboard monitoring kinerja kredit.
 *
 * Satu baris `KreditRecord` = satu fasilitas / aplikasi kredit,
 * mulai dari tahap prospek sampai sudah booking (outstanding).
 */

export const PIPELINE_STAGES = ["prospek", "analisa", "booking"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/** Status di luar funnel utama (tidak dihitung sebagai konversi). */
export const PIPELINE_DROPPED = ["ditolak", "batal"] as const;
export type PipelineDropped = (typeof PIPELINE_DROPPED)[number];

export type StatusPipeline = PipelineStage | PipelineDropped;

export type KreditRecord = {
  /** Kunci natural untuk upsert dari Excel. */
  kode_fasilitas: string;
  /** Tanggal awal bulan periode laporan, format ISO `YYYY-MM-DD`. */
  periode: string;
  area_head: string;
  cabang: string;
  produk: string;
  pengelola: string;
  nama_debitur: string;
  status_pipeline: StatusPipeline;
  /** Plafon usulan / disetujui. */
  plafon: number;
  /** Outstanding berjalan. Bernilai 0 untuk yang belum booking. */
  baki_debet: number;
  /** Outstanding awal periode, dipakai untuk menghitung growth. */
  baki_debet_awal: number;
  /** Kolektibilitas 1-5. */
  kolektibilitas: number;
  /** Days past due (hari tunggakan). */
  dpd: number;
  /** Penanda kredit hasil restrukturisasi (komponen LAR). */
  is_restruktur: boolean;
  tanggal_booking: string | null;
  /**
   * Snapshot seluruh kolom file sumber, dikunci dengan `toSnakeCase` dari
   * nama kolom aslinya (tanpa pemetaan alias, sehingga setiap kolom sumber
   * punya kunci sendiri). Dipakai Tabel Data Detail agar kolom apa pun bisa
   * ditampilkan tanpa perlu menambah kolom baru di database.
   */
  raw?: Record<string, unknown>;
};

export type TargetCabang = {
  periode: string;
  area_head: string;
  cabang: string;
  produk: string;
  target_baki_debet: number;
  target_booking_nominal: number;
};

/** Dimensi yang bisa dipakai sebagai slicer global. */
export const SLICER_KEYS = ["area_head", "cabang", "produk", "pengelola"] as const;
export type SlicerKey = (typeof SLICER_KEYS)[number];

/** Nilai `null` = "Semua" (tidak memfilter dimensi tersebut). */
export type SlicerState = Record<SlicerKey, string | null>;

export const EMPTY_SLICER: SlicerState = {
  area_head: null,
  cabang: null,
  produk: null,
  pengelola: null,
};

export const SLICER_LABELS: Record<SlicerKey, string> = {
  area_head: "Area Head",
  cabang: "Cabang / KCP",
  produk: "Produk Kredit",
  pengelola: "Pengelola (RM)",
};

/** Dataset yang bisa diunggah lewat halaman admin. */
export const UPLOAD_DATASETS = ["kredit_records", "target_cabang"] as const;
export type UploadDataset = (typeof UPLOAD_DATASETS)[number];

export const UPLOAD_DATASET_LABELS: Record<UploadDataset, string> = {
  kredit_records: "Data Kredit (per debitur / fasilitas)",
  target_cabang: "Target Cabang (per produk)",
};

/** Kolom kunci `on conflict` untuk masing-masing dataset. */
export const UPLOAD_CONFLICT_KEYS: Record<UploadDataset, string> = {
  kredit_records: "kode_fasilitas",
  target_cabang: "periode,cabang,produk",
};
