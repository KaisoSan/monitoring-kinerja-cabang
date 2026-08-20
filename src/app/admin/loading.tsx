import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

/**
 * Kerangka pemuatan halaman admin.
 *
 * Tanpa berkas ini, `src/app/loading.tsx` di root yang akan dipakai, dan
 * halaman admin sempat menampilkan bentuk dashboard lengkap dengan slicer
 * serta kartu grafik — bentuk yang tidak pernah ada di halaman ini.
 */
export default function AdminLoading() {
  return (
    <main
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="mx-auto min-h-screen w-full max-w-5xl px-4 py-6 sm:px-6"
    >
      <span className="sr-only">Memuat halaman admin...</span>

      {/* Header */}
      <SkeletonCard className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Skeleton className="size-12 shrink-0" rounded="rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-6 w-52" />
              <Skeleton className="h-3 w-44" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-32" rounded="rounded-2xl" />
            <Skeleton className="h-11 w-24" rounded="rounded-2xl" />
          </div>
        </div>
      </SkeletonCard>

      {/* Tab */}
      <div className="mb-5 flex flex-wrap gap-2">
        <Skeleton className="h-10 w-40" rounded="rounded-2xl" />
        <Skeleton className="h-10 w-48" rounded="rounded-2xl" />
      </div>

      {/* Kartu isi */}
      <SkeletonCard>
        <div className="mb-5 flex items-start gap-4">
          <Skeleton className="size-11 shrink-0" rounded="rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-3 w-80 max-w-full" />
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[0, 1].map((index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="h-12 w-full" rounded="rounded-2xl" />
            </div>
          ))}
        </div>

        <Skeleton className="h-44 w-full" rounded="rounded-2xl" />
      </SkeletonCard>
    </main>
  );
}
