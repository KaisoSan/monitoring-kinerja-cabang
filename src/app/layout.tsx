import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Dashboard Monitoring Kinerja Kredit",
  description:
    "Monitoring pencapaian, pipeline, produktivitas, dan kualitas kredit per Area Head, cabang, produk, dan pengelola.",
};

export const viewport: Viewport = {
  themeColor: "#e9eef2",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={`${geistSans.variable} ${geistMono.variable} bg-surface antialiased`}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "var(--color-surface)",
              color: "var(--color-ink-900)",
              boxShadow: "var(--shadow-neu)",
              borderRadius: "1rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              padding: "0.85rem 1.1rem",
            },
            success: { iconTheme: { primary: "var(--color-state-good)", secondary: "#fff" } },
            error: { iconTheme: { primary: "var(--color-state-bad)", secondary: "#fff" } },
          }}
        />
      </body>
    </html>
  );
}
