import Link from "next/link";
import { DatabaseZap, Inbox, ShieldAlert, TriangleAlert } from "lucide-react";
import { NeuCard } from "@/components/ui/NeuCard";
import type { DashboardState } from "@/lib/data";

const PRESET: Record<
  Exclude<DashboardState, "ok">,
  { icon: React.ReactNode; title: string }
> = {
  "belum-dikonfigurasi": {
    icon: <DatabaseZap size={22} />,
    title: "Supabase belum dikonfigurasi",
  },
  "tanpa-sesi": {
    icon: <ShieldAlert size={22} />,
    title: "Sesi tidak ditemukan",
  },
  galat: {
    icon: <TriangleAlert size={22} />,
    title: "Data gagal dimuat",
  },
};

/**
 * Menggantikan dataset contoh yang dulu tampil saat pembacaan gagal.
 * Dashboard kini menyatakan kondisi sebenarnya, bukan menampilkan angka yang
 * bisa dikira data asli.
 */
export function DashboardStatus({
  state,
  message,
}: {
  state: DashboardState;
  message: string | null;
}) {
  // Keadaan `ok` dengan tabel kosong: belum ada data yang diunggah.
  if (state === "ok") {
    return (
      <NeuCard className="text-center">
        <span className="neu-sm text-bni-teal-700 mx-auto mb-4 grid size-14 place-items-center rounded-2xl">
          <Inbox size={22} />
        </span>
        <h2 className="text-ink-900 text-lg font-bold">Belum ada data kredit</h2>
        <p className="text-ink-500 mx-auto mt-2 max-w-md text-sm">
          Tabel <code className="text-bni-teal-700">kredit_records</code> masih kosong.
          Unggah file Excel lewat halaman admin, lalu dashboard akan langsung menampilkan
          datanya.
        </p>
        <Link
          href="/admin"
          className="neu-press text-bni-teal-700 mt-5 inline-flex rounded-2xl px-6 py-3 text-sm font-bold"
        >
          Buka Halaman Admin
        </Link>
      </NeuCard>
    );
  }

  const preset = PRESET[state];

  return (
    <NeuCard className="text-center">
      <span className="neu-sm text-state-bad-text mx-auto mb-4 grid size-14 place-items-center rounded-2xl">
        {preset.icon}
      </span>
      <h2 className="text-ink-900 text-lg font-bold">{preset.title}</h2>
      {message ? (
        <p className="text-ink-500 mx-auto mt-2 max-w-xl text-sm">{message}</p>
      ) : null}

      {state === "tanpa-sesi" ? (
        <Link
          href="/admin/login"
          className="neu-press text-bni-teal-700 mt-5 inline-flex rounded-2xl px-6 py-3 text-sm font-bold"
        >
          Masuk Kembali
        </Link>
      ) : null}
    </NeuCard>
  );
}

/**
 * Versi ringkas untuk dipakai di dalam kartu seksi, ketika hanya satu
 * dataset yang bermasalah sementara sisa dashboard tetap tampil.
 */
export function DashboardStatusInline({
  state,
  message,
  kosongJudul,
  kosongPesan,
}: {
  state: DashboardState;
  message: string | null;
  kosongJudul: string;
  kosongPesan: string;
}) {
  const kosong = state === "ok";

  return (
    <div className="neu-inset rounded-2xl px-5 py-8 text-center">
      <span
        className={`neu-sm mx-auto mb-3 grid size-11 place-items-center rounded-2xl ${
          kosong ? "text-bni-teal-700" : "text-state-bad-text"
        }`}
      >
        {kosong ? <Inbox size={18} /> : PRESET[state].icon}
      </span>
      <p className="text-ink-900 text-sm font-bold">
        {kosong ? kosongJudul : PRESET[state].title}
      </p>
      <p className="text-ink-500 mx-auto mt-1.5 max-w-md text-sm">
        {kosong ? kosongPesan : message}
      </p>
    </div>
  );
}
