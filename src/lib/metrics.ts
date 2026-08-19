import { ratio } from "./format";
import {
  EMPTY_SLICER,
  PIPELINE_STAGES,
  SLICER_KEYS,
  type KreditRecord,
  type PipelineStage,
  type SlicerKey,
  type SlicerState,
  type TargetCabang,
} from "./types";

/* ------------------------------------------------------------------ */
/* Filtering                                                           */
/* ------------------------------------------------------------------ */

type Sliceable = Pick<KreditRecord, SlicerKey>;

function matches(row: Partial<Sliceable>, slicer: SlicerState, ignore?: SlicerKey): boolean {
  return SLICER_KEYS.every((key) => {
    if (key === ignore) return true;
    const selected = slicer[key];
    return selected === null || row[key] === selected;
  });
}

export function filterRecords(records: KreditRecord[], slicer: SlicerState): KreditRecord[] {
  return records.filter((record) => matches(record, slicer));
}

/**
 * Target tidak punya dimensi `pengelola`, jadi slicer pengelola sengaja
 * diabaikan saat memfilter target agar angka target cabang tetap utuh.
 */
export function filterTargets(targets: TargetCabang[], slicer: SlicerState): TargetCabang[] {
  return targets.filter((target) => matches(target, slicer, "pengelola"));
}

/**
 * Opsi slicer bersifat cascading: pilihan pada satu dimensi mempersempit
 * daftar opsi dimensi lain, tetapi tidak mempersempit dirinya sendiri
 * (supaya pengguna tetap bisa berpindah pilihan).
 */
export function buildSlicerOptions(
  records: KreditRecord[],
  slicer: SlicerState,
): Record<SlicerKey, string[]> {
  const result = {} as Record<SlicerKey, string[]>;
  for (const key of SLICER_KEYS) {
    const values = new Set<string>();
    for (const record of records) {
      if (matches(record, slicer, key) && record[key]) values.add(record[key]);
    }
    result[key] = [...values].sort((a, b) => a.localeCompare(b, "id-ID"));
  }
  return result;
}

/**
 * Membuang pilihan yang sudah tidak valid setelah dimensi lain berubah,
 * mis. cabang yang tidak lagi berada di bawah Area Head yang dipilih.
 */
export function reconcileSlicer(records: KreditRecord[], next: SlicerState): SlicerState {
  const reconciled: SlicerState = { ...next };
  for (const key of SLICER_KEYS) {
    const selected = reconciled[key];
    if (selected === null) continue;
    const stillValid = records.some(
      (record) => record[key] === selected && matches(record, reconciled, key),
    );
    if (!stillValid) reconciled[key] = null;
  }
  return reconciled;
}

export function isSlicerActive(slicer: SlicerState): boolean {
  return SLICER_KEYS.some((key) => slicer[key] !== EMPTY_SLICER[key]);
}

/* ------------------------------------------------------------------ */
/* Klasifikasi kualitas kredit                                         */
/* ------------------------------------------------------------------ */

export const isBooked = (r: KreditRecord) => r.status_pipeline === "booking";

/** NPL: kolektibilitas 3 (kurang lancar), 4 (diragukan), 5 (macet). */
export const isNpl = (r: KreditRecord) => isBooked(r) && r.kolektibilitas >= 3;

/** LAR (Loan at Risk): kol-2 + seluruh NPL + kol-1 hasil restrukturisasi. */
export const isLar = (r: KreditRecord) =>
  isBooked(r) && (r.kolektibilitas >= 2 || r.is_restruktur);

export const DPD_BUCKETS = [
  { key: "lancar", label: "0 hari (Lancar)", min: 0, max: 0 },
  { key: "dpd_1_30", label: "1 - 30 hari", min: 1, max: 30 },
  { key: "dpd_31_60", label: "31 - 60 hari", min: 31, max: 60 },
  { key: "dpd_61_90", label: "61 - 90 hari", min: 61, max: 90 },
  { key: "dpd_90_plus", label: "> 90 hari", min: 91, max: Number.POSITIVE_INFINITY },
] as const;

