"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Building2, Layers, Loader2, Pencil, Save, Target, TriangleAlert } from "lucide-react";
import { NeuCard, SectionHeader } from "@/components/ui/NeuCard";
import { NeuSelect } from "@/components/ui/NeuSelect";
import { NeuCurrencyInput } from "@/components/ui/NeuCurrencyInput";
import { Badge } from "@/components/ui/Badge";
import { Column, DataTable } from "@/components/ui/DataTable";
import { formatPeriode, formatRupiah, formatRupiahShort } from "@/lib/format";

type TargetRow = {
  periode: string;
  area_head: string;
  cabang: string;
  produk: string;
  target_baki_debet: number;
  target_booking_nominal: number;
};

type Pilihan = {
  cabang: string[];
  produk: string[];
  areaPerCabang: Record<string, string>;
  targets: TargetRow[];
};

const KOSONG: Pilihan = { cabang: [], produk: [], areaPerCabang: {}, targets: [] };

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Form pengaturan target langsung dari layar, sebagai alternatif mengunggah
 * berkas Excel target. Menyimpan memakai upsert pada kunci
 * `periode + cabang + produk`, sehingga menyimpan ulang kombinasi yang sama
 * memperbarui angkanya, bukan menambah baris baru.
 */
export function TargetManager({ enabled }: { enabled: boolean }) {
  const router = useRouter();

  const [periode, setPeriode] = useState(currentMonth());
  const [cabang, setCabang] = useState<string | null>(null);
  const [produk, setProduk] = useState<string | null>(null);
  const [targetBakiDebet, setTargetBakiDebet] = useState(0);
  const [targetBooking, setTargetBooking] = useState(0);

  const [pilihan, setPilihan] = useState<Pilihan>(KOSONG);
  const [memuat, setMemuat] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const muat = useCallback(
    async (bulan: string, signal?: AbortSignal) => {
      setMemuat(true);
      setError(null);
      try {
        const response = await fetch(`/api/target?periode=${bulan}-01`, {
          signal,
          cache: "no-store",
        });
        const payload = (await response.json()) as Partial<Pilihan> & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? `Server menjawab ${response.status}.`);

        setPilihan({
          cabang: payload.cabang ?? [],
          produk: payload.produk ?? [],
          areaPerCabang: payload.areaPerCabang ?? {},
          targets: payload.targets ?? [],
        });
      } catch (cause) {
        if (signal?.aborted) return;
        setPilihan(KOSONG);
        setError(cause instanceof Error ? cause.message : "Data target gagal dimuat.");
      } finally {
        if (!signal?.aborted) setMemuat(false);
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    async function jalankan() {
      await muat(periode, controller.signal);
    }
    void jalankan();
    return () => controller.abort();
  }, [periode, muat]);

  /** Area Head tidak diminta ke pengguna; nilainya mengikuti cabang terpilih. */
  const areaHead = cabang ? (pilihan.areaPerCabang[cabang] ?? "Tanpa Area Head") : "";

  /** Target yang sudah tersimpan untuk kombinasi yang sedang dipilih. */
  const tersimpan = useMemo(
    () =>
      cabang && produk
        ? pilihan.targets.find((row) => row.cabang === cabang && row.produk === produk)
        : undefined,
    [pilihan.targets, cabang, produk],
  );

  /**
   * Memilih kombinasi yang sudah punya target akan memuat angkanya, sehingga
   * tombol simpan berperan sebagai "ubah" tanpa isian terpisah.
   *
   * Pengisian dilakukan saat pilihan berubah, bukan lewat efek yang
   * menurunkan state dari props — cara itu memicu render berantai dan
   * membuat angka yang sedang diketik tertimpa.
   */
  const pilihKombinasi = useCallback(
    (nextCabang: string | null, nextProduk: string | null) => {
      setCabang(nextCabang);
      setProduk(nextProduk);

      const cocok =
        nextCabang && nextProduk
          ? pilihan.targets.find(
              (row) => row.cabang === nextCabang && row.produk === nextProduk,
            )
          : undefined;

      setTargetBakiDebet(cocok?.target_baki_debet ?? 0);
      setTargetBooking(cocok?.target_booking_nominal ?? 0);
    },
    [pilihan.targets],
  );

  const bisaSimpan =
    enabled && !!cabang && !!produk && !menyimpan && !memuat && targetBakiDebet >= 0;

  async function simpan() {
    if (!cabang || !produk) return;

    setMenyimpan(true);
    const toastId = toast.loading("Menyimpan target...");

    try {
      const response = await fetch("/api/target", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periode: `${periode}-01`,
          area_head: areaHead,
          cabang,
          produk,
          target_baki_debet: targetBakiDebet,
          target_booking_nominal: targetBooking,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Target gagal disimpan.");

      toast.success(
        `${tersimpan ? "Target diperbarui" : "Target disimpan"} untuk ${cabang} · ${produk}.`,
        { id: toastId },
      );
      await muat(periode);
      // Dashboard membaca target dari server, jadi cache router dibuang.
      router.refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Target gagal disimpan.", {
        id: toastId,
      });
    } finally {
      setMenyimpan(false);
    }
  }

  function muatKeForm(row: TargetRow) {
    setCabang(row.cabang);
    setProduk(row.produk);
    setTargetBakiDebet(row.target_baki_debet);
    setTargetBooking(row.target_booking_nominal);
  }


  return (
    <NeuCard>
      <SectionHeader
        eyebrow="Admin"
        title="Manajemen Target"
        description="Atur target cabang langsung dari layar, tanpa mengunggah berkas Excel. Menyimpan kombinasi periode, cabang, dan produk yang sama akan memperbarui angkanya."
        icon={<Target size={18} />}
        action={
          tersimpan ? (
            <Badge tone="teal">Sedang mengubah target yang sudah ada</Badge>
          ) : cabang && produk ? (
            <Badge tone="orange">Target baru</Badge>
          ) : null
        }
      />

      {error ? (
        <div className="neu-inset text-state-bad-text mb-4 flex items-start gap-3 rounded-2xl p-4 text-sm">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label
            htmlFor="target-periode"
            className="text-ink-500 mb-1.5 block text-[0.7rem] font-semibold tracking-wider uppercase"
          >
            Periode
          </label>
          <input
            id="target-periode"
            type="month"
            value={periode}
            disabled={menyimpan}
            onChange={(event) => {
              setPeriode(event.target.value || currentMonth());
              // Angka periode sebelumnya tidak boleh ikut terbawa.
              setTargetBakiDebet(0);
              setTargetBooking(0);
            }}
            className="neu-inset text-ink-900 w-full rounded-2xl px-4 py-3 text-sm font-semibold outline-none"
          />
          <p className="text-ink-500 mt-1.5 text-xs">{formatPeriode(`${periode}-01`)}</p>
        </div>

        <NeuSelect
          label="Cabang / KCP"
          value={cabang}
          options={pilihan.cabang}
          onChange={(nilai) => pilihKombinasi(nilai, produk)}
          allLabel="Pilih cabang"
          icon={<Building2 size={15} />}
          disabled={memuat || menyimpan}
        />

        <NeuSelect
          label="Produk Kredit"
          value={produk}
          options={pilihan.produk}
          onChange={(nilai) => pilihKombinasi(cabang, nilai)}
          allLabel="Pilih produk"
          icon={<Layers size={15} />}
          disabled={memuat || menyimpan}
        />
      </div>

      {cabang ? (
        <p className="text-ink-500 mt-3 text-xs">
          Area Head: <strong className="text-bni-teal-700">{areaHead}</strong> · diambil otomatis
          dari data kredit cabang tersebut.
        </p>
      ) : null}

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NeuCurrencyInput
          label="Target Outstanding"
          value={targetBakiDebet}
          onChange={setTargetBakiDebet}
          disabled={menyimpan}
          hint="target baki debet akhir periode"
        />
        <NeuCurrencyInput
          label="Target Booking"
          value={targetBooking}
          onChange={setTargetBooking}
          disabled={menyimpan}
          hint="target booking baru pada periode ini"
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={simpan}
          disabled={!bisaSimpan}
          className="neu-press text-bni-teal-700 flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {menyimpan ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {menyimpan ? "Menyimpan..." : "Simpan Target"}
        </button>

        {memuat ? (
          <span className="text-ink-500 flex items-center gap-2 text-xs">
            <Loader2 size={13} className="animate-spin" />
            Memuat daftar cabang...
          </span>
        ) : null}

        {!cabang || !produk ? (
          <span className="text-ink-500 text-xs">Pilih cabang dan produk terlebih dahulu.</span>
        ) : null}

        {!enabled ? (
          <span className="text-state-warn-text text-xs font-semibold">
            Penyimpanan dinonaktifkan: SUPABASE_SERVICE_ROLE_KEY belum diatur di server.
          </span>
        ) : null}
      </div>

      <div className="mt-6">
        <p className="text-ink-500 mb-2 text-[0.7rem] font-bold tracking-wider uppercase">
          Target Tersimpan · {formatPeriode(`${periode}-01`)}
        </p>
        <TabelTarget rows={pilihan.targets} onEdit={muatKeForm} />
      </div>
    </NeuCard>
  );
}

function TabelTarget({
  rows,
  onEdit,
}: {
  rows: TargetRow[];
  onEdit: (row: TargetRow) => void;
}) {
  const columns: Column<TargetRow>[] = [
    {
      key: "cabang",
      header: "Cabang / KCP",
      render: (row) => (
        <div className="min-w-0">
          <p className="text-ink-900 truncate font-semibold">{row.cabang}</p>
          <p className="text-ink-500 truncate text-xs">{row.area_head}</p>
        </div>
      ),
    },
    {
      key: "produk",
      header: "Produk",
      render: (row) => <Badge tone="neutral">{row.produk}</Badge>,
    },
    {
      key: "outstanding",
      header: "Target Outstanding",
      align: "right",
      render: (row) => (
        <span title={formatRupiah(row.target_baki_debet)}>
          {formatRupiahShort(row.target_baki_debet)}
        </span>
      ),
    },
    {
      key: "booking",
      header: "Target Booking",
      align: "right",
      render: (row) => (
        <span title={formatRupiah(row.target_booking_nominal)}>
          {formatRupiahShort(row.target_booking_nominal)}
        </span>
      ),
    },
    {
      key: "aksi",
      header: "",
      align: "right",
      render: (row) => (
        <button
          type="button"
          onClick={() => onEdit(row)}
          className="neu-press text-ink-700 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold"
        >
          <Pencil size={12} />
          Ubah
        </button>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(row) => `${row.cabang}-${row.produk}`}
      maxHeight="22rem"
      emptyMessage="Belum ada target tersimpan untuk periode ini."
    />
  );
}
