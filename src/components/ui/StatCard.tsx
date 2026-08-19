import type { ReactNode } from "react";
import { ProgressBar } from "./Badge";

export type StatTone = "teal" | "orange" | "good" | "warn" | "bad";

const ICON_TONE: Record<StatTone, string> = {
  teal: "text-bni-teal-700",
  orange: "text-bni-orange-800",
  good: "text-state-good-text",
  warn: "text-state-warn-text",
  bad: "text-state-bad-text",
};

type StatCardProps = {
  label: string;
  value: string;
  icon?: ReactNode;
  tone?: StatTone;
  /** Baris kecil di bawah nilai utama, mis. nominal penuh. */
  hint?: string;
  /** Angka perubahan; warna mengikuti tanda kecuali `invertDelta` aktif. */
  delta?: { text: string; positive: boolean };
  /** Jika diisi, kartu menampilkan bar progres di bagian bawah. */
  progress?: { value: number; caption: string; tone?: StatTone };
};

export function StatCard({
  label,
  value,
  icon,
  tone = "teal",
  hint,
  delta,
  progress,
}: StatCardProps) {
  return (
    <article className="neu animate-fade-up flex flex-col justify-between rounded-3xl p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-ink-500 text-xs font-semibold tracking-wide uppercase">{label}</p>
        {icon ? (
          <span
            className={`neu-sm grid size-9 shrink-0 place-items-center rounded-xl ${ICON_TONE[tone]}`}
          >
            {icon}
          </span>
        ) : null}
      </div>

      <p className="text-ink-900 mt-3 text-2xl font-bold tracking-tight sm:text-[1.7rem]">
        {value}
      </p>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        {delta ? (
          <span
            className={`text-sm font-semibold ${delta.positive ? "text-state-good-text" : "text-state-bad-text"}`}
          >
            {delta.text}
          </span>
        ) : null}
        {hint ? <span className="text-ink-500 text-xs">{hint}</span> : null}
      </div>

      {progress ? (
        <div className="mt-4">
          <ProgressBar value={progress.value} tone={progress.tone ?? tone} />
          <p className="text-ink-500 mt-2 text-xs">{progress.caption}</p>
        </div>
      ) : null}
    </article>
  );
}
