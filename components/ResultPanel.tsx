"use client";

import React from "react";

interface ResultPanelProps {
  fileName: string;
  totalPages: number;
  onDownload: () => void;
  onNewPdf: () => void;
}

export default function ResultPanel({ fileName, totalPages, onDownload, onNewPdf }: ResultPanelProps) {
  return (
    <div className="animate-slide-up mx-auto flex w-full max-w-md flex-col items-center gap-6 rounded-2xl p-8 text-center"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white"
        style={{ background: "var(--color-success)" }}
      >
        ✓
      </div>

      <div>
        <p className="text-xl font-semibold">Berhasil</p>
        <p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
          TTE berhasil dihapus.
        </p>
      </div>

      <div className="rounded-xl px-4 py-2 text-sm" style={{ background: "var(--color-bg)" }}>
        <p className="font-medium">{fileName.replace(".pdf", "")}_TTE_dihapus.pdf</p>
        <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
          {totalPages} halaman
        </p>
      </div>

      <div className="rounded-lg p-3 text-xs" style={{ background: "color-mix(in srgb, var(--color-warning) 10%, transparent)", color: "var(--color-warning)" }}>
        ⚠ PDF hasil adalah dokumen baru. Tanda tangan digital tidak dipertahankan sebagai tanda tangan valid.
      </div>

      <div className="flex w-full flex-col gap-2">
        <button
          onClick={onDownload}
          className="w-full rounded-xl px-6 py-3 text-sm font-bold text-white transition hover:opacity-90"
          style={{ background: "var(--color-primary)" }}
        >
          ↓ Download PDF
        </button>
        <button
          onClick={onNewPdf}
          className="w-full rounded-xl px-6 py-3 text-sm font-bold transition hover:bg-black/5"
          style={{ border: "1px solid var(--color-border)" }}
        >
          Proses PDF Lain
        </button>
      </div>
    </div>
  );
}
