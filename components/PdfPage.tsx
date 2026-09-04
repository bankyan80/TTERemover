"use client";

import React, { useEffect, useRef, useState } from "react";
import { PdfPageInfo } from "@/lib/types";

interface PdfPageProps {
  data: ArrayBuffer;
  pageNumber: number;
  totalPages: number;
  scale: number;
  pageInfo: PdfPageInfo | null;
  onInfoReady: (info: PdfPageInfo) => void;
  isSelected: boolean;
}

export default function PdfPage({
  data,
  pageNumber,
  totalPages,
  scale,
  pageInfo,
  onInfoReady,
  isSelected,
}: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      setLoading(true);
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(data) });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale });

        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: ctx, viewport }).promise;

        if (!cancelled) {
          const vp1 = page.getViewport({ scale: 1 });
          onInfoReady({
            pageNumber,
            width: vp1.width,
            height: vp1.height,
            rotation: page.rotate || 0,
          });
          setLoading(false);
        }

        pdf.destroy();
      } catch (err) {
        console.error("Failed to render page", pageNumber, err);
        if (!cancelled) setLoading(false);
      }
    };
    render();
    return () => {
      cancelled = true;
    };
  }, [data, pageNumber, scale, onInfoReady]);

  return (
    <div
      className="relative inline-block"
      style={{
        border: isSelected
          ? "2px solid var(--color-primary)"
          : "1px solid var(--color-border)",
        borderRadius: "8px",
        overflow: "hidden",
        boxShadow: isSelected
          ? "0 0 0 3px color-mix(in srgb, var(--color-primary) 20%, transparent)"
          : "0 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      {loading && (
        <div
          className="flex h-[400px] w-[300px] items-center justify-center"
          style={{ background: "var(--color-surface)" }}
        >
          <div className="animate-pulse text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Memuat halaman {pageNumber}...
          </div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="block"
        style={{
          maxWidth: "100%",
          height: "auto",
          display: loading ? "none" : "block",
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 py-1 text-center text-xs font-medium"
        style={{
          background: "var(--color-surface-glass)",
          backdropFilter: "blur(4px)",
          color: "var(--color-text-secondary)",
        }}
      >
        Halaman {pageNumber} / {totalPages}
      </div>
    </div>
  );
}
