import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { loadDashboardData } from "@/lib/data";

// Dashboard selalu menampilkan posisi terbaru, jadi jangan di-cache statis.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { records, targets, source, periode, notice } = await loadDashboardData();

  return (
    <main className="mx-auto min-h-screen w-full max-w-[104rem] px-4 py-6 sm:px-6 lg:px-8">
      <DashboardHeader periode={periode} source={source} totalRows={records.length} />
      <DashboardShell records={records} targets={targets} notice={notice} />
      <footer className="text-ink-500 mt-8 pb-4 text-center text-xs">
        Dashboard Monitoring Kinerja Kredit · Data diperbarui melalui unggahan Excel di halaman
        Admin.
      </footer>
    </main>
  );
}
