import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

/**
 * Kerangka pemuatan dashboard.
 *
 * Next.js menampilkan berkas ini seketika saat berpindah halaman, sementara
 * `loadDashboardData` masih menarik datanya di server. Tanpa berkas ini,
 * layar tampak membeku di halaman lama sampai seluruh data selesai dibaca.
 *
 * Bentuknya sengaja meniru tata letak dashboard yang sebenarnya — header,
 * slicer, empat kartu ringkasan, lalu kartu grafik — supaya pergantiannya
 * terasa seperti isi yang terisi, bukan layar yang berganti total.
 *
 * Berkas ini berlaku untuk seluruh rute di bawah root layout. Halaman admin
 * punya kerangkanya sendiri di `src/app/admin/loading.tsx` agar tidak
 * terlanjur menampilkan bentuk dashboard.
 */
export default function DashboardLoading() {
  return (
    <main
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="mx-auto min-h-screen w-full max-w-[104rem] px-4 py-6 sm:px-6 lg:px-8"
    >
      <span className="sr-only">Memuat data dashboard...</span>

      {/* Header */}
      <SkeletonCard className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Skeleton className="size-12 shrink-0" rounded="rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-44" />
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-3 w-52" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-11 w-56" rounded="rounded-2xl" />
            <Skeleton className="h-11 w-24" rounded="rounded-2xl" />
          </div>
        </div>
      </SkeletonCard>

      {/* Slicer global */}
      <SkeletonCard className="mb-5">
        <div className="mb-4 flex items-center gap-3">
          <Skeleton className="size-10 shrink-0" rounded="rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-44" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="h-11 w-full" rounded="rounded-2xl" />
            </div>
          ))}
        </div>
      </SkeletonCard>

      {/* Navigasi antar pilar */}
      <div className="mb-5 flex flex-wrap gap-2">
        {["w-24", "w-20", "w-28", "w-32", "w-24", "w-28"].map((width, index) => (
          <Skeleton key={index} className={`h-9 ${width}`} rounded="rounded-2xl" />
        ))}
      </div>

      {/* Empat kartu ringkasan */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <SkeletonCard key={index}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <Skeleton className="h-2.5 w-28" />
              <Skeleton className="size-9 shrink-0" rounded="rounded-xl" />
            </div>
            <Skeleton className="h-7 w-36" />
            <Skeleton className="mt-2 h-3 w-24" />
          </SkeletonCard>
        ))}
      </div>

      {/* Kartu grafik */}
      <SkeletonCard>
        <div className="mb-5 flex items-start gap-4">
          <Skeleton className="size-11 shrink-0" rounded="rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-2.5 w-32" />
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-3 w-80 max-w-full" />
          </div>
        </div>

        {/* Batang grafik dengan tinggi berbeda-beda agar terbaca sebagai
            grafik, bukan sekadar deretan kotak seragam. */}
        <div className="neu-inset flex h-72 items-end gap-2 rounded-2xl p-4 sm:gap-3">
          {[62, 84, 48, 71, 39, 90, 55, 67, 44, 78, 51, 60].map((height, index) => (
            <Skeleton
              key={index}
              className="flex-1"
              rounded="rounded-t-md"
              // Tinggi ditulis sebagai gaya inline karena nilainya bervariasi
              // dan tidak berasal dari daftar kelas Tailwind yang tetap.
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      </SkeletonCard>
    </main>
  );
}
