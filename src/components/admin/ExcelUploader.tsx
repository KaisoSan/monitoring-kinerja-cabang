"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  CheckCircle2,
  CloudUpload,
  FileSpreadsheet,
  Loader2,
  RefreshCcw,
  TriangleAlert,
  X,
} from "lucide-react";
import { NeuCard, SectionHeader } from "@/components/ui/NeuCard";
import { Badge, ProgressBar } from "@/components/ui/Badge";
import { type ParseIssue } from "@/lib/excel";
import { chunkSizeFor, parseUploadFile, type ParsedUpload } from "@/lib/datasets";
import { formatNumber } from "@/lib/format";
import {
  UPLOAD_DATASETS,
  UPLOAD_DATASET_HINTS,
  UPLOAD_DATASET_LABELS,
  type UploadDataset,
} from "@/lib/types";

const ACCEPTED = [".xlsx", ".xls", ".xlsm", ".csv"];
/** Berkas ekstrak akun bisa jauh lebih besar daripada SL 18. */
const MAX_FILE_BYTES = 60 * 1024 * 1024;

type Parsed = ParsedUpload & { fileName: string };

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function ExcelUploader({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [dataset, setDataset] = useState<UploadDataset>("kredit_records");
  const [periode, setPeriode] = useState(currentMonth());
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  // Disimpan agar file yang sama bisa di-parse ulang ketika dataset,
  // sheet, atau periode default berubah.
  const [lastFile, setLastFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const defaultPeriode = `${periode}-01`;

  const parseFile = useCallback(
    async (file: File, sheetName?: string) => {
      if (file.size > MAX_FILE_BYTES) {
        toast.error("Ukuran file melebihi 25 MB.");
        return;
      }
      const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (!ACCEPTED.includes(extension)) {
        toast.error(`Format tidak didukung. Gunakan ${ACCEPTED.join(", ")}.`);
        return;
      }

      setParsing(true);
      const toastId = toast.loading(
        file.size > 5 * 1024 * 1024
          ? "Membaca file Excel besar, mohon tunggu..."
          : "Membaca file Excel...",
      );

      try {
        const result = await parseUploadFile(file, dataset, defaultPeriode, sheetName);
        setParsed({ ...result, fileName: file.name });

        if (result.missingColumns.length > 0) {
          toast.error(`Kolom wajib belum terbaca: ${result.missingColumns.join(", ")}`, {
            id: toastId,
          });
        } else if (result.rows.length === 0) {
          toast.error("Tidak ada baris yang bisa dibaca dari berkas ini.", { id: toastId });
        } else {
          toast.success(`${formatNumber(result.rows.length)} baris siap diunggah.`, {
            id: toastId,
          });
        }
      } catch (error) {
        setParsed(null);
        toast.error(
          error instanceof Error ? error.message : "File gagal dibaca.",
          { id: toastId },
        );
      } finally {
        setParsing(false);
      }
    },
    [dataset, defaultPeriode],
  );

  const onFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      setLastFile(file);
      void parseFile(file);
    },
    [parseFile],
  );

  async function onUpload() {
    if (!parsed || parsed.rows.length === 0) return;

    setUploading(true);
    setProgress(0);
    const toastId = toast.loading("Mengunggah ke Supabase...");

    const chunkSize = chunkSizeFor(dataset);
    const chunks: unknown[][] = [];
    for (let i = 0; i < parsed.rows.length; i += chunkSize) {
      chunks.push(parsed.rows.slice(i, i + chunkSize));
    }

    let processed = 0;
    let sanitized = 0;
    try {
      for (let index = 0; index < chunks.length; index += 1) {
        const response = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dataset,
            fileName: parsed.fileName,
            rows: chunks[index],
          }),
        });

        const payload = (await response.json()) as {
          processed?: number;
          sanitized?: number;
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error ?? "Unggahan ditolak server.");

        processed += payload.processed ?? chunks[index].length;
        sanitized += payload.sanitized ?? 0;
        setProgress(((index + 1) / chunks.length) * 100);
        toast.loading(
          `Mengunggah ${formatNumber(processed)} dari ${formatNumber(parsed.rows.length)} baris...`,
          { id: toastId },
        );
      }

      // Pembersihan karakter tidak boleh terjadi diam-diam: admin perlu tahu
      // ada isi sel yang berubah sebelum tersimpan.
      toast.success(
        sanitized > 0
          ? `Berhasil menyimpan ${formatNumber(processed)} baris. ${formatNumber(
              sanitized,
            )} karakter tidak valid dibersihkan.`
          : `Berhasil menyimpan ${formatNumber(processed)} baris.`,
        { id: toastId, duration: sanitized > 0 ? 8000 : 4000 },
      );
      setParsed(null);
      setLastFile(null);
      if (inputRef.current) inputRef.current.value = "";
      // Buang cache router agar dashboard dan riwayat unggahan langsung
      // memuat ulang data yang baru masuk.
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Terjadi kesalahan saat mengunggah.",
        { id: toastId },
      );
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  const previewHeaders = useMemo(
    () => parsed?.headerMap.slice(0, 24) ?? [],
    [parsed],
  );

  const busy = parsing || uploading;
  const canUpload =
    enabled && !!parsed && parsed.rows.length > 0 && parsed.missingColumns.length === 0 && !busy;

  return (
    <NeuCard>
      <SectionHeader
        eyebrow="Admin"
        title="Unggah Data Excel"
        description="Tarik file laporan mentah ke area di bawah. Nama kolom otomatis dibersihkan menjadi snake_case, lalu dikirim ke Supabase secara batch."
        icon={<CloudUpload size={18} />}
      />

      {/* --- Pengaturan tujuan --- */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="dataset"
            className="text-ink-500 mb-1.5 block text-[0.7rem] font-semibold tracking-wider uppercase"
          >
            Tabel Tujuan
          </label>
          <select
            id="dataset"
            value={dataset}
            disabled={busy}
            onChange={(event) => {
              const next = event.target.value as UploadDataset;
              setDataset(next);
              setParsed(null);
            }}
            className="neu-inset text-ink-900 w-full rounded-2xl px-4 py-3 text-sm font-semibold outline-none"
          >
            {UPLOAD_DATASETS.map((option) => (
              <option key={option} value={option}>
                {UPLOAD_DATASET_LABELS[option]}
              </option>
            ))}
          </select>
          <p className="text-ink-500 mt-1.5 text-xs">{UPLOAD_DATASET_HINTS[dataset]}</p>
        </div>

        <div>
          <label
            htmlFor="periode"
            className="text-ink-500 mb-1.5 block text-[0.7rem] font-semibold tracking-wider uppercase"
          >
            Periode Default
          </label>
          <input
            id="periode"
            type="month"
            value={periode}
            disabled={busy}
            onChange={(event) => setPeriode(event.target.value)}
            className="neu-inset text-ink-900 w-full rounded-2xl px-4 py-3 text-sm font-semibold outline-none"
          />
          <p className="text-ink-500 mt-1.5 text-xs">
            Dipakai hanya bila file tidak punya kolom periode.
          </p>
        </div>
      </div>

      {/* --- Dropzone --- */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!busy) onFiles(event.dataTransfer.files);
        }}
        className={`neu-inset rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
          dragging ? "border-bni-teal-600 bg-bni-teal-100/40" : "border-ink-300/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          className="sr-only"
          onChange={(event) => {
            onFiles(event.target.files);
            // Dikosongkan agar memilih file yang sama dua kali tetap
            // memicu `change` (nilai input tidak berubah kalau dibiarkan).
            event.target.value = "";
          }}
          disabled={busy}
        />

        <span className="neu-sm text-bni-teal-700 mx-auto mb-4 grid size-14 place-items-center rounded-2xl">
          {parsing ? <Loader2 size={24} className="animate-spin" /> : <FileSpreadsheet size={24} />}
        </span>

        <p className="text-ink-900 text-sm font-bold">
          {parsing ? "Membaca file..." : "Tarik & lepas file Excel di sini"}
        </p>
        <p className="text-ink-500 mt-1 text-xs">
          Format {ACCEPTED.join(" / ")} · maksimal 25 MB
        </p>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="neu-press text-bni-teal-700 mt-4 rounded-2xl px-5 py-2.5 text-xs font-bold disabled:opacity-50"
        >
          Pilih File
        </button>
      </div>

      {/* --- Ringkasan hasil parsing --- */}
      {parsed ? (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="teal">
              <FileSpreadsheet size={12} />
              {parsed.fileName}
            </Badge>
            <Badge tone="neutral">Sheet: {parsed.sheetLabel}</Badge>
            <Badge tone={parsed.rows.length > 0 ? "good" : "bad"}>
              {formatNumber(parsed.rows.length)} baris valid
            </Badge>
            {parsed.issues.length > 0 ? (
              <Badge tone="warn">{formatNumber(parsed.issues.length)} catatan</Badge>
            ) : null}

            <button
              type="button"
              onClick={() => {
                setParsed(null);
                setLastFile(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              disabled={busy}
              className="neu-press text-ink-700 ml-auto flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-xs font-bold disabled:opacity-50"
            >
              <X size={12} />
              Bersihkan
            </button>
          </div>

          {!parsed.multiSheet && parsed.sheetNames.length > 1 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-ink-500 text-xs font-semibold">Ganti sheet:</span>
              {parsed.sheetNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  disabled={busy || !lastFile}
                  onClick={() => lastFile && void parseFile(lastFile, name)}
                  className={`neu-press rounded-xl px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
                    name === parsed.sheetLabel ? "text-bni-teal-700" : "text-ink-700"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          ) : null}

          {parsed.missingColumns.length > 0 ? (
            <div className="neu-inset text-state-bad-text flex items-start gap-3 rounded-2xl p-4 text-sm">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              <p>
                Kolom wajib belum terdeteksi:{" "}
                <strong>{parsed.missingColumns.join(", ")}</strong>. Periksa nama header di file
                atau tambahkan aliasnya pada <code>HEADER_ALIASES</code> di{" "}
                <code>src/lib/excel.ts</code>.
              </p>
            </div>
          ) : null}

          {parsed.notes.length > 0 ? (
            <div className="neu-inset text-ink-700 rounded-2xl p-4 text-sm">
              <p className="text-ink-500 mb-2 text-[0.7rem] font-bold tracking-wider uppercase">
                Hasil Pembacaan
              </p>
              <ul className="list-inside list-disc space-y-1">
                {parsed.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <HeaderMapPreview entries={previewHeaders} total={parsed.headerMap.length} />

          {parsed.issues.length > 0 ? <IssueList issues={parsed.issues} /> : null}

          {uploading ? (
            <div>
              <ProgressBar value={progress} tone="teal" />
              <p className="text-ink-500 mt-2 text-xs">
                Mengirim batch {Math.round(progress)}% selesai...
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onUpload}
              disabled={!canUpload}
              className="neu-press text-bni-teal-700 flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle2 size={16} />
              )}
              {uploading ? "Mengunggah..." : "Kirim ke Supabase"}
            </button>

            <button
              type="button"
              disabled={busy || !lastFile}
              onClick={() => lastFile && void parseFile(lastFile, parsed.multiSheet ? undefined : parsed.sheetLabel)}
              className="neu-press text-ink-700 flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold disabled:opacity-50"
            >
              <RefreshCcw size={15} />
              Baca Ulang
            </button>
          </div>

          {!enabled ? (
            <p className="text-state-warn-text text-xs font-semibold">
              Unggahan dinonaktifkan: SUPABASE_SERVICE_ROLE_KEY belum diatur di server.
            </p>
          ) : null}
        </div>
      ) : null}
    </NeuCard>
  );
}

