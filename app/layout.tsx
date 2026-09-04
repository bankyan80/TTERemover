import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TTE Remover — Hapus Tanda Tangan Elektronik dari PDF",
  description:
    "Hapus area TTE dan signature dari PDF dengan cepat. Proses sementara tanpa penyimpanan permanen.",
  icons: {
    icon: "/icons/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#6366f1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
