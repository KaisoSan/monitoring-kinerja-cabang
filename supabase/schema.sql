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

drop policy if exists "kredit_records baca publik" on public.kredit_records;
create policy "kredit_records baca publik"
  on public.kredit_records for select
  using (true);

drop policy if exists "target_cabang baca publik" on public.target_cabang;
create policy "target_cabang baca publik"
  on public.target_cabang for select
  using (true);

drop policy if exists "upload_logs baca user login" on public.upload_logs;
create policy "upload_logs baca user login"
  on public.upload_logs for select
  to authenticated
  using (true);

-- Catatan keamanan:
-- Kebijakan di atas membuat data kredit bisa dibaca siapa pun yang memegang
-- anon key. Bila dashboard perlu dibatasi ke user internal saja, ganti
-- `for select using (true)` menjadi `for select to authenticated using (true)`
-- lalu wajibkan login pada halaman dashboard.
