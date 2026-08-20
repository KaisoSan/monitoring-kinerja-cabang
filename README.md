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
8. [Pemecahan Masalah](#pemecahan-masalah)
9. [Catatan Keamanan](#catatan-keamanan)

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

### Dua Dataset Tambahan

Selain SL 18, dashboard membaca dua format berkas lain yang strukturnya
berbeda. Keduanya punya tabel, opsi unggah, dan seksi dashboard sendiri.

| | DPK — Top 30 Looser | Data Akun |
|---|---|---|
| Tabel | `dpk_looser` | `akun_records` |
| Struktur berkas | **Satu sheet per outlet**, judul kolom di **baris ke-4** | Sheet `OLD_ACCOUNT` dan `NEW_ACCOUNT` (akhiran garis bawah ikut dikenali) |
| Yang dibaca | Seluruh sheet sekaligus; sheet kosong dilewati | Kedua sheet sekaligus; sheet lain diabaikan |
| Catatan khusus | Kolom S/C–Jenis Produk hanya terisi di baris pertama lalu diteruskan ke bawah. Tanggal pembanding diambil dari judul kolom `Saldo <tanggal>`. Selisih dihitung ulang dari kedua kolom saldo. | Kolom PII (NIK, telepon, alamat) **tidak** disimpan. Ringkasan dikerjakan PostgreSQL lewat view karena satu berkas bisa memuat puluhan ribu rekening. |
| Seksi dashboard | Penurunan saldo per outlet + tabel nasabah | Sebaran DPD + portofolio per cabang |

Kedua seksi punya filternya sendiri dan **tidak** mengikuti Slicer Global,
karena dimensinya berbeda dari SL 18. Hal ini dinyatakan pada deskripsi tiap
seksi agar tidak salah dibaca.

Tidak ada satu pun kolom pada berkas akun yang benar-benar unik (CIF + No_PK
hanya menghasilkan 28.545 kombinasi dari 28.551 baris), sehingga kuncinya
disusun dari kombinasi paling stabil lalu diberi nomor urut saat tetap kembar.
Kunci tersebut sama setiap kali berkas yang sama diunggah ulang.

### Manajemen Target

Target cabang tidak harus lewat berkas Excel. Halaman `/admin` punya tab
**Manajemen Target** untuk mengisinya langsung dari layar:

- **Periode** default bulan berjalan, bisa diganti.
- **Cabang** dan **Produk** diambil otomatis dari data kredit yang sudah masuk
  (view `dimensi_kredit`), jadi tidak ada ketikan bebas yang berisiko salah eja.
- **Area Head** tidak ditanyakan; nilainya diturunkan dari cabang yang dipilih,
  karena kolom itu wajib pada `target_cabang`.
- Isian nominal memberi pemisah ribuan sambil mengetik dan menampilkan bentuk
  ringkasnya (`Rp 5,00 M`), sehingga kelebihan satu nol langsung terlihat.
- Memilih kombinasi yang sudah punya target akan memuat angkanya, sehingga
  tombol simpan sekaligus berfungsi sebagai "ubah".

Penyimpanan memakai **upsert** pada kunci `periode + cabang + produk` — kunci
yang sama dipakai berkas Excel target, sehingga kedua jalur tidak saling
menggandakan baris. Setiap perubahan dicatat di `target_logs` beserta email
pengubahnya.

Menyimpan target menuntut email yang terdaftar pada `ADMIN_EMAILS`, sama seperti
mengunggah berkas.

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
- membersihkan karakter yang ditolak PostgreSQL (lihat
  [Pemecahan Masalah](#pemecahan-masalah)),
- menampilkan pratinjau pemetaan kolom serta daftar baris yang dilewati,
- mengirim data ke Supabase secara **batch** dengan `upsert`, dan
- memberi notifikasi toast untuk status loading, sukses, dan error.

### Sumber data
Seluruh angka pada dashboard — kartu, grafik, opsi Slicer, dan Tabel Data
Detail — berasal dari tabel Supabase, tanpa perantara data contoh.

Bila data tidak bisa dibaca, dashboard **menyatakan sebabnya** alih-alih
menampilkan angka pengganti: environment belum diisi, sesi berakhir, kueri
gagal, atau tabel memang masih kosong. Ini disengaja — pada dashboard kredit,
angka contoh yang tampil seolah-olah data asli jauh lebih berbahaya daripada
halaman kosong.

---

## Menjalankan Secara Lokal

```bash
npm install
npm run dev
```

Buka <http://localhost:3000>. Tanpa konfigurasi apa pun, dashboard sudah tampil

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
- `dpk_looser` dan `akun_records` — dua dataset tambahan (Bagian 2),
- `dimensi_kredit` dan `target_logs` — penopang Manajemen Target (Bagian 3),
- view agregat `dpk_ringkasan_outlet`, `akun_ringkasan_cabang`, dan
  `akun_sebaran_dpd`, semuanya dengan `security_invoker = on` supaya RLS pada
  tabel sumbernya tetap berlaku,
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
data cabang Anda akan langsung tampil di seluruh pilar dan Slicer.

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
│   ├── api/target/route.ts      Pilihan dropdown + upsert target
│   └── api/upload/route.ts      Upsert batch dengan service role
├── components/
│   ├── dashboard/               Slicer, header, dan 4 pilar
│   ├── admin/                   Uploader Excel, form login
│   └── ui/                      Primitif neumorphism
├── lib/
│   ├── columns.ts               Definisi 86 kolom + kolom default
│   ├── datasets.ts              Pemeta berkas DPK & Akun + gerbang unggah
│   ├── dates.ts                 Pembentuk & pemvalidasi tanggal ISO
│   ├── excel.ts                 Pembersih header + parser workbook
│   ├── navigation.ts            Penyaring redirect `next` (anti open redirect)
│   ├── sanitize.ts              Pembersih karakter yang ditolak PostgreSQL
│   ├── metrics.ts               Seluruh agregasi & rumus pilar
│   ├── data.ts                  Pemuat data Supabase (tanpa data contoh)
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

## Pemecahan Masalah

### Dropdown cabang pada Manajemen Target kosong

Daftar cabang diambil dari data kredit yang sudah masuk. Bila `kredit_records`
masih kosong, dropdown ikut kosong — unggah berkas SL 18 lebih dulu. Bila
datanya sudah ada tetapi dropdown tetap kosong, view `dimensi_kredit` belum
terbentuk; jalankan ulang `supabase/schema.sql`.

### Seksi DPK atau Data Akun menyebut tabelnya belum ada

Kedua dataset itu ditambahkan pada **Bagian 2** `supabase/schema.sql`. Jalankan
ulang seluruh isi berkas tersebut di SQL Editor — skripnya idempotent, jadi
tabel dan data yang sudah ada tidak terpengaruh.

Unggahan ulang memperbarui baris dengan kunci yang sama, tetapi tidak menghapus
baris lama yang tidak lagi muncul di berkas terbaru. Untuk memuat ulang satu
periode dari nol, hapus dulu periodenya (perintahnya ada di akhir
`supabase/schema.sql`).

### Dashboard kosong padahal data sudah masuk Supabase

Dashboard tidak pernah menampilkan angka pengganti, jadi kartu status yang
muncul menyebutkan sebabnya:

| Pesan | Artinya |
|---|---|
| Supabase belum dikonfigurasi | `.env.local` belum diisi, atau belum terbaca oleh proses yang sedang berjalan (di hosting: env belum diset lalu redeploy). |
| Sesi tidak ditemukan | Belum login. Kebijakan RLS hanya membuka data untuk pengguna terautentikasi. |
| Data gagal dimuat | Pesan asli dari Supabase ikut ditampilkan — biasanya `supabase/schema.sql` belum dijalankan di project tersebut. |
| Belum ada data kredit | Koneksi sehat, tetapi tabel `kredit_records` masih kosong. |

Seluruh halaman dan route data memakai `dynamic = "force-dynamic"`,
`revalidate = 0`, dan `fetchCache = "force-no-store"`, serta memanggil
Supabase dengan `cache: "no-store"`. Setelah unggahan sukses, uploader juga
memanggil `router.refresh()` sehingga data baru langsung terlihat tanpa
tersangkut cache.

### `unsupported Unicode escape sequence` saat mengunggah

Galat ini datang dari PostgreSQL, bukan dari aplikasi. Ekstrak dari sistem inti
kerap menyisakan byte yang tidak terlihat di Excel:

| Karakter | Akibat |
|---|---|
| **NUL (`U+0000`)** | Ditolak pada tipe `text` **dan** `jsonb`. Inilah penyebab galat di atas. |
| **Surrogate yatim** | Separuh pasangan UTF-16 tanpa pasangannya; ditolak dengan galat serupa. |
| **Kontrol C0 lain** | Diterima PostgreSQL, tetapi merusak tampilan tabel dan hasil ekspor. |

Sejak versi ini karakter tersebut dibersihkan otomatis oleh
[`src/lib/sanitize.ts`](src/lib/sanitize.ts) di dua titik: saat parsing di
browser, dan sekali lagi di server sebelum `upsert`. Bila ada karakter yang
dibuang, jumlahnya dilaporkan pada notifikasi keberhasilan unggah — pembersihan
tidak pernah terjadi diam-diam.

Tab, newline, dan carriage return sengaja dipertahankan. `U+FFFD` (tanda tanya
dalam wajik) juga tidak dibuang: karakter itu sah disimpan dan justru menjadi
penanda bahwa ada kerusakan encoding di sistem hulu.

### `date/time field value out of range` saat mengunggah

Kolom tanggal pada ekstrak sistem inti kerap bercampur format. Parser kini
mengenali semuanya dan **tidak pernah** menghasilkan tanggal yang tidak ada di
kalender:

| Bentuk di Excel | Hasil |
|---|---|
| `18/06/2026`, `18-06-2026`, `18.06.2026` | `2026-06-18` |
| `01/18/2026` (urutan bulan-hari) | `2026-01-18` |
| `18/06/26` (tahun dua digit) | `2026-06-18` |
| `18/06/2026 00:00:00`, `2026-06-18T00:00:00` | `2026-06-18` |
| `18 Juni 2026`, `18-Jun-2026`, `Jun 18, 2026` | `2026-06-18` |
| Serial Excel, objek `Date` | sesuai nilainya |
| `31/02/2026`, `bukan tanggal` | `null` |

Urutan hari dan bulan ditentukan per nilai: bila salah satu komponen lebih
dari 12, urutannya pasti dan tidak ditebak. Bila **keduanya** 12 ke bawah
(mis. `06/07/2026`) nilainya benar-benar ambigu, dan sistem memilih `DD/MM`
mengikuti konvensi Indonesia — pastikan file sumber konsisten.

Tanggal yang tidak bisa diurai **tidak menggagalkan batch**: kolom periode
mundur ke Periode Default, tanggal booking menjadi kosong, dan keduanya
muncul pada daftar **Catatan Pemeriksaan** di halaman unggah.

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