export type DpdBucketKey = (typeof DPD_BUCKETS)[number]["key"];

/* ------------------------------------------------------------------ */
/* Pilar 1 - Pencapaian                                                */
/* ------------------------------------------------------------------ */

export type PencapaianSummary = {
  totalBakiDebet: number;
  bakiDebetAwal: number;
  growthNominal: number;
  growthPercent: number;
  totalTarget: number;
  achievementPercent: number;
  gapToTarget: number;
  jumlahDebitur: number;
  jumlahCabang: number;
  rataRataPerDebitur: number;
};

export function summarizePencapaian(
  records: KreditRecord[],
  targets: TargetCabang[],
): PencapaianSummary {
  const booked = records.filter(isBooked);
  const totalBakiDebet = sum(booked, (r) => r.baki_debet);
  const bakiDebetAwal = sum(booked, (r) => r.baki_debet_awal);
  const totalTarget = sum(targets, (t) => t.target_baki_debet);
  const growthNominal = totalBakiDebet - bakiDebetAwal;

  return {
    totalBakiDebet,
    bakiDebetAwal,
    growthNominal,
    growthPercent: ratio(growthNominal, bakiDebetAwal),
    totalTarget,
    achievementPercent: ratio(totalBakiDebet, totalTarget),
    gapToTarget: totalBakiDebet - totalTarget,
    jumlahDebitur: booked.length,
    jumlahCabang: new Set(booked.map((r) => r.cabang)).size,
    rataRataPerDebitur: booked.length ? totalBakiDebet / booked.length : 0,
  };
}

export type TargetVsRealisasiRow = {
  cabang: string;
  target: number;
  realisasi: number;
  achievementPercent: number;
};

export function buildTargetVsRealisasi(
  records: KreditRecord[],
  targets: TargetCabang[],
): TargetVsRealisasiRow[] {
  const realisasi = new Map<string, number>();
  for (const record of records) {
    if (!isBooked(record)) continue;
    realisasi.set(record.cabang, (realisasi.get(record.cabang) ?? 0) + record.baki_debet);
  }

  const target = new Map<string, number>();
  for (const row of targets) {
    target.set(row.cabang, (target.get(row.cabang) ?? 0) + row.target_baki_debet);
  }

  const cabangList = [...new Set([...realisasi.keys(), ...target.keys()])];
  return cabangList
    .map((cabang) => {
      const t = target.get(cabang) ?? 0;
      const r = realisasi.get(cabang) ?? 0;
      return { cabang, target: t, realisasi: r, achievementPercent: ratio(r, t) };
    })
    .sort((a, b) => b.realisasi - a.realisasi);
}

/* ------------------------------------------------------------------ */
/* Pilar 2 - Pipeline                                                  */
/* ------------------------------------------------------------------ */

export type FunnelStage = {
  stage: PipelineStage;
  label: string;
  jumlah: number;
  nominal: number;
  /** Persentase terhadap tahap sebelumnya. */
  conversionFromPrev: number;
  /** Persentase terhadap tahap paling awal (prospek). */
  conversionFromTop: number;
};

const STAGE_LABELS: Record<PipelineStage, string> = {
  prospek: "Prospek",
  analisa: "Analisa",
  booking: "Booking",
};

/**
 * Funnel bersifat kumulatif: aplikasi yang sudah booking pasti pernah
 * melewati analisa dan prospek, jadi tahap awal menghitung seluruh
 * aplikasi yang berada pada tahap itu atau lebih jauh.
 */
export function buildFunnel(records: KreditRecord[]): FunnelStage[] {
  const stages = PIPELINE_STAGES.map((stage, index) => {
    const reached = records.filter((r) => {
      const position = PIPELINE_STAGES.indexOf(r.status_pipeline as PipelineStage);
      return position >= index;
    });
    return {
      stage,
      label: STAGE_LABELS[stage],
      jumlah: reached.length,
      nominal: sum(reached, (r) => (stage === "booking" ? r.baki_debet : r.plafon)),
    };
  });

  const top = stages[0]?.jumlah ?? 0;
  return stages.map((entry, index) => {
    const prev = index === 0 ? entry.jumlah : stages[index - 1].jumlah;
    return {
      ...entry,
      conversionFromPrev: ratio(entry.jumlah, prev),
      conversionFromTop: ratio(entry.jumlah, top),
    };
  });
}

