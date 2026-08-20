"use client";

import { useCallback, useMemo, useState } from "react";
import { GlobalSlicer } from "./GlobalSlicer";
import { PilarPencapaian } from "./PilarPencapaian";
import { PilarPipeline } from "./PilarPipeline";
import { PilarProduktivitas } from "./PilarProduktivitas";
import { PilarKualitas } from "./PilarKualitas";
import { TabelDataDetail } from "./TabelDataDetail";
import {
  buildFunnel,
  buildKualitasPerCabang,
  buildLeaderboard,
  buildPipelinePerCabang,
  buildSlicerOptions,
  buildTargetVsRealisasi,
  filterRecords,
  filterTargets,
  reconcileSlicer,
  summarizeKualitas,
  summarizePencapaian,
} from "@/lib/metrics";
import {
  EMPTY_SLICER,
  SLICER_KEYS,
  type KreditRecord,
  type SlicerKey,
  type SlicerState,
  type TargetCabang,
} from "@/lib/types";

const SECTIONS = [
  { id: "pilar-pencapaian", label: "Pencapaian" },
  { id: "pilar-pipeline", label: "Pipeline" },
  { id: "pilar-produktivitas", label: "Produktivitas" },
  { id: "pilar-kualitas", label: "Kualitas Kredit" },
  { id: "tabel-detail", label: "Data Detail" },
];

export function DashboardShell({
  records,
  targets,
}: {
  records: KreditRecord[];
  targets: TargetCabang[];
}) {
  const [slicer, setSlicer] = useState<SlicerState>(EMPTY_SLICER);

  const handleChange = useCallback(
    (key: SlicerKey, value: string | null) => {
      // Setiap perubahan direkonsiliasi supaya pilihan lain yang jadi tidak
      // valid (mis. cabang di luar Area Head baru) otomatis dibersihkan.
      setSlicer((current) => reconcileSlicer(records, { ...current, [key]: value }));
    },
    [records],
  );

  const handleReset = useCallback(() => setSlicer(EMPTY_SLICER), []);

  // Seluruh agregasi dihitung ulang dari satu sumber `filtered`, sehingga
  // kartu, grafik, dan tabel dijamin konsisten saat slicer berubah.
  const view = useMemo(() => {
    const filtered = filterRecords(records, slicer);
    const filteredTargets = filterTargets(targets, slicer);

    return {
      filtered,
      options: buildSlicerOptions(records, slicer),
      pencapaian: summarizePencapaian(filtered, filteredTargets),
      targetVsRealisasi: buildTargetVsRealisasi(filtered, filteredTargets),
      funnel: buildFunnel(filtered),
      pipelinePerCabang: buildPipelinePerCabang(filtered),
      leaderboard: buildLeaderboard(filtered),
      kualitas: summarizeKualitas(filtered),
      kualitasPerCabang: buildKualitasPerCabang(filtered),
    };
  }, [records, targets, slicer]);

  const activeCount = SLICER_KEYS.filter((key) => slicer[key] !== null).length;

  return (
    <div className="space-y-5">
      <GlobalSlicer
        slicer={slicer}
        options={view.options}
        onChange={handleChange}
        onReset={handleReset}
        activeCount={activeCount}
        matchedRows={view.filtered.length}
        totalRows={records.length}
      />

      <nav aria-label="Navigasi pilar" className="flex flex-wrap gap-2">
        {SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="neu-press text-ink-700 rounded-2xl px-4 py-2 text-xs font-bold"
          >
            {section.label}
          </a>
        ))}
      </nav>

      <section id="pilar-pencapaian" className="scroll-mt-44">
        <PilarPencapaian summary={view.pencapaian} rows={view.targetVsRealisasi} />
      </section>

      <section id="pilar-pipeline" className="scroll-mt-44">
        <PilarPipeline funnel={view.funnel} perCabang={view.pipelinePerCabang} />
      </section>

      <section id="pilar-produktivitas" className="scroll-mt-44">
        <PilarProduktivitas leaderboard={view.leaderboard} />
      </section>

      <section id="pilar-kualitas" className="scroll-mt-44">
        <PilarKualitas summary={view.kualitas} perCabang={view.kualitasPerCabang} />
      </section>

      <section id="tabel-detail" className="scroll-mt-44">
        <TabelDataDetail slicer={slicer} />
      </section>
    </div>
  );
}
