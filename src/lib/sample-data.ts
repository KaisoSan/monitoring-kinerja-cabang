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
