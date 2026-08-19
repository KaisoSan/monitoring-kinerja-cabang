import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "teal" | "orange" | "good" | "warn" | "bad";

const TONES: Record<BadgeTone, string> = {
  neutral: "text-ink-700",
  teal: "text-bni-teal-700",
  orange: "text-bni-orange-600",
  good: "text-state-good-text",
  warn: "text-state-warn-text",
  bad: "text-state-bad-text",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={`neu-inset-sm inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Bar progres neumorphic dengan track cekung dan isi berwarna. */
export function ProgressBar({
  value,
  tone = "teal",
  className = "",
}: {
  /** Persentase 0-100+; nilai di atas 100 tetap ditampilkan penuh. */
  value: number;
  tone?: "teal" | "orange" | "good" | "warn" | "bad";
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const fill: Record<string, string> = {
    teal: "bg-bni-teal-600",
    orange: "bg-bni-orange-500",
    good: "bg-state-good",
    warn: "bg-state-warn",
    bad: "bg-state-bad",
  };

  return (
    <div
      className={`neu-inset-sm h-2.5 w-full overflow-hidden rounded-full ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${fill[tone]}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
