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

/**
 * Top 30 Looser DPK — satu baris per nasabah, per outlet, per periode.
 * Berkas sumbernya memecah data per sheet (satu sheet = satu outlet).
 */
export type DpkLooser = {
  periode: string;
  tanggal_awal: string | null;
  tanggal_akhir: string | null;
  sc: string;
  cabang: string;
  outlet: string;
  jenis_produk: string;
  ranking: number;
  cif: string;
  nama: string;
  segmen: string;
  saldo_awal: number;
  saldo_akhir: number;
  /** `saldo_akhir - saldo_awal`; negatif berarti dana keluar. */
  delta_saldo: number;
  raw?: Record<string, unknown>;
};

/** Sheet asal pada berkas data mentah akun. */
export const AKUN_SUMBER = ["old", "new"] as const;
export type AkunSumber = (typeof AKUN_SUMBER)[number];

/**
 * Data mentah akun dari sheet OLD_ACCOUNT / NEW_ACCOUNT.
 *
 * Hanya kolom yang dipakai analisis yang dipetakan. Kolom PII pada berkas
 * sumber (NIK, nomor telepon, alamat) sengaja tidak ikut disimpan.
 */
export type AkunRecord = {
  periode: string;
  sumber: AkunSumber;
  /** Kunci turunan yang stabil untuk upsert. */
  kode_akun: string;
  cif: string;
  nama_debitur: string;
  no_pk: string;
  area: string;
  branch_code: string;
  branch_name: string;
  kode_outlet: string;
  nama_outlet: string;
  nama_akk: string;
  produk: string;
  tipe: string;
  program: string;
  segmen_ews: string;
  segmen_kelola: string;
  sektor_ekonomi: string;
  ket_status: string;
  plafon: number;
  baki_debet: number;
  outstanding: number;
  saldo_akhir: number;
  total_tunggakan: number;
  total_kewajiban: number;
  /** Kategori apa adanya dari berkas, mis. `1. current`, `8. 181+ dpd`. */
  dpd_kategori: string;
  dpd_hari: number;
  golongan: number;
  suku_bunga: number | null;
  tanggal_buka: string | null;
  tanggal_jatuh_tempo: string | null;
};

/** Dataset yang bisa diunggah lewat halaman admin. */
export const UPLOAD_DATASETS = [
  "kredit_records",
  "target_cabang",
  "dpk_looser",
  "akun_records",
] as const;
export type UploadDataset = (typeof UPLOAD_DATASETS)[number];

export const UPLOAD_DATASET_LABELS: Record<UploadDataset, string> = {
  kredit_records: "SL - Data Kredit (per debitur / fasilitas)",
  target_cabang: "Target Cabang (per produk)",
  dpk_looser: "DPK - Top 30 Looser (satu sheet per outlet)",
  akun_records: "Data Akun (sheet OLD_ACCOUNT / NEW_ACCOUNT)",
};

/** Keterangan singkat yang ditampilkan di halaman unggah. */
export const UPLOAD_DATASET_HINTS: Record<UploadDataset, string> = {
  kredit_records: "Berkas SL 18 dengan 86 kolom; judul kolom terdeteksi otomatis.",
  target_cabang: "Target per periode, cabang, dan produk.",
  dpk_looser:
    "Judul kolom di baris ke-4. Seluruh sheet dibaca (satu sheet = satu outlet), " +
    "dan tanggal saldo diambil dari judul kolom \"Saldo <tanggal>\".",
  akun_records:
    "Sheet OLD_ACCOUNT dan NEW_ACCOUNT dibaca sekaligus. Kolom PII (NIK, telepon, " +
    "alamat) tidak ikut disimpan. Isi Periode sesuai posisi data (as of).",
};

/** Kolom kunci `on conflict` untuk masing-masing dataset. */
export const UPLOAD_CONFLICT_KEYS: Record<UploadDataset, string> = {
  // Gabungan, bukan kode_fasilitas saja: satu fasilitas muncul kembali tiap
  // periode, dan kunci tunggal membuat unggahan bulan baru menimpa bulan
  // sebelumnya. Harus sejalan dengan constraint kredit_records_periode_unik.
  kredit_records: "kode_fasilitas,periode",
  target_cabang: "periode,cabang,produk",
  dpk_looser: "periode,outlet,cif",
  akun_records: "periode,sumber,kode_akun",
};
