# Dashboard Monitoring Kinerja Kredit

Dashboard eksekutif untuk memonitor kinerja kredit cabang secara interaktif —
lengkap dengan **slicer global** (Area Head, Cabang/KCP, Produk, Pengelola),
empat pilar analisis, dan halaman admin untuk mengunggah file Excel mentah
langsung ke Supabase.

Dibangun dengan **Next.js (App Router) + Supabase + Tailwind CSS v4**, memakai
gaya visual **neumorphism** dengan palet BNI (teal, oranye, abu-abu terang).

---

## Daftar Isi

1. [Fitur](#fitur)
2. [Menjalankan Secara Lokal](#menjalankan-secara-lokal)
3. [Setup Supabase Langkah demi Langkah](#setup-supabase-langkah-demi-langkah)
4. [Menyiapkan File Excel](#menyiapkan-file-excel)
5. [Struktur Proyek](#struktur-proyek)
6. [Rumus Metrik](#rumus-metrik)
7. [Perintah yang Tersedia](#perintah-yang-tersedia)
8. [Catatan Keamanan](#catatan-keamanan)

---

## Fitur

### Slicer Global
Empat dropdown di header yang memfilter **seluruh** kartu, grafik, dan tabel
secara real-time. Slicer bersifat *cascading*: memilih `AH 2` otomatis
mempersempit daftar cabang menjadi cabang di bawah AH 2 saja, dan pilihan yang
menjadi tidak valid dibersihkan otomatis. Dropdown pengelola menyediakan kotak
pencarian saat daftarnya panjang.

### Empat Pilar

| Pilar | Isi |
|---|---|
| **1. Pencapaian** | Kartu Total Baki Debet, Growth, Target, dan Debitur Aktif + bar chart Target vs Realisasi per cabang (bisa dialihkan ke tampilan tabel) |
| **2. Pipeline** | Funnel Prospek → Analisa → Booking dengan konversi antar tahap, plus tabel funneling per cabang |
| **3. Produktivitas** | Leaderboard Top 10 pengelola dan Bottom 10 (otomatis menampilkan yang **nihil booking** bila ada) |
| **4. Kualitas Kredit** | Rasio LAR, NPL, dan portofolio menunggak; sebaran DPD; komposisi kolektibilitas; tabel indikator risiko per cabang |

### Halaman Admin (`/admin`)
Dilindungi Supabase Auth + allowlist email. Berisi area **drag & drop** untuk
file `.xlsx` / `.xls` / `.xlsm` / `.csv` yang:

- melewati baris judul/logo di atas header secara otomatis,
- membersihkan nama kolom menjadi `snake_case` dan memetakan alias umum
  (`Nama RM` → `pengelola`, `Outstanding (Rp)` → `baki_debet`, dst.),
- memahami format angka Indonesia (`Rp 1.234.567,89`) maupun Inggris,
- menampilkan pratinjau pemetaan kolom serta daftar baris yang dilewati,
- mengirim data ke Supabase secara **batch** dengan `upsert`, dan
- memberi notifikasi toast untuk status loading, sukses, dan error.

### Berjalan tanpa Supabase
Bila environment Supabase belum diisi, dashboard otomatis menampilkan
**dataset contoh deterministik** (12 cabang, 3 Area Head, 3 produk, ~30
pengelola) sehingga UI langsung bisa dinilai. Sebuah banner menandai bahwa
data yang tampil adalah data contoh.

---

## Menjalankan Secara Lokal

```bash
npm install
npm run dev
```

Buka <http://localhost:3000>. Tanpa konfigurasi apa pun, dashboard sudah tampil
memakai data contoh.

---

## Setup Supabase Langkah demi Langkah

### Langkah 1 — Buat project

1. Masuk ke <https://supabase.com> lalu buat project baru.
2. Catat **Project URL**, **anon key**, dan **service_role key** dari
   *Project Settings → API*.

### Langkah 2 — Buat tabel

Buka **SQL Editor** di Supabase Studio, tempel seluruh isi
[`supabase/schema.sql`](supabase/schema.sql), lalu jalankan. Skrip ini membuat:

- `kredit_records` — tabel fakta, satu baris per fasilitas/aplikasi kredit
  (kunci unik: `kode_fasilitas`),
- `target_cabang` — target per periode/cabang/produk
  (kunci unik: `periode, cabang, produk`),
- `upload_logs` — jejak aktivitas unggah,
- trigger `updated_at`, index, dan kebijakan Row Level Security.

Skrip bersifat idempotent, jadi aman dijalankan berulang.

### Langkah 3 — Isi environment

```bash
cp .env.example .env.local
```

Isi keempat nilainya:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
ADMIN_EMAILS=pimpinan@bank.co.id,admin@bank.co.id
```

> `SUPABASE_SERVICE_ROLE_KEY` **tidak** boleh diberi awalan `NEXT_PUBLIC_`.
> Key ini hanya dibaca di server oleh route `/api/upload`.

### Langkah 4 — Buat user admin

Di Supabase Studio buka *Authentication → Users → Add user*, isi email dan
password, lalu centang **Auto Confirm User**. Pastikan email tersebut terdaftar
pada `ADMIN_EMAILS`.

### Langkah 5 — Jalankan ulang & unggah

```bash
npm run dev
```

Buka `/admin`, login, lalu unggah file Excel. Setelah unggahan sukses, buka `/`
— banner "Data Contoh" akan berganti menjadi "Data Supabase".

---

## Menyiapkan File Excel

Hasilkan file contoh berisi header yang sengaja dibuat berantakan:

```bash
npm run template
```

File tersimpan di `contoh/`. Gunakan file ini untuk menguji uploader.

### Kolom `kredit_records`

| Kolom kanonik | Wajib | Contoh header yang dikenali |
|---|:---:|---|
| `kode_fasilitas` | – | No Rekening, Nomor Aplikasi, CIF, Kode Fasilitas |
| `periode` | – | Periode, Bulan, Tanggal Laporan |
| `area_head` | – | AH, Area, Area Head, Wilayah |
| `cabang` | ✅ | Cabang, KCP, Nama Cabang / KCP, Unit |
| `produk` | ✅ | Produk, Jenis Kredit, Segmen |
| `pengelola` | ✅ | Nama RM, Sales, Account Officer, AO |
| `nama_debitur` | – | Debitur, Nama Nasabah |
| `status_pipeline` | – | Status, Status Kredit, Tahapan |
| `plafon` | – | Plafon, Plafond (Rp), Limit |
| `baki_debet` | – | Outstanding (Rp), OS, Baki Debet |
| `baki_debet_awal` | – | Saldo Awal, Baki Debet Awal |
| `kolektibilitas` | – | Kol, Kolektibilitas (Kol) |
| `dpd` | – | DPD (Hari), Tunggakan, Hari Tunggakan |
| `is_restruktur` | – | Restruktur, Flag Restruktur |
| `tanggal_booking` | – | Tgl Booking, Tanggal Realisasi |

Satuan di belakang nama kolom (`(Rp)`, `(Juta)`, `(Hari)`) otomatis dilepas.
Nilai `status_pipeline` menerima sinonim: `On Process` → `analisa`,
`Realisasi`/`Cair` → `booking`, dan seterusnya.

Kolom yang tidak ada di daftar akan diabaikan. Untuk menambah alias baru,
sunting `HEADER_ALIASES` di [`src/lib/excel.ts`](src/lib/excel.ts).

### Kolom `target_cabang`

`periode`, `area_head`, `cabang` (wajib), `produk`,
`target_baki_debet` (wajib), `target_booking_nominal`.

---

## Struktur Proyek

```
src/
├── app/
│   ├── page.tsx                 Dashboard (Server Component)
│   ├── admin/page.tsx           Halaman admin + riwayat unggahan
│   ├── admin/login/page.tsx     Login Supabase Auth
│   └── api/upload/route.ts      Upsert batch dengan service role
├── components/
│   ├── dashboard/               Slicer, header, dan 4 pilar
│   ├── admin/                   Uploader Excel, form login
│   └── ui/                      Primitif neumorphism
├── lib/
│   ├── excel.ts                 Pembersih header + parser workbook
│   ├── metrics.ts               Seluruh agregasi & rumus pilar
│   ├── data.ts                  Pemuat data Supabase + fallback contoh
│   ├── sample-data.ts           Dataset contoh deterministik
│   ├── format.ts                Format rupiah, persen, periode
│   └── supabase/                Klien browser, server, dan service role
├── proxy.ts                     Penjaga rute /admin
supabase/schema.sql              Skema tabel, index, trigger, RLS
scripts/generate-template.mjs    Pembuat file Excel contoh
tests/                           Uji parser & pembacaan workbook
```

---

## Rumus Metrik

Seluruh rumus terkumpul di [`src/lib/metrics.ts`](src/lib/metrics.ts).

- **Growth** = `baki_debet` − `baki_debet_awal`, hanya untuk baris berstatus
  `booking`.
- **Pencapaian** = realisasi ÷ target × 100.
- **Funnel** bersifat kumulatif: aplikasi yang sudah `booking` ikut terhitung
  pada tahap `prospek` dan `analisa`, sehingga konversi antar tahap tidak
  pernah melebihi 100%.
- **NPL** = baki debet dengan kolektibilitas ≥ 3.
- **LAR** = baki debet dengan kolektibilitas ≥ 2 **atau** berstatus hasil
  restrukturisasi.
- **Bottom 10** menampilkan pengelola dengan nol booking; bila seluruh
  pengelola sudah membukukan booking, tabel jatuh ke performa terendah.
- Baris yang belum `booking` selalu dipaksa `baki_debet = 0` agar pipeline
  tidak mengembang menjadi outstanding.

Ambang batas indikator (`NPL_WARN`, `NPL_BAD`, `LAR_WARN`, `LAR_BAD`) diatur di
[`src/components/dashboard/PilarKualitas.tsx`](src/components/dashboard/PilarKualitas.tsx).

---

## Perintah yang Tersedia

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Menjalankan server pengembangan |
| `npm run build` | Build produksi |
| `npm start` | Menjalankan hasil build |
| `npm run lint` | ESLint |
| `npm test` | Uji parser Excel & pembacaan workbook |
| `npm run template` | Membuat file Excel contoh di `contoh/` |

---

## Catatan Keamanan

- **RLS aktif** pada seluruh tabel. Dashboard hanya membaca; seluruh penulisan
  melewati route `/api/upload` yang memakai service role di server.
- Route upload memverifikasi sesi Supabase **dan** allowlist `ADMIN_EMAILS`,
  lalu menyaring ulang setiap baris di server — payload dari browser tidak
  pernah dipercaya apa adanya.
- Kebijakan bawaan mengizinkan `select` publik pada data kredit. Bila dashboard
  perlu dibatasi ke user internal, ubah kebijakan tersebut menjadi
  `to authenticated` (lihat catatan di akhir `supabase/schema.sql`) dan
  wajibkan login pada halaman dashboard.
- **Dependensi `xlsx`.** Versi di registry npm (`0.18.5`) memiliki dua advisory
  (prototype pollution & ReDoS) yang perbaikannya hanya dirilis lewat CDN resmi
  SheetJS. Bila jaringan Anda mengizinkan, pasang versi yang sudah diperbaiki:

  ```bash
  npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
  ```

  Parsing di aplikasi ini berjalan di browser admin atas file yang diunggah
  admin sendiri, sehingga paparannya terbatas — tetapi pemutakhiran tetap
  disarankan.
