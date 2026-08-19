import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/admin/LoginForm";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { SetupNotice } from "@/components/admin/SetupNotice";

export const metadata = { title: "Login Admin · Monitoring Kinerja Kredit" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="neu-press text-ink-700 mb-5 inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold"
        >
          <ArrowLeft size={14} />
          Kembali ke Dashboard
        </Link>

        <div className="neu rounded-3xl p-7">
          <div className="mb-6 flex items-center gap-4">
            <span className="neu-sm text-bni-teal-700 grid size-12 place-items-center rounded-2xl">
              <ShieldCheck size={22} />
            </span>
            <div>
              <p className="text-bni-orange-800 text-[0.7rem] font-bold tracking-[0.16em] uppercase">
                Area Terbatas
              </p>
              <h1 className="text-ink-900 text-lg font-bold">Login Admin</h1>
            </div>
          </div>

          {isSupabaseConfigured ? (
            <LoginForm nextPath={next ?? "/admin"} />
          ) : (
            <SetupNotice />
          )}
        </div>
      </div>
    </main>
  );
}
