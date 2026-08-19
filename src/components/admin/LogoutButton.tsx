"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    const supabase = createClient();
    if (!supabase) return;

    setPending(true);
    await supabase.auth.signOut();
    toast.success("Anda telah keluar.");
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="neu-press text-ink-700 flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold disabled:opacity-50"
    >
      <LogOut size={15} />
      {pending ? "Keluar..." : "Keluar"}
    </button>
  );
}
