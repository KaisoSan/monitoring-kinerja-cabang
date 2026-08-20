-- =============================================================
-- Dashboard Monitoring Kinerja Kredit
-- Jalankan seluruh isi file ini di Supabase Studio > SQL Editor.
-- Skrip bersifat idempotent: aman dijalankan ulang.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Tabel fakta: satu baris = satu fasilitas / aplikasi kredit
-- -------------------------------------------------------------
create table if not exists public.kredit_records (
  id                uuid primary key default gen_random_uuid(),
  kode_fasilitas    text not null unique,
  periode           date not null,
  area_head         text not null,
  cabang            text not null,
  produk            text not null,
  pengelola         text not null,
  nama_debitur      text not null,
  status_pipeline   text not null default 'prospek'
                      check (status_pipeline in
                        ('prospek', 'analisa', 'booking', 'ditolak', 'batal')),
  plafon            numeric(20, 2) not null default 0,
  baki_debet        numeric(20, 2) not null default 0,
  baki_debet_awal   numeric(20, 2) not null default 0,
  kolektibilitas    smallint not null default 1 check (kolektibilitas between 1 and 5),
  dpd               integer not null default 0 check (dpd >= 0),
  is_restruktur     boolean not null default false,
  tanggal_booking   date,
  -- Snapshot seluruh kolom file sumber, dikunci nama kolom asli dalam
  -- snake_case. Dipakai Tabel Data Detail untuk menampilkan kolom apa pun
  -- tanpa perlu menambah kolom baru di tabel ini.
  raw               jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists kredit_records_periode_idx    on public.kredit_records (periode desc);
create index if not exists kredit_records_area_head_idx  on public.kredit_records (area_head);
create index if not exists kredit_records_cabang_idx     on public.kredit_records (cabang);
create index if not exists kredit_records_produk_idx     on public.kredit_records (produk);
create index if not exists kredit_records_pengelola_idx  on public.kredit_records (pengelola);
create index if not exists kredit_records_status_idx     on public.kredit_records (status_pipeline);

-- Untuk instalasi yang dibuat sebelum kolom `raw` ada.
alter table public.kredit_records
  add column if not exists raw jsonb not null default '{}'::jsonb;

-- -------------------------------------------------------------
-- 2. Target per cabang & produk
-- -------------------------------------------------------------
create table if not exists public.target_cabang (
  id                      uuid primary key default gen_random_uuid(),
  periode                 date not null,
  area_head               text not null,
  cabang                  text not null,
  produk                  text not null,
  target_baki_debet       numeric(20, 2) not null default 0,
  target_booking_nominal  numeric(20, 2) not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint target_cabang_unik unique (periode, cabang, produk)
);

create index if not exists target_cabang_periode_idx on public.target_cabang (periode desc);

-- -------------------------------------------------------------
-- 3. Jejak upload dari halaman admin
-- -------------------------------------------------------------
create table if not exists public.upload_logs (
  id            uuid primary key default gen_random_uuid(),
  dataset       text not null,
  file_name     text not null,
  row_count     integer not null default 0,
  uploaded_by   text,
  created_at    timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 4. Trigger updated_at
-- -------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists kredit_records_set_updated_at on public.kredit_records;
create trigger kredit_records_set_updated_at
  before update on public.kredit_records
  for each row execute function public.set_updated_at();

drop trigger if exists target_cabang_set_updated_at on public.target_cabang;
create trigger target_cabang_set_updated_at
  before update on public.target_cabang
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- 5. Row Level Security
--    Dashboard hanya membaca; seluruh penulisan lewat service role
--    (route handler /api/upload) yang otomatis melewati RLS.
-- -------------------------------------------------------------
alter table public.kredit_records enable row level security;
alter table public.target_cabang  enable row level security;
alter table public.upload_logs    enable row level security;

-- Kebijakan lama yang mengizinkan baca publik dicabut bila masih ada.
-- Data kredit memuat identitas nasabah (CIF, nomor rekening, nama), sehingga
-- tidak boleh terbaca hanya dengan memegang anon key.
drop policy if exists "kredit_records baca publik" on public.kredit_records;
drop policy if exists "target_cabang baca publik"  on public.target_cabang;

drop policy if exists "kredit_records baca user login" on public.kredit_records;
create policy "kredit_records baca user login"
  on public.kredit_records for select
  to authenticated
  using (true);

drop policy if exists "target_cabang baca user login" on public.target_cabang;
create policy "target_cabang baca user login"
  on public.target_cabang for select
  to authenticated
  using (true);

drop policy if exists "upload_logs baca user login" on public.upload_logs;
create policy "upload_logs baca user login"
  on public.upload_logs for select
  to authenticated
  using (true);

-- Catatan keamanan:
-- 1. Tidak ada kebijakan insert/update/delete sama sekali, jadi seluruh
--    penulisan hanya bisa lewat service role di route /api/upload.
-- 2. Peran `anon` tidak lagi punya akses baca. Dashboard, /api/records, dan
--    halaman admin semuanya mensyaratkan sesi Supabase yang valid.
-- 3. Untuk membatasi per Area Head atau per cabang, ganti `using (true)`
--    dengan pencocokan terhadap klaim JWT, mis.
--    `using (area_head = auth.jwt() -> 'user_metadata' ->> 'area_head')`.


-- =============================================================
-- BAGIAN 2 - Dataset tambahan
--
-- Dua format berkas lain yang bentuknya berbeda dari SL 18:
--   * dpk_looser   : Top 30 Looser DPK, satu sheet per outlet
--   * akun_records : data mentah akun (sheet OLD_ACCOUNT / NEW_ACCOUNT)
-- =============================================================

-- -------------------------------------------------------------
-- 6. Top 30 Looser DPK
--    Satu baris = satu nasabah pada satu outlet dan satu periode.
-- -------------------------------------------------------------
create table if not exists public.dpk_looser (
  id             uuid primary key default gen_random_uuid(),
  /** Tanggal 1 pada bulan `tanggal_akhir`, agar sejajar dengan dataset lain. */
  periode        date not null,
  /** Kedua tanggal pembanding, diambil dari judul kolom "Saldo <tanggal>". */
  tanggal_awal   date,
  tanggal_akhir  date,
  sc             text,
  cabang         text not null,
  outlet         text not null,
  jenis_produk   text,
  ranking        integer,
  cif            text not null,
  nama           text,
  segmen         text,
  saldo_awal     numeric(20, 2) not null default 0,
  saldo_akhir    numeric(20, 2) not null default 0,
  /** saldo_akhir - saldo_awal; negatif berarti dana keluar. */
  delta_saldo    numeric(20, 2) not null default 0,
  raw            jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint dpk_looser_unik unique (periode, outlet, cif)
);

create index if not exists dpk_looser_periode_idx on public.dpk_looser (periode desc);
create index if not exists dpk_looser_cabang_idx  on public.dpk_looser (cabang);
create index if not exists dpk_looser_outlet_idx  on public.dpk_looser (outlet);
create index if not exists dpk_looser_delta_idx   on public.dpk_looser (delta_saldo);

-- -------------------------------------------------------------
-- 7. Data mentah akun
--    Kolom PII (NIK, telepon, alamat) sengaja TIDAK disimpan: kolom
--    tersebut tidak dipakai analisis, dan menyimpannya hanya memperluas
--    permukaan data pribadi yang harus dijaga. Karena alasan yang sama
--    tabel ini tidak menyimpan snapshot `raw` seluruh 129 kolom.
-- -------------------------------------------------------------
create table if not exists public.akun_records (
  id                 uuid primary key default gen_random_uuid(),
  /** Posisi data (as of), diisi dari kolom Periode pada halaman unggah. */
  periode            date not null,
  /** Sheet asalnya: OLD_ACCOUNT atau NEW_ACCOUNT. */
  sumber             text not null check (sumber in ('old', 'new')),
  /** Kunci turunan yang stabil; lihat catatan pada src/lib/datasets.ts. */
  kode_akun          text not null,

  cif                text,
  nama_debitur       text,
  no_pk              text,
  area               text,
  branch_code        text,
  branch_name        text,
  kode_outlet        text,
  nama_outlet        text,
  nama_akk           text,

  produk             text,
  tipe               text,
  program            text,
  segmen_ews         text,
  segmen_kelola      text,
  sektor_ekonomi     text,
  ket_status         text,

  plafon             numeric(20, 2) not null default 0,
  baki_debet         numeric(20, 2) not null default 0,
  outstanding        numeric(20, 2) not null default 0,
  saldo_akhir        numeric(20, 2) not null default 0,
  total_tunggakan    numeric(20, 2) not null default 0,
  total_kewajiban    numeric(20, 2) not null default 0,

  /** Kategori DPD apa adanya dari berkas, mis. "1. current", "8. 181+ dpd". */
  dpd_kategori       text,
  dpd_hari           integer not null default 0,
  golongan           smallint not null default 1 check (golongan between 1 and 5),
  suku_bunga         numeric(8, 4),

  tanggal_buka       date,
  tanggal_jatuh_tempo date,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint akun_records_unik unique (periode, sumber, kode_akun)
);

create index if not exists akun_records_periode_idx  on public.akun_records (periode desc);
create index if not exists akun_records_sumber_idx   on public.akun_records (sumber);
create index if not exists akun_records_branch_idx   on public.akun_records (branch_name);
create index if not exists akun_records_area_idx     on public.akun_records (area);
create index if not exists akun_records_golongan_idx on public.akun_records (golongan);

-- -------------------------------------------------------------
-- 8. Trigger updated_at untuk tabel baru
-- -------------------------------------------------------------
drop trigger if exists dpk_looser_set_updated_at on public.dpk_looser;
create trigger dpk_looser_set_updated_at
  before update on public.dpk_looser
  for each row execute function public.set_updated_at();

drop trigger if exists akun_records_set_updated_at on public.akun_records;
create trigger akun_records_set_updated_at
  before update on public.akun_records
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- 9. View agregat
--    Tabel akun bisa memuat puluhan ribu baris, jadi dashboard TIDAK
--    memuat barisnya satu per satu. Peringkasan dikerjakan PostgreSQL
--    lewat view di bawah, dan yang dikirim ke browser hanya hasilnya.
--
--    `security_invoker = on` wajib: tanpa itu view dieksekusi dengan hak
--    pemiliknya dan justru melewati RLS pada tabel sumbernya.
-- -------------------------------------------------------------
drop view if exists public.dpk_ringkasan_outlet;
create view public.dpk_ringkasan_outlet
  with (security_invoker = on) as
select
  periode,
  cabang,
  outlet,
  count(*)::bigint            as jumlah_nasabah,
  sum(saldo_awal)             as total_saldo_awal,
  sum(saldo_akhir)            as total_saldo_akhir,
  sum(delta_saldo)            as total_delta,
  min(tanggal_awal)           as tanggal_awal,
  max(tanggal_akhir)          as tanggal_akhir
from public.dpk_looser
group by periode, cabang, outlet;

drop view if exists public.akun_ringkasan_cabang;
create view public.akun_ringkasan_cabang
  with (security_invoker = on) as
select
  periode,
  sumber,
  area,
  branch_name,
  count(*)::bigint                                          as jumlah_rekening,
  sum(baki_debet)                                           as total_baki_debet,
  sum(total_tunggakan)                                      as total_tunggakan,
  count(*) filter (where golongan >= 3)::bigint             as jumlah_npl,
  sum(baki_debet) filter (where golongan >= 3)              as baki_debet_npl,
  count(*) filter (where dpd_hari > 0)::bigint              as jumlah_menunggak
from public.akun_records
group by periode, sumber, area, branch_name;

drop view if exists public.akun_sebaran_dpd;
create view public.akun_sebaran_dpd
  with (security_invoker = on) as
select
  periode,
  sumber,
  coalesce(nullif(dpd_kategori, ''), 'Tidak diketahui') as dpd_kategori,
  count(*)::bigint                                      as jumlah_rekening,
  sum(baki_debet)                                       as total_baki_debet
from public.akun_records
group by periode, sumber, coalesce(nullif(dpd_kategori, ''), 'Tidak diketahui');

-- -------------------------------------------------------------
-- 10. RLS untuk tabel baru (sama seperti tabel lain: hanya user login)
-- -------------------------------------------------------------
alter table public.dpk_looser   enable row level security;
alter table public.akun_records enable row level security;

drop policy if exists "dpk_looser baca user login" on public.dpk_looser;
create policy "dpk_looser baca user login"
  on public.dpk_looser for select
  to authenticated
  using (true);

drop policy if exists "akun_records baca user login" on public.akun_records;
create policy "akun_records baca user login"
  on public.akun_records for select
  to authenticated
  using (true);

-- Catatan: unggahan ulang memperbarui baris dengan kunci yang sama, tetapi
-- TIDAK menghapus baris lama yang hilang dari berkas terbaru. Untuk memuat
-- ulang satu periode dari nol, hapus dulu periodenya:
--   delete from public.dpk_looser   where periode = '2026-08-01';
--   delete from public.akun_records where periode = '2026-06-30' and sumber = 'old';
