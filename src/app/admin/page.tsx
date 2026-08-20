import Link from "next/link";
import { ArrowLeft, Database, ShieldCheck, ShieldX } from "lucide-react";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { SetupNotice } from "@/components/admin/SetupNotice";
import { NeuCard, SectionHeader } from "@/components/ui/NeuCard";
import { Badge } from "@/components/ui/Badge";
import { createServerSupabase } from "@/lib/supabase/server";
import { isAdminEmail, isSupabaseConfigured } from "@/lib/supabase/config";
import { formatNumber } from "@/lib/format";

export const metadata = { title: "Admin · Monitoring Kinerja Kredit" };
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type UploadLog = {
  id: string;
  dataset: string;
  file_name: string;
  row_count: number;
  uploaded_by: string | null;
  created_at: string;
};

export default async function AdminPage() {
  const supabase = await createServerSupabase();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  const user = data?.user ?? null;

  // Proxy sudah memastikan ada sesi; di sini yang dicek adalah hak admin.
  // User biasa boleh membuka dashboard, tetapi tidak boleh mengunggah data.
  const isAdmin = !isSupabaseConfigured || isAdminEmail(user?.email);

  // Ketersediaan service role hanya dicek keberadaannya; nilainya tidak
  // pernah dikirim ke browser.
  const uploadEnabled = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  const logsQuery = isAdmin
    ? await supabase
        ?.from("upload_logs")
        .select("id, dataset, file_name, row_count, uploaded_by, created_at")
        .order("created_at", { ascending: false })
        .limit(8)
    : null;

  const logs = (logsQuery?.data ?? []) as unknown as UploadLog[];

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-6 sm:px-6">
      <header className="neu mb-5 rounded-3xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="neu-sm text-bni-teal-700 grid size-12 place-items-center rounded-2xl">
              <ShieldCheck size={22} />
            </span>
            <div>
              <p className="text-bni-orange-800 text-[0.7rem] font-bold tracking-[0.18em] uppercase">
                Halaman Admin
              </p>
              <h1 className="text-ink-900 text-xl font-bold">Pusat Data Kredit</h1>
              {user?.email ? (
                <p className="text-ink-500 mt-1 text-sm">Masuk sebagai {user.email}</p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="neu-press text-ink-700 flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold"
            >
              <ArrowLeft size={15} />
              Dashboard
            </Link>
            {user ? <LogoutButton /> : null}
          </div>
        </div>
      </header>

      {isSupabaseConfigured && !isAdmin ? (
        <NeuCard>
          <SectionHeader
            eyebrow="Akses Ditolak"
            title="Akun Anda tidak memiliki hak admin"
            icon={<ShieldX size={18} />}
          />
          <div className="neu-inset text-ink-700 rounded-2xl p-5 text-sm">
            <p>
              Akun <strong>{user?.email}</strong> boleh membuka dashboard, tetapi tidak
              terdaftar sebagai admin sehingga tidak bisa mengunggah data.
            </p>
            <p className="mt-3">
              Minta pengelola aplikasi menambahkan email tersebut ke environment{" "}
              <code className="text-bni-teal-700">ADMIN_EMAILS</code>, lalu masuk kembali.
            </p>
          </div>
        </NeuCard>
      ) : isSupabaseConfigured ? (
        <AdminTabs
          uploadEnabled={uploadEnabled}
          riwayat={
            <NeuCard>
            <SectionHeader
              eyebrow="Riwayat"
              title="Unggahan Terakhir"
              description="Delapan aktivitas unggah terbaru beserta jumlah baris yang tersimpan."
              icon={<Database size={18} />}
            />

            {logs.length === 0 ? (
              <div className="neu-inset text-ink-500 rounded-2xl px-4 py-8 text-center text-sm">
                Belum ada riwayat unggahan.
              </div>
            ) : (
              <ul className="space-y-2">
                {logs.map((log) => (
                  <li
                    key={log.id}
                    className="neu-inset flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-ink-900 truncate text-sm font-semibold">
                        {log.file_name}
                      </p>
                      <p className="text-ink-500 text-xs">
                        {new Date(log.created_at).toLocaleString("id-ID")}
                        {log.uploaded_by ? ` · ${log.uploaded_by}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone="neutral">{log.dataset}</Badge>
                      <Badge tone="teal">{formatNumber(log.row_count)} baris</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            </NeuCard>
          }
        />
      ) : (
        <NeuCard>
          <SectionHeader
            eyebrow="Konfigurasi"
            title="Langkah Setup Supabase"
            icon={<Database size={18} />}
          />
          <SetupNotice />
        </NeuCard>
      )}
    </main>
  );
}
