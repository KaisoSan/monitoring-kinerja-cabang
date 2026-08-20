/**
 * Balok abu-abu untuk kerangka pemuatan.
 *
 * Memakai permukaan cekung `neu-inset-sm` supaya bentuknya terbaca sebagai
 * "tempat yang belum terisi", bukan kartu kosong yang seolah sudah selesai
 * dimuat.
 */
export function Skeleton({
  className = "",
  rounded = "rounded-xl",
  style,
}: {
  className?: string;
  rounded?: string;
  /** Untuk ukuran yang bervariasi, mis. tinggi batang grafik. */
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      style={style}
      className={`neu-inset-sm animate-neu-pulse ${rounded} ${className}`}
    />
  );
}

/** Kartu kerangka dengan bayangan menonjol, meniru `NeuCard`. */
export function SkeletonCard({
  className = "",
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section aria-hidden className={`neu rounded-3xl p-5 sm:p-6 ${className}`}>
      {children}
    </section>
  );
}
