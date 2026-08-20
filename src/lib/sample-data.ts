import type { KreditRecord, StatusPipeline, TargetCabang } from "./types";

/**
 * Dataset contoh yang dipakai saat Supabase belum dikonfigurasi atau saat
 * tabel masih kosong, supaya dashboard tetap bisa dinilai secara visual.
 *
 * Angka dibangkitkan dengan PRNG ber-seed (deterministik) agar hasil render
 * di server dan client identik — tanpa ini akan terjadi hydration mismatch.
 */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const AREA = {
  "AH 1": ["KC Jakarta Kota", "KCP Menteng", "KCP Kelapa Gading", "KCP Sudirman"],
  "AH 2": ["KC Bandung", "KCP Cimahi", "KCP Cirebon", "KCP Tasikmalaya"],
  "AH 3": ["KC Surabaya", "KCP Sidoarjo", "KCP Malang", "KCP Gresik"],
} as const;

const PRODUK = ["SME", "SBP", "KUR"] as const;

const NAMA_DEPAN = [
  "Andi", "Budi", "Citra", "Dewi", "Eko", "Farah", "Gunawan", "Hana",
  "Indra", "Joko", "Kartika", "Lina", "Maya", "Nanda", "Oscar", "Putri",
  "Rizal", "Sinta", "Tomi", "Umar", "Vina", "Wahyu", "Yuni", "Zaki",
];
const NAMA_BELAKANG = [
  "Pratama", "Wijaya", "Santoso", "Hartono", "Nugroho", "Halim",
  "Saputra", "Kusuma", "Ramadhan", "Permata",
];
const BADAN_USAHA = ["PT", "CV", "UD", "Koperasi"];
const BIDANG = [
  "Sentosa Abadi", "Karya Mandiri", "Bumi Persada", "Cahaya Timur",
  "Mitra Sejahtera", "Rejeki Makmur", "Anugerah Jaya", "Sinar Terang",
  "Harapan Baru", "Global Nusantara",
];

export const SAMPLE_PERIODE = "2026-08-01";

type Pengelola = { nama: string; cabang: string; area: string };

function buildPengelola(rand: () => number): Pengelola[] {
  const list: Pengelola[] = [];
  let index = 0;
  for (const [area, cabangList] of Object.entries(AREA)) {
    for (const cabang of cabangList) {
      const jumlah = 2 + Math.floor(rand() * 2); // 2-3 RM per cabang
      for (let i = 0; i < jumlah; i += 1) {
        const nama = `${NAMA_DEPAN[index % NAMA_DEPAN.length]} ${
          NAMA_BELAKANG[(index * 3) % NAMA_BELAKANG.length]
        }`;
        list.push({ nama, cabang, area });
        index += 1;
      }
    }
  }
  return list;
}

function pickStatus(rand: () => number): StatusPipeline {
  const roll = rand();
  if (roll < 0.55) return "booking";
  if (roll < 0.75) return "analisa";
  if (roll < 0.93) return "prospek";
  return roll < 0.97 ? "ditolak" : "batal";
}

/** Sebaran mendekati portofolio sehat: NPL ~3%, LAR ~9%. */
function pickKolektibilitas(rand: () => number): number {
  const roll = rand();
  if (roll < 0.93) return 1;
  if (roll < 0.965) return 2;
  if (roll < 0.982) return 3;
  if (roll < 0.994) return 4;
  return 5;
}

function dpdForKol(kol: number, rand: () => number): number {
  if (kol === 1) return rand() < 0.96 ? 0 : 1 + Math.floor(rand() * 14);
  if (kol === 2) return 15 + Math.floor(rand() * 76); // 15-90
  if (kol === 3) return 91 + Math.floor(rand() * 30);
  if (kol === 4) return 121 + Math.floor(rand() * 60);
  return 181 + Math.floor(rand() * 200);
}

