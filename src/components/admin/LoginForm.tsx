"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { KeyRound, Loader2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/navigation";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const supabase = createClient();
    if (!supabase) {
      setError("Klien Supabase belum tersedia. Periksa konfigurasi environment.");
      return;
    }

    setPending(true);
    const toastId = toast.loading("Memverifikasi kredensial...");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setPending(false);
      toast.error("Login gagal.", { id: toastId });
      setError(
        signInError.message === "Invalid login credentials"
          ? "Email atau password salah."
          : signInError.message,
      );
      return;
    }

    toast.success("Login berhasil.", { id: toastId });
    // `refresh` memastikan proxy membaca cookie sesi yang baru dibuat.
    router.replace(safeNextPath(nextPath));
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="text-ink-500 mb-1.5 block text-[0.7rem] font-semibold tracking-wider uppercase"
        >
          Email
        </label>
        <div className="neu-inset flex items-center gap-2 rounded-2xl px-4 py-3">
          <Mail size={16} className="text-ink-500 shrink-0" />
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@bank.co.id"
            className="text-ink-900 placeholder:text-ink-300 w-full bg-transparent text-sm outline-none"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="password"
          className="text-ink-500 mb-1.5 block text-[0.7rem] font-semibold tracking-wider uppercase"
        >
          Password
        </label>
        <div className="neu-inset flex items-center gap-2 rounded-2xl px-4 py-3">
          <KeyRound size={16} className="text-ink-500 shrink-0" />
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            className="text-ink-900 placeholder:text-ink-300 w-full bg-transparent text-sm outline-none"
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-state-bad-text text-sm font-semibold">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="neu-press text-bni-teal-700 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : null}
        {pending ? "Memproses..." : "Masuk"}
      </button>
    </form>
  );
}
