import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardStatus } from "@/components/dashboard/DashboardStatus";
import { SeksiDpk } from "@/components/dashboard/SeksiDpk";
import { SeksiAkun } from "@/components/dashboard/SeksiAkun";
import { loadAkunData, loadDashboardData, loadDpkData } from "@/lib/data";
import { createServerSupabase } from "@/lib/supabase/server";

// Dashboard selalu menampilkan posisi terbaru, jadi tidak boleh di-cache:
// `force-dynamic` mematikan prerender statis, `revalidate = 0` mematikan
// Data Cache, dan `fetchCache` memastikan panggilan ke Supabase ikut segar.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function DashboardPage() {
  // Ketiga dataset berdiri sendiri: kegagalan salah satunya tidak boleh
  // menjatuhkan seluruh halaman, jadi masing-masing membawa statusnya sendiri.
  const [{ records, targets, periode, state, message }, dpk, akun] = await Promise.all([
    loadDashboardData(),
    loadDpkData(),
    loadAkunData(),
  ]);

  const supabase = await createServerSupabase();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };

  return (
    <main className="mx-auto min-h-screen w-full max-w-[104rem] px-4 py-6 sm:px-6 lg:px-8">
      <DashboardHeader
        periode={periode}
        totalRows={records.length}
        userEmail={data?.user?.email ?? null}
      />

      {records.length === 0 ? (
        <DashboardStatus state={state} message={message} />
      ) : (
        <DashboardShell records={records} targets={targets} />
      )}

      <section id="seksi-dpk" className="mt-5 scroll-mt-44">
        <SeksiDpk data={dpk} />
      </section>

      <section id="seksi-akun" className="mt-5 scroll-mt-44">
        <SeksiAkun data={akun} />
      </section>
      <footer className="text-ink-500 mt-8 pb-4 text-center text-xs">
        Dashboard Monitoring Kinerja Kredit · Data diperbarui melalui unggahan Excel di halaman
        Admin.
      </footer>
    </main>
  );
}
