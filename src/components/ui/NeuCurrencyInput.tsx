"use client";

import { useId } from "react";
import { formatRupiahShort } from "@/lib/format";

/** Menyisipkan pemisah ribuan gaya Indonesia pada deretan angka. */
function withThousandSeparator(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Menyaring apa pun yang diketik menjadi angka bulat non-negatif. */
export function parseNominal(input: string): number {
  const digits = input.replace(/\D/g, "");
  if (!digits) return 0;
  const parsed = Number.parseInt(digits, 10);
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

/**
 * Isian nominal rupiah.
 *
 * Angka target berkisar miliaran, dan deretan angka tanpa pemisah nyaris
 * mustahil diperiksa ulang dengan mata. Isian ini memberi pemisah ribuan
 * sambil mengetik dan menampilkan bentuk ringkasnya di bawah, sehingga
 * kelebihan atau kekurangan satu nol langsung terlihat.
 */
export function NeuCurrencyInput({
  label,
  value,
  onChange,
  disabled = false,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const id = useId();

  return (
    <div>
      <label
        htmlFor={id}
        className="text-ink-500 mb-1.5 block text-[0.7rem] font-semibold tracking-wider uppercase"
      >
        {label}
      </label>

      <div className="neu-inset flex items-center gap-2 rounded-2xl px-4 py-3">
        <span className="text-ink-500 shrink-0 text-sm font-semibold">Rp</span>
        <input
          id={id}
          // `inputMode` memunculkan papan tik angka di perangkat sentuh,
          // sementara tipe teks tetap dipakai agar pemisah ribuan bisa tampil.
          type="text"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          value={withThousandSeparator(String(value || 0))}
          onChange={(event) => onChange(parseNominal(event.target.value))}
          onFocus={(event) => event.target.select()}
          className="text-ink-900 w-full bg-transparent text-right text-sm font-bold tabular-nums outline-none disabled:opacity-60"
        />
      </div>

      <p className="text-ink-500 mt-1.5 text-xs">
        {value > 0 ? (
          <span className="text-bni-teal-700 font-semibold">{formatRupiahShort(value)}</span>
        ) : (
          "Belum diisi"
        )}
        {hint ? ` · ${hint}` : ""}
      </p>
    </div>
  );
}