export type PipelinePerCabangRow = {
  cabang: string;
  prospek: number;
  analisa: number;
  booking: number;
  nominalPipeline: number;
  conversionPercent: number;
};

export function buildPipelinePerCabang(records: KreditRecord[]): PipelinePerCabangRow[] {
  const grouped = groupBy(records, (r) => r.cabang);

  return [...grouped.entries()]
    .map(([cabang, rows]) => {
      const prospek = rows.filter((r) => r.status_pipeline === "prospek").length;
      const analisa = rows.filter((r) => r.status_pipeline === "analisa").length;
      const booking = rows.filter(isBooked).length;
      const belumBooking = rows.filter(
        (r) => r.status_pipeline === "prospek" || r.status_pipeline === "analisa",
      );
      const total = prospek + analisa + booking;
      return {
        cabang,
        prospek,
        analisa,
        booking,
        nominalPipeline: sum(belumBooking, (r) => r.plafon),
        conversionPercent: ratio(booking, total),
      };
    })
    .sort((a, b) => b.nominalPipeline - a.nominalPipeline);
}

/* ------------------------------------------------------------------ */
/* Pilar 3 - Produktivitas                                             */
/* ------------------------------------------------------------------ */

export type SalesPerformance = {
  pengelola: string;
  cabang: string;
  area_head: string;
  jumlahBooking: number;
  nominalBooking: number;
  bakiDebet: number;
  growthNominal: number;
  pipelineAktif: number;
  nominalPipeline: number;
};

export function buildSalesPerformance(records: KreditRecord[]): SalesPerformance[] {
  const grouped = groupBy(records, (r) => r.pengelola);

  return [...grouped.entries()].map(([pengelola, rows]) => {
    const booked = rows.filter(isBooked);
    const pipeline = rows.filter(
      (r) => r.status_pipeline === "prospek" || r.status_pipeline === "analisa",
    );
    return {
      pengelola,
      cabang: dominant(rows.map((r) => r.cabang)),
      area_head: dominant(rows.map((r) => r.area_head)),
      jumlahBooking: booked.length,
      nominalBooking: sum(booked, (r) => r.baki_debet),
      bakiDebet: sum(booked, (r) => r.baki_debet),
      growthNominal: sum(booked, (r) => r.baki_debet - r.baki_debet_awal),
      pipelineAktif: pipeline.length,
      nominalPipeline: sum(pipeline, (r) => r.plafon),
    };
  });
}

export type Leaderboard = {
  top: SalesPerformance[];
  /**
   * Sales tanpa booking sama sekali pada periode terpilih. Kalau semua
   * sales sudah booking, jatuh kembali ke performa terendah.
   */
  bottom: SalesPerformance[];
  bottomIsNihil: boolean;
  totalSales: number;
  salesNihilBooking: number;
};

export function buildLeaderboard(records: KreditRecord[], size = 10): Leaderboard {
  const performances = buildSalesPerformance(records);
  const nihil = performances.filter((p) => p.jumlahBooking === 0);

  const top = [...performances]
    .filter((p) => p.jumlahBooking > 0)
    .sort((a, b) => b.nominalBooking - a.nominalBooking || b.jumlahBooking - a.jumlahBooking)
    .slice(0, size);

  const bottomSource = nihil.length > 0 ? nihil : performances;
  const bottom = [...bottomSource]
    .sort((a, b) => a.nominalBooking - b.nominalBooking || b.nominalPipeline - a.nominalPipeline)
    .slice(0, size);

  return {
    top,
    bottom,
    bottomIsNihil: nihil.length > 0,
    totalSales: performances.length,
    salesNihilBooking: nihil.length,
  };
}

