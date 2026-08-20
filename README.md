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

### Tabel Data Detail + Column Chooser

Di bawah keempat pilar terdapat tabel data level rekening yang juga mengikuti
slicer global. Tombol **Pilih Kolom** membuka daftar checkbox berisi seluruh
**86 kolom file sumber**:

- Saat pertama dibuka hanya 6 kolom esensial yang tampil:
  `Nama Cab`, `Nama Pengelola`, `Nama Nas`, `Bk Debet`, `Kol.`, `CEK BCM`.
- Mencentang kolom lain langsung menambahkannya ke tabel secara real-time.
- Kolom selalu dirender mengikuti urutan file sumber, bukan urutan
  pencentangan, supaya posisinya tidak berpindah-pindah.
- Tersedia pencarian nama kolom serta tombol **Pilih Semua**, **Kosongkan**,
  dan **Kolom Esensial**.
- **Kolom pertama bersifat lengket (sticky)**: identitas baris tetap terlihat
  saat tabel digeser mendatar. Dengan 86 kolom aktif lebar tabelnya lebih dari
  10.000px, dan scroll-nya terkurung di dalam kartu sehingga halaman tidak
  ikut melebar.
- Data diambil per halaman (50 baris) lewat `GET /api/records`, sehingga
  membuka 86 kolom tidak membebani payload dashboard.

Agar kolom apa pun bisa ditampilkan tanpa menambah kolom baru di database,
setiap baris menyimpan **snapshot kolom asli** pada kolom `raw` (JSONB),
dikunci nama kolom aslinya dalam snake_case. Kolom yang punya padanan field
bertipe (mis. `Bk Debet` -> `baki_debet`) tetap jatuh ke field tersebut bila
snapshot kosong, misalnya pada data yang diunggah sebelum fitur ini ada.

### Akses & Peran
Begitu Supabase dikonfigurasi, **seluruh permukaan yang menyentuh data kredit
mewajibkan login**: dashboard, `/api/records`, dan halaman admin. Ada dua
tingkat akses:

| Peran | Syarat | Boleh |
|---|---|---|
| Pengguna | Punya akun Supabase yang valid | Membuka dashboard dan Tabel Data Detail |
| Admin | Akun Supabase **dan** emailnya ada di `ADMIN_EMAILS` | Semua di atas, plus mengunggah data di `/admin` |

Pengguna yang sudah login tetapi bukan admin akan melihat pesan penolakan yang
jelas di `/admin`, bukan dilempar bolak-balik ke halaman login.

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
Bila environment Supabase belum diisi, tidak ada data asli yang bisa dibuka,
sehingga login tidak diwajibkan dan dashboard otomatis menampilkan
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

### Langkah 4 — Buat user

Di Supabase Studio buka *Authentication → Users → Add user*, isi email dan
password, lalu centang **Auto Confirm User**. Buat satu akun untuk setiap orang
yang perlu membuka dashboard.

Email yang juga perlu mengunggah data harus didaftarkan pada `ADMIN_EMAILS`.
Akun lain tetap bisa membuka dashboard, tetapi tidak bisa mengunggah.

> Bila `ADMIN_EMAILS` dikosongkan, **setiap** user Supabase yang berhasil login
> dianggap admin. Selalu isi di produksi.

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

Tiga berkas tersimpan di `contoh/`:

| Berkas | Isi |
|---|---|
| `contoh-data-kredit.xlsx` | Contoh ringkas dengan header berantakan |
| `contoh-target-cabang.xlsx` | Contoh target per cabang/produk |
| `contoh-86-kolom.xlsx` | Meniru layout asli 86 kolom, untuk menguji uploader sekaligus Tabel Data Detail |

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

Kolom yang tidak ada di daftar tetap tersimpan pada snapshot `raw` dan bisa
ditampilkan lewat Column Chooser, hanya saja tidak ikut dihitung pada pilar.
Untuk menambah alias baru, sunting `HEADER_ALIASES` di
[`src/lib/excel.ts`](src/lib/excel.ts).

