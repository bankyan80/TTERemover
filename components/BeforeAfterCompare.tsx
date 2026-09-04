"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { setupPdfJs, copyPdfData } from "@/lib/pdf";

interface BeforeAfterCompareProps {
  originalData: ArrayBuffer;
  processedBlobUrl: string;
  totalPages: number;
}

export default function BeforeAfterCompare({
  originalData,
  processedBlobUrl,
  totalPages,
}: BeforeAfterCompareProps) {
  const [showAfter, setShowAfter] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);

  const renderPage = useCallback(async () => {
    setLoading(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const pdfjsLib = await setupPdfJs();

      let data: ArrayBuffer;
      if (showAfter) {
        const resp = await fetch(processedBlobUrl);
        data = await resp.arrayBuffer();
      } else {
        data = originalData;
      }

      const loadingTask = pdfjsLib.getDocument({ data: copyPdfData(data) });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(currentPage);

      const container = canvas.parentElement;
      const maxW = container ? container.clientWidth : 600;
      const vp1 = page.getViewport({ scale: 1 });
      const scale = Math.min(maxW / vp1.width, 2);
      const viewport = page.getViewport({ scale });

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: ctx, viewport }).promise;
      setLoading(false);
      pdf.destroy();
    } catch (err) {
      console.error("Compare render error", err);
      setLoading(false);
    }
  }, [originalData, processedBlobUrl, showAfter, currentPage]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  return (
    <div className="animate-slide-up flex w-full flex-col items-center gap-4 rounded-2xl p-6"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
      <p className="text-sm font-semibold">Perbandingan Sebelum / Sesudah</p>

      {/* Toggle */}
      <div className="flex overflow-hidden rounded-xl" style={{ border: "1px solid var(--color-border)" }}>
        <button
          onClick={() => { setShowAfter(false); setCurrentPage(1); }}
          className="px-5 py-2 text-sm font-medium transition"
          style={{
            background: !showAfter ? "var(--color-primary)" : "transparent",
            color: !showAfter ? "white" : "var(--color-text)",
          }}
        >
          Sebelum
        </button>
        <button
          onClick={() => { setShowAfter(true); setCurrentPage(1); }}
          className="px-5 py-2 text-sm font-medium transition"
          style={{
            background: showAfter ? "var(--color-primary)" : "transparent",
            color: showAfter ? "white" : "var(--color-text)",
          }}
        >
          Sesudah
        </button>
      </div>

      {/* Canvas preview */}
      <div className="relative flex justify-center overflow-auto rounded-lg"
        style={{ border: "1px solid var(--color-border)", maxHeight: "500px" }}>
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center"
            style={{ background: "var(--color-surface)" }}>
            <div className="animate-pulse text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Memuat...
            </div>
          </div>
        )}
        <canvas ref={canvasRef} className="block max-w-full" style={{ height: "auto" }} />
      </div>

      {/* Page navigation */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg font-bold transition hover:bg-black/5 disabled:opacity-30"
          >
            ‹
          </button>
          <span className="text-sm font-medium">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-lg font-bold transition hover:bg-black/5 disabled:opacity-30"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
