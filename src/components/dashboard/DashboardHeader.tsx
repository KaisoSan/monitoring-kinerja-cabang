import Link from "next/link";
import { LayoutDashboard, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatPeriode } from "@/lib/format";
import type { DashboardSource } from "@/lib/data";

export function DashboardHeader({
  periode,
  source,
  totalRows,
}: {
  periode: string | null;
  source: DashboardSource;
  totalRows: number;
}) {
  return (
    <header className="neu mb-5 rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="neu-sm text-bni-teal-700 grid size-12 shrink-0 place-items-center rounded-2xl">
            <LayoutDashboard size={22} />
          </span>
          <div>
            <p className="text-bni-orange-800 text-[0.7rem] font-bold tracking-[0.18em] uppercase">
              Monitoring Kinerja Kredit
            </p>
            <h1 className="text-ink-900 text-xl font-bold sm:text-2xl">
              Dashboard Eksekutif Cabang
            </h1>
            <p className="text-ink-500 mt-1 text-sm">
              Periode {formatPeriode(periode)} · {totalRows.toLocaleString("id-ID")} data kredit
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge tone={source === "supabase" ? "teal" : "orange"}>
            {source === "supabase" ? "Data Supabase" : "Data Contoh"}
          </Badge>
          <Link
            href="/admin"
            className="neu-press text-ink-700 flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold"
          >
            <Settings2 size={15} />
            Admin
          </Link>
        </div>
      </div>
    </header>
  );
}
