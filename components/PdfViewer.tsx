"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { PdfPageInfo, RemovalArea } from "@/lib/types";
import { setupPdfJs } from "@/lib/pdf";
import DetectionOverlay from "./DetectionOverlay";
import ManualSelection from "./ManualSelection";

interface PdfViewerProps {
  pdfData: ArrayBuffer;
  totalPages: number;
  areas: RemovalArea[];
  onAreasChange: (areas: RemovalArea[]) => void;
  isSelectingManual: boolean;
  onCancelManual: () => void;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export default function PdfViewer({
  pdfData,
  totalPages,
  areas,
  onAreasChange,
  isSelectingManual,
  onCancelManual,
  currentPage,
  onPageChange,
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pageInfo, setPageInfo] = useState<PdfPageInfo | null>(null);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [renderError, setRenderError] = useState("");
  const [canvasDisplayWidth, setCanvasDisplayWidth] = useState(0);

  const renderPage = useCallback(async () => {
    setLoading(true);
    setRenderError("");
    try {
      const pdfjsLib = await setupPdfJs();
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfData) });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(currentPage);
      const vp1 = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale });

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: ctx, viewport }).promise;

      setPageInfo({
        pageNumber: currentPage,
        width: vp1.width,
        height: vp1.height,
        rotation: page.rotate || 0,
      });

      setCanvasDisplayWidth(viewport.width);
      setLoading(false);
      pdf.destroy();
    } catch (err) {
      console.error("Render error", err);
      setRenderError("Gagal menampilkan halaman ini.");
      setLoading(false);
    }
  }, [pdfData, currentPage, scale]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  useEffect(() => {
    const fitWidth = () => {
      if (containerRef.current && pageInfo) {
        const containerW = containerRef.current.clientWidth - 32;
        const newScale = containerW / pageInfo.width;
        setScale(Math.min(Math.max(newScale, 0.3), 3));
      }
    };
    if (pageInfo) fitWidth();
    window.addEventListener("resize", fitWidth);
    return () => window.removeEventListener("resize", fitWidth);
  }, [pageInfo]);

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.2, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.2, 0.3));
  const handleFitWidth = () => {
    if (containerRef.current && pageInfo) {
      const w = containerRef.current.clientWidth - 32;
      setScale(w / pageInfo.width);
    }
  };
  const handleFitPage = () => {
    if (containerRef.current && pageInfo) {
      const cw = containerRef.current.clientWidth - 32;
      const ch = containerRef.current.clientHeight - 80;
      const sw = cw / pageInfo.width;
      const sh = ch / pageInfo.height;
      setScale(Math.min(sw, sh));
    }
  };

  return (
    <div className="animate-fade-in flex flex-col gap-3">
      {/* Controls */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            className="flex h-8 w-8 items-center justify-center rounded-lg font-bold transition hover:bg-black/5"
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="w-12 text-center text-sm font-medium">{Math.round(scale * 100)}%</span>
          <button
            onClick={handleZoomIn}
            className="flex h-8 w-8 items-center justify-center rounded-lg font-bold transition hover:bg-black/5"
            aria-label="Zoom in"
          >
            +
          </button>
        </div>

        <div className="flex items-center gap-1 text-sm">
          <button onClick={handleFitWidth} className="rounded-lg px-2 py-1 transition hover:bg-black/5">
            Fit Width
          </button>
          <button onClick={handleFitPage} className="rounded-lg px-2 py-1 transition hover:bg-black/5">
            Fit Page
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg font-bold transition hover:bg-black/5 disabled:opacity-30"
            aria-label="Previous page"
          >
            ‹
          </button>
          <span className="px-2 text-sm font-medium">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-lg font-bold transition hover:bg-black/5 disabled:opacity-30"
            aria-label="Next page"
          >
            ›
          </button>
        </div>
      </div>

      {/* PDF Canvas */}
      <div
        ref={containerRef}
        className="relative flex justify-center overflow-auto rounded-xl"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          minHeight: "400px",
        }}
      >
        {loading && !renderError && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="animate-pulse text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Memuat halaman...
            </div>
          </div>
        )}

        {renderError && (
          <div className="absolute inset-0 flex items-center justify-center z-10 p-6">
            <div className="text-center text-sm" style={{ color: "var(--color-danger)" }}>
              {renderError}
            </div>
          </div>
        )}

        <div ref={wrapperRef} className="relative inline-block p-4 pdf-canvas-container">
          <canvas
            ref={canvasRef}
            className="block rounded-lg shadow-md"
            style={{ display: loading ? "none" : "block" }}
          />

          {pageInfo && !loading && (
            <>
              <DetectionOverlay
                areas={areas.filter((a) => a.page === currentPage)}
                pageInfo={pageInfo}
                canvasDisplayWidth={canvasDisplayWidth}
                onToggleSelect={(id) =>
                  onAreasChange(
                    areas.map((a) => (a.id === id ? { ...a, selected: !a.selected } : a))
                  )
                }
              />
              {isSelectingManual && (
                <ManualSelection
                  pageInfo={pageInfo}
                  displayWidth={canvasDisplayWidth}
                  onComplete={(rect) => {
                    const pdfScale = pageInfo.width / canvasDisplayWidth;
                    const newArea: RemovalArea = {
                      id: `manual-${Date.now()}`,
                      page: currentPage,
                      x: rect.x * pdfScale,
                      y: rect.y * pdfScale,
                      width: rect.width * pdfScale,
                      height: rect.height * pdfScale,
                      source: "manual",
                      selected: true,
                    };
                    onAreasChange([...areas, newArea]);
                    onCancelManual();
                  }}
                  onCancel={onCancelManual}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