function HeaderMapPreview({
  entries,
  total,
}: {
  entries: { original: string; normalized: string }[];
  total: number;
}) {
  return (
    <div>
      <p className="text-ink-500 mb-2 text-[0.7rem] font-bold tracking-wider uppercase">
        Pemetaan Kolom ({entries.length} dari {total})
      </p>
      <div className="neu-inset neu-scroll max-h-52 overflow-auto rounded-2xl p-3">
        <ul className="flex flex-wrap gap-2">
          {entries.map((entry) => (
            <li
              key={`${entry.original}-${entry.normalized}`}
              className="neu-sm text-ink-700 rounded-xl px-3 py-1.5 text-xs"
            >
              <span className="text-ink-500">{entry.original}</span>
              <span className="text-bni-orange-800 mx-1.5">→</span>
              <code className="text-ink-900 font-semibold">{entry.normalized}</code>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function IssueList({ issues }: { issues: ParseIssue[] }) {
  return (
    <div>
      <p className="text-ink-500 mb-2 text-[0.7rem] font-bold tracking-wider uppercase">
        Catatan Pemeriksaan
      </p>
      <div className="neu-inset neu-scroll max-h-40 overflow-auto rounded-2xl p-3">
        <ul className="text-ink-700 space-y-1.5 text-xs">
          {issues.slice(0, 50).map((issue) => (
            <li key={`${issue.row}-${issue.message}`}>
              <strong className="text-state-warn-text">Baris {issue.row}:</strong> {issue.message}
            </li>
          ))}
          {issues.length > 50 ? (
            <li className="text-ink-500">
              ...dan {formatNumber(issues.length - 50)} baris lainnya.
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