/* ------------------------------------------------------------------ */
/* Pilar 4 - Kualitas kredit                                           */
/* ------------------------------------------------------------------ */

export type KualitasSummary = {
  totalBakiDebet: number;
  larNominal: number;
  larRatio: number;
  nplNominal: number;
  nplRatio: number;
  dpdNominal: number;
  dpdRatio: number;
  jumlahDebiturNpl: number;
  jumlahDebiturDpd: number;
  kolektibilitas: { kol: number; jumlah: number; nominal: number }[];
  dpdBuckets: { key: DpdBucketKey; label: string; jumlah: number; nominal: number }[];
};

export function summarizeKualitas(records: KreditRecord[]): KualitasSummary {
  const booked = records.filter(isBooked);
  const totalBakiDebet = sum(booked, (r) => r.baki_debet);

  const nplRows = booked.filter(isNpl);
  const larRows = booked.filter(isLar);
  const dpdRows = booked.filter((r) => r.dpd > 0);

  const nplNominal = sum(nplRows, (r) => r.baki_debet);
  const larNominal = sum(larRows, (r) => r.baki_debet);
  const dpdNominal = sum(dpdRows, (r) => r.baki_debet);

  return {
    totalBakiDebet,
    larNominal,
    larRatio: ratio(larNominal, totalBakiDebet),
    nplNominal,
    nplRatio: ratio(nplNominal, totalBakiDebet),
    dpdNominal,
    dpdRatio: ratio(dpdNominal, totalBakiDebet),
    jumlahDebiturNpl: nplRows.length,
    jumlahDebiturDpd: dpdRows.length,
    kolektibilitas: [1, 2, 3, 4, 5].map((kol) => {
      const rows = booked.filter((r) => r.kolektibilitas === kol);
      return { kol, jumlah: rows.length, nominal: sum(rows, (r) => r.baki_debet) };
    }),
    dpdBuckets: DPD_BUCKETS.map((bucket) => {
      const rows = booked.filter((r) => r.dpd >= bucket.min && r.dpd <= bucket.max);
      return {
        key: bucket.key,
        label: bucket.label,
        jumlah: rows.length,
        nominal: sum(rows, (r) => r.baki_debet),
      };
    }),
  };
}

export type KualitasPerCabangRow = {
  cabang: string;
  bakiDebet: number;
  nplNominal: number;
  nplRatio: number;
  larNominal: number;
  larRatio: number;
  debiturDpd: number;
};

export function buildKualitasPerCabang(records: KreditRecord[]): KualitasPerCabangRow[] {
  const grouped = groupBy(records.filter(isBooked), (r) => r.cabang);

  return [...grouped.entries()]
    .map(([cabang, rows]) => {
      const bakiDebet = sum(rows, (r) => r.baki_debet);
      const nplNominal = sum(rows.filter(isNpl), (r) => r.baki_debet);
      const larNominal = sum(rows.filter(isLar), (r) => r.baki_debet);
      return {
        cabang,
        bakiDebet,
        nplNominal,
        nplRatio: ratio(nplNominal, bakiDebet),
        larNominal,
        larRatio: ratio(larNominal, bakiDebet),
        debiturDpd: rows.filter((r) => r.dpd > 0).length,
      };
    })
    .sort((a, b) => b.nplRatio - a.nplRatio);
}

/* ------------------------------------------------------------------ */
/* Util                                                                */
/* ------------------------------------------------------------------ */

function sum<T>(rows: T[], pick: (row: T) => number): number {
  return rows.reduce((total, row) => total + (Number(pick(row)) || 0), 0);
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const bucket = map.get(k);
    if (bucket) bucket.push(row);
    else map.set(k, [row]);
  }
  return map;
}

/** Nilai yang paling sering muncul; dipakai saat satu sales lintas cabang. */
function dominant(values: string[]): string {
  const counter = new Map<string, number>();
  for (const value of values) counter.set(value, (counter.get(value) ?? 0) + 1);
  let best = "";
  let bestCount = -1;
  for (const [value, count] of counter) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}
