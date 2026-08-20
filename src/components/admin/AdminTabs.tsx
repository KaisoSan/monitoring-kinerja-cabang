"use client";

import { useState, type ReactNode } from "react";
import { CloudUpload, Target } from "lucide-react";
import { ExcelUploader } from "./ExcelUploader";
import { TargetManager } from "./TargetManager";

const TABS = [
  { id: "unggah", label: "Unggah Berkas", icon: <CloudUpload size={15} /> },
  { id: "target", label: "Manajemen Target", icon: <Target size={15} /> },
] as const;

type TabId = (typeof TABS)[number]["id"];

/**
 * Dua cara memasukkan data ke dashboard: mengunggah berkas, atau mengisi
 * target langsung dari layar. Keduanya dipisah sebagai tab supaya halaman
 * admin tidak menjadi satu gulungan panjang.
 *
 * `riwayat` dioper sebagai node dari Server Component karena isinya diambil
 * di server, dan hanya relevan pada tab unggah.
 */
export function AdminTabs({
  uploadEnabled,
  riwayat,
}: {
  uploadEnabled: boolean;
  riwayat: ReactNode;
}) {
  const [tab, setTab] = useState<TabId>("unggah");

  return (
    <div className="space-y-5">
      <nav aria-label="Bagian halaman admin" className="flex flex-wrap gap-2">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTab(entry.id)}
            aria-current={tab === entry.id ? "page" : undefined}
            className={`neu-press flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-bold ${
              tab === entry.id ? "text-bni-teal-700" : "text-ink-700"
            }`}
          >
            {entry.icon}
            {entry.label}
          </button>
        ))}
      </nav>

      {tab === "unggah" ? (
        <>
          <ExcelUploader enabled={uploadEnabled} />
          {riwayat}
        </>
      ) : (
        <TargetManager enabled={uploadEnabled} />
      )}
    </div>
  );
}