export function buildSampleRecords(): KreditRecord[] {
  const rand = mulberry32(20260819);
  const pengelolaList = buildPengelola(rand);
  const records: KreditRecord[] = [];

  // Sebagian RM sengaja dibuat nihil booking agar tabel Bottom 10 terisi.
  const nihilBooking = new Set(
    pengelolaList.filter((_, i) => i % 9 === 4).map((p) => p.nama),
  );

  let counter = 0;
  for (const pengelola of pengelolaList) {
    const jumlahDebitur = 16 + Math.floor(rand() * 12); // 16-27 debitur per RM
    for (let i = 0; i < jumlahDebitur; i += 1) {
      counter += 1;
      const produk = PRODUK[Math.floor(rand() * PRODUK.length)];

      let status = pickStatus(rand);
      if (nihilBooking.has(pengelola.nama) && status === "booking") status = "analisa";

      const isBooking = status === "booking";
      const skala = produk === "KUR" ? 1 : produk === "SBP" ? 6 : 12;
      const plafon = Math.round((150_000_000 + rand() * 350_000_000) * skala * 0.01) * 100;

      const kol = isBooking ? pickKolektibilitas(rand) : 1;
      const bakiDebet = isBooking ? Math.round(plafon * (0.55 + rand() * 0.45)) : 0;
      // Growth berkisar -12% s.d. +25% terhadap posisi awal periode.
      const bakiDebetAwal = isBooking
        ? Math.round(bakiDebet / (0.88 + rand() * 0.37))
        : 0;

      records.push({
        kode_fasilitas: `FAS-${String(counter).padStart(5, "0")}`,
        periode: SAMPLE_PERIODE,
        area_head: pengelola.area,
        cabang: pengelola.cabang,
        produk,
        pengelola: pengelola.nama,
        nama_debitur: `${BADAN_USAHA[Math.floor(rand() * BADAN_USAHA.length)]} ${
          BIDANG[Math.floor(rand() * BIDANG.length)]
        }`,
        status_pipeline: status,
        plafon,
        baki_debet: bakiDebet,
        baki_debet_awal: bakiDebetAwal,
        kolektibilitas: kol,
        dpd: isBooking ? dpdForKol(kol, rand) : 0,
        is_restruktur: isBooking && rand() < 0.025,
        tanggal_booking: isBooking
          ? `2026-0${1 + Math.floor(rand() * 8)}-${String(1 + Math.floor(rand() * 28)).padStart(2, "0")}`
          : null,
      });
    }
  }

  return records;
}

