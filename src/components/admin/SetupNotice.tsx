import { AlertTriangle } from "lucide-react";

const STEPS = [
  "Buat project di supabase.com, lalu buka SQL Editor.",
  "Jalankan seluruh isi file supabase/schema.sql dari repo ini.",
  "Salin .env.example menjadi .env.local dan isi URL, anon key, serta service role key.",
  "Buat satu user admin di Authentication > Users, lalu daftarkan emailnya pada ADMIN_EMAILS.",
  "Jalankan ulang npm run dev.",
];

export function SetupNotice() {
  return (
    <div className="neu-inset rounded-2xl p-5">
      <p className="text-state-warn-text mb-3 flex items-center gap-2 text-sm font-bold">
        <AlertTriangle size={16} />
        Supabase belum dikonfigurasi
      </p>
      <ol className="text-ink-700 list-inside list-decimal space-y-2 text-sm">
        {STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  );
}
