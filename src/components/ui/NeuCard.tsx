import type { ReactNode } from "react";

type NeuCardProps = {
  children: ReactNode;
  className?: string;
  /** `sunken` dipakai untuk area di dalam kartu (tabel, chart well). */
  variant?: "raised" | "sunken";
};

export function NeuCard({ children, className = "", variant = "raised" }: NeuCardProps) {
  const surface = variant === "raised" ? "neu" : "neu-inset";
  return (
    <section className={`${surface} rounded-3xl p-5 sm:p-6 ${className}`}>{children}</section>
  );
}

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  icon,
  action,
}: SectionHeaderProps) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-4">
        {icon ? (
          <span className="neu-sm text-bni-teal-700 grid size-11 shrink-0 place-items-center rounded-2xl">
            {icon}
          </span>
        ) : null}
        <div>
          {eyebrow ? (
            <p className="text-bni-orange-800 text-xs font-semibold tracking-[0.14em] uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="text-ink-900 text-lg font-bold sm:text-xl">{title}</h2>
          {description ? (
            <p className="text-ink-500 mt-1 max-w-2xl text-sm">{description}</p>
          ) : null}
        </div>
      </div>
      {action}
    </header>
  );
}