/** Target dibuat di sekitar realisasi supaya pencapaian berkisar 85-115%. */
export function buildSampleTargets(records: KreditRecord[]): TargetCabang[] {
  const rand = mulberry32(77120260);
  const grouped = new Map<string, { area: string; cabang: string; produk: string; realisasi: number }>();

  for (const record of records) {
    if (record.status_pipeline !== "booking") continue;
    const key = `${record.cabang}|${record.produk}`;
    const entry = grouped.get(key);
    if (entry) entry.realisasi += record.baki_debet;
    else
      grouped.set(key, {
        area: record.area_head,
        cabang: record.cabang,
        produk: record.produk,
        realisasi: record.baki_debet,
      });
  }

  return [...grouped.values()].map((entry) => {
    const faktor = 0.87 + rand() * 0.3;
    const target = Math.round((entry.realisasi / faktor) / 1_000_000) * 1_000_000;
    return {
      periode: SAMPLE_PERIODE,
      area_head: entry.area,
      cabang: entry.cabang,
      produk: entry.produk,
      target_baki_debet: target,
      target_booking_nominal: Math.round(target * 0.25),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Snapshot kolom sumber untuk data contoh                             */
/* ------------------------------------------------------------------ */

const SEKTOR = [
  ["4711", "Perdagangan Eceran", "12", "Perdagangan Besar dan Eceran"],
  ["1071", "Industri Roti dan Kue", "05", "Industri Pengolahan"],
  ["4100", "Konstruksi Gedung", "09", "Konstruksi"],
  ["0111", "Pertanian Padi", "01", "Pertanian dan Kehutanan"],
  ["5610", "Restoran", "13", "Penyediaan Akomodasi dan Makan Minum"],
  ["4922", "Angkutan Darat", "10", "Transportasi dan Pergudangan"],
];

const PERUNTUKAN = ["Modal Kerja", "Investasi", "Konsumtif"];
const INSTITUSI = ["Perorangan", "Badan Usaha", "Koperasi"];
const JENIS_KUR = ["KUR Mikro", "KUR Kecil", "KUR Super Mikro", "-"];
const KET_KOL_1 = ["Lancar Murni", "Lancar Pernah Tunggak", "-"];

/** PRNG kecil ber-seed dari string, supaya nilainya stabil per rekening. */
function seededFrom(text: string) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return mulberry32(hash >>> 0);
}

function addMonths(iso: string, months: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, day));
  return date.toISOString().slice(0, 10);
}

/**
 * Membentuk snapshot 86 kolom untuk satu baris data contoh. Nilai diturunkan
 * dari record itu sendiri agar konsisten dengan angka di kartu dan grafik,
 * sisanya dibangkitkan deterministik dari `kode_fasilitas`.
 */
export function buildSampleRaw(
  record: KreditRecord,
  index: number,
): Record<string, unknown> {
  const rand = seededFrom(record.kode_fasilitas);
  const sektor = SEKTOR[Math.floor(rand() * SEKTOR.length)];
  const kodeCabang = `0${100 + (index % 90)}`;
  const jangkaWaktu = [12, 24, 36, 48, 60][Math.floor(rand() * 5)];
  const jatuhTempo = addMonths(record.tanggal_booking ?? record.periode, jangkaWaktu);
  const [jtYear, jtMonth, jtDay] = jatuhTempo.split("-");

  const tgkPokok = record.dpd > 0 ? Math.round(record.baki_debet * 0.02) : 0;
  const tgkBunga = record.dpd > 0 ? Math.round(record.baki_debet * 0.004) : 0;
  const sukuBunga = Number((7 + rand() * 5).toFixed(2));
  const bcmSehat = record.kolektibilitas === 1 && record.dpd === 0;

  return {
    no: index + 1,
    tanggal: record.periode,
    kode_cab: kodeCabang,
    nama_cab: record.cabang,
    kode_kln: `${kodeCabang}1`,
    sentra_code: `S${200 + (index % 40)}`,
    kode_kcp: `${kodeCabang}9`,
    account_type: record.produk === "KUR" ? "KUR" : "KOM",
    sub_category: record.produk === "SME" ? "SME-01" : `${record.produk}-02`,
    produk: record.produk,
    peruntukan: PERUNTUKAN[Math.floor(rand() * PERUNTUKAN.length)],
    currency: "IDR",
    kurs: 1,
    cif: `${8000000 + index * 7}`,
    no_rek: record.kode_fasilitas,
    nama_nas: record.nama_debitur,
    kol: record.kolektibilitas,
    maks_krd: record.plafon,
    ijin_tarik: Math.max(0, record.plafon - record.baki_debet),
    saldo_pokok: record.baki_debet,
    tgk_pokok: tgkPokok,
    tgk_bunga: tgkBunga,
    denda: record.dpd > 90 ? Math.round(tgkBunga * 0.1) : 0,
    tgk_biaya: 0,
    bk_debet: record.baki_debet,
    bk_dbt_idr: record.baki_debet,
    disponible: Math.max(0, record.plafon - record.baki_debet),
    suku_bunga: sukuBunga,
    suku_bunga_efektif: Number((sukuBunga + 0.35).toFixed(2)),
    jw: jangkaWaktu,
    jth_tempo: jatuhTempo,
    umur_tgk_hr: record.dpd,
    kode_segmen: record.produk === "KUR" ? "KUR" : "SME",
    kode_sektor_ek_new: sektor[0],
    sektor_ek_desc_new: sektor[1],
    "20_group_sektor_ek_new": sektor[2],
    "20_group_sektor_ek_desc_new": sektor[3],
    npp: `NPP${1000 + (index % 300)}`,
    nama_pengelola: record.pengelola,
    propisi: Math.round(record.plafon * 0.01),
    pembebanan_bunga: "Efektif",
    ppap_idr: Math.round(record.baki_debet * (record.kolektibilitas >= 3 ? 0.5 : 0.01)),
    no_rek_afi: `${9000000000 + index * 13}`,
    ccy_rek_afi: "IDR",
    jadwal_angs_pok: "Bulanan",
    akum_by_bg_akrual: Math.round(record.baki_debet * 0.003),
    by_bg_harian: Math.round((record.baki_debet * sukuBunga) / 36500),
    saldo_akhir_afi: Math.round(record.baki_debet * 0.05 * rand()),
    saldo_blokir_afi: 0,
    saldo_efektif_afi: Math.round(record.baki_debet * 0.04 * rand()),
    kode_inst: `I${10 + (index % 5)}`,
    institusi: INSTITUSI[Math.floor(rand() * INSTITUSI.length)],
    tgl_buka_rek: record.tanggal_booking ?? record.periode,
    tgl_pk: record.tanggal_booking ?? record.periode,
    no_pk: `PK-${String(index + 1).padStart(5, "0")}`,
    restrukturisasi: record.is_restruktur ? "Ya" : "Tidak",
    kode_flag_covid: "N",
    desk_flag_covid: "Non Covid",
    ang_pokok_idr: Math.round(record.baki_debet / jangkaWaktu),
    tunda_jatuh_tempo: "Tidak",
    tanggal_tunda_jt: null,
    tipe_debitur: INSTITUSI[Math.floor(rand() * INSTITUSI.length)],
    special_int_rate: 0,
    gross_rate: Number((sukuBunga + 1.1).toFixed(2)),
    flag_esg: rand() < 0.15 ? "Y" : "N",
    nama_flag_esg: rand() < 0.15 ? "Pembiayaan Berkelanjutan" : "-",
    kode_grup_perusahaan: rand() < 0.2 ? `GRP-${100 + (index % 20)}` : "-",
    id_referral_sapm: rand() < 0.3 ? `SAPM-${index % 500}` : "-",
    clean_basis: rand() < 0.1 ? "Y" : "N",
    flag_xpora: rand() < 0.08 ? "Y" : "N",
    jenis_kredit: record.produk === "KUR" ? "KUR" : "Komersial",
    jenis_kur: record.produk === "KUR"
      ? JENIS_KUR[Math.floor(rand() * 3)]
      : "-",
    outlet: record.cabang,
    ket_kol_1: record.kolektibilitas === 1
      ? KET_KOL_1[Math.floor(rand() * 2)]
      : "-",
    kewajiban_dspa: Math.round(record.baki_debet * 0.02),
    kewajiban_dsra: Math.round(record.baki_debet * 0.01),
    afil_kewajiban: Math.round(record.baki_debet * 0.03),
    afil_kewajiban_dspa: Math.round(record.baki_debet * 0.015),
    dspa: Math.round(record.baki_debet * 0.02 * rand()),
    dsra: Math.round(record.baki_debet * 0.01 * rand()),
    ketersediaan_dspa: rand() < 0.7 ? "Tersedia" : "Belum",
    "jth_tempo_tgl": Number(jtDay),
    "jth_tempo_bulan": Number(jtMonth),
    "jth_tempo_tahun": Number(jtYear),
    "jth_tempo_ket": jatuhTempo <= record.periode ? "Jatuh Tempo" : "Belum Jatuh Tempo",
    cek_bcm: bcmSehat ? "OK" : record.kolektibilitas >= 3 ? "NPL" : "PERHATIAN",
  };
}
