"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, Loader2 } from "lucide-react";
import { NeuSelect } from "@/components/ui/NeuSelect";
import { formatPeriode } from "@/lib/format";

/**
 * Pemilih periode data kredit.
 *
 * Pilihannya disimpan pada query string, bukan pada state komponen, karena
 * seluruh agregat dihitung di server: mengganti bulan berarti memuat ulang
 * halaman dengan periode yang berbeda. Cara ini sekaligus membuat tautannya
 * bisa dibagikan dan tombol kembali pada peramban tetap berfungsi.
 */
export function PeriodeSelector({
  periode,
  tersedia,
}: {
  periode: string | null;
  tersedia: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  // Label yang terbaca manusia; nilai aslinya tetap tanggal ISO.
  const [labelKe] = useState(() => new Map<string, string>());
  const opsi = tersedia.map((iso) => {
    const label = formatPeriode(iso);
    labelKe.set(label, iso);
    return label;
  });

  function pilih(label: string | null) {
    const iso = label ? labelKe.get(label) : null;
    if (!iso || iso === periode) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("periode", iso);
    startTransition(() => router.push(`${pathname}?${params}`, { scroll: false }));
  }

  if (tersedia.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-56">
        <NeuSelect
          label="Periode Data Kredit"
          value={periode ? formatPeriode(periode) : null}
          options={opsi}
          onChange={pilih}
          allLabel="Pilih periode"
          icon={<CalendarRange size={15} />}
          disabled={pending}
        />
      </div>
      {pending ? (
        <Loader2 size={16} className="text-bni-teal-700 mt-5 shrink-0 animate-spin" />
      ) : null}
    </div>
  );
}
