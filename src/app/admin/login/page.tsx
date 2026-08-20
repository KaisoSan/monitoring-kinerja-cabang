import { ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/admin/LoginForm";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { SetupNotice } from "@/components/admin/SetupNotice";
import { safeNextPath } from "@/lib/navigation";

export const metadata = { title: "Login · Monitoring Kinerja Kredit" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = safeNextPath(next);

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="neu rounded-3xl p-7">
          <div className="mb-6 flex items-center gap-4">
            <span className="neu-sm text-bni-teal-700 grid size-12 place-items-center rounded-2xl">
              <ShieldCheck size={22} />
            </span>
            <div>
              <p className="text-bni-orange-800 text-[0.7rem] font-bold tracking-[0.16em] uppercase">
                Area Terbatas
              </p>
              <h1 className="text-ink-900 text-lg font-bold">Login</h1>
            </div>
          </div>

          {isSupabaseConfigured ? (
            <>
              <p className="text-ink-500 mb-5 text-sm">
                Data kredit hanya dapat diakses setelah login. Gunakan akun Supabase
                yang sudah didaftarkan pengelola aplikasi.
              </p>
              <LoginForm nextPath={target} />
            </>
          ) : (
            <SetupNotice />
          )}
        </div>
      </div>
    </main>
  );
}