**Kolom status bersifat opsional.** Ekstrak portofolio umumnya tidak punya
kolom status karena seluruh isinya sudah berjalan. Bila kolom status tidak
ditemukan, baris yang punya baki debet atau tanggal booking otomatis dianggap
`booking`; sisanya `prospek`.

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
│   ├── api/records/route.ts     Satu halaman data detail (86 kolom)
│   └── api/upload/route.ts      Upsert batch dengan service role
├── components/
│   ├── dashboard/               Slicer, header, dan 4 pilar
│   ├── admin/                   Uploader Excel, form login
│   └── ui/                      Primitif neumorphism
├── lib/
│   ├── columns.ts               Definisi 86 kolom + kolom default
│   ├── excel.ts                 Pembersih header + parser workbook
│   ├── navigation.ts            Penyaring redirect `next` (anti open redirect)
│   ├── metrics.ts               Seluruh agregasi & rumus pilar
│   ├── data.ts                  Pemuat data Supabase + fallback contoh
│   ├── sample-data.ts           Dataset contoh deterministik
│   ├── format.ts                Format rupiah, persen, periode
│   └── supabase/                Klien browser, server, dan service role
├── proxy.ts                     Penjaga sesi untuk /, /admin, dan /api/records
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
- `CIF` **tidak** dipakai sebagai kunci fasilitas: satu CIF bisa memiliki
  banyak rekening, sehingga kuncinya adalah `No Rek.`.

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

### Lapisan akses data

Data kredit memuat identitas nasabah (CIF, nomor rekening, nama), sehingga
dijaga berlapis — satu lapis bocor tidak langsung membuka datanya:

1. **RLS di database.** `kredit_records`, `target_cabang`, dan `upload_logs`
   hanya mengizinkan `select` untuk peran `authenticated`. Peran `anon` tidak
   punya akses baca sama sekali, jadi memegang anon key saja tidak cukup.
   Tidak ada kebijakan `insert`/`update`/`delete`, sehingga seluruh penulisan
   hanya mungkin lewat service role.
2. **Proxy rute.** `src/proxy.ts` mewajibkan sesi Supabase untuk `/`,
   `/admin/*`, dan `/api/records`. Rute halaman dialihkan ke halaman login,
   sedangkan rute `/api/*` menjawab `401` JSON agar pemanggil menerima
   kegagalan yang bisa ditangani, bukan HTML halaman login.
3. **Pemeriksaan di dalam route.** `/api/records` dan `/api/upload`
   memverifikasi sesinya sendiri, tidak menyandarkan diri pada proxy — kalau
   suatu saat matcher proxy meleset, endpoint tetap tertutup.

`/api/upload` menambah satu syarat lagi: email pemanggil harus ada di
`ADMIN_EMAILS`, dan setiap baris disaring ulang di server sehingga payload dari
browser tidak pernah dipercaya apa adanya.

### Hal lain

- Parameter `next` pada halaman login disaring `safeNextPath()` sehingga hanya
  menerima path internal — mencegah open redirect ke domain lain.
- Service role key hanya dibaca di server dan tidak pernah dikirim ke browser.
- Untuk membatasi akses per Area Head atau per cabang, ganti `using (true)`
  pada kebijakan RLS dengan pencocokan klaim JWT — contohnya ada di akhir
  `supabase/schema.sql`.
- **Dependensi `xlsx`.** Versi di registry npm (`0.18.5`) memiliki dua advisory
  (prototype pollution & ReDoS) yang perbaikannya hanya dirilis lewat CDN resmi
  SheetJS. Bila jaringan Anda mengizinkan, pasang versi yang sudah diperbaiki:

  ```bash
  npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
  ```

  Parsing di aplikasi ini berjalan di browser admin atas file yang diunggah
  admin sendiri, sehingga paparannya terbatas — tetapi pemutakhiran tetap
  disarankan.
