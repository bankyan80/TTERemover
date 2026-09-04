"use client";

import React, { useState, useCallback } from "react";
import { TTEArea, AppState } from "@/lib/types";
import UploadZone from "@/components/UploadZone";
import PdfViewer from "@/components/PdfViewer";
import Toolbar from "@/components/Toolbar";
import ProcessingModal from "@/components/ProcessingModal";
import ResultPanel from "@/components/ResultPanel";
import BeforeAfterCompare from "@/components/BeforeAfterCompare";

function getAnnotRect(annot: any): { left: number; top: number; width: number; height: number } | null {
  const r = annot?.rect;
  if (!r) return null;
  if (Array.isArray(r)) {
    return { left: r[0], top: r[1], width: r[2] - r[0], height: r[3] - r[1] };
  }
  if (typeof r === "object") {
    const left = r.left ?? r.x ?? 0;
    const top = r.top ?? r.y ?? 0;
    const width = r.width ?? (r.right ? r.right - left : 0);
    const height = r.height ?? (r.bottom ? r.bottom - top : 0);
    return { left, top, width, height };
  }
  return null;
}

export default function Home() {
  const [appState, setAppState] = useState<AppState>("empty");
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState("");
  const [totalPages, setTotalPages] = useState(0);
  const [areas, setAreas] = useState<TTEArea[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSelectingManual, setIsSelectingManual] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState<"selected" | "all" | null>(null);
  const [resultBlobUrl, setResultBlobUrl] = useState<string | null>(null);
  const [resultFileName, setResultFileName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [undoStack, setUndoStack] = useState<TTEArea[][]>([]);
  const [redoStack, setRedoStack] = useState<TTEArea[][]>([]);

  const pushUndo = useCallback((currentAreas: TTEArea[]) => {
    setUndoStack((prev) => [...prev.slice(-20), currentAreas]);
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoStack((r) => [...r, areas]);
      setAreas(last);
      return prev.slice(0, -1);
    });
  }, [areas]);

  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setUndoStack((u) => [...u, areas]);
      setAreas(last);
      return prev.slice(0, -1);
    });
  }, [areas]);

  const handleFileSelect = useCallback(async (file: File) => {
    setAppState("uploading");
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      setPdfData(buffer);

      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
      const pdf = await loadingTask.promise;
      setTotalPages(pdf.numPages);
      pdf.destroy();

      setAppState("ready");
      setCurrentPage(1);
    } catch {
      setErrorMessage("PDF tidak dapat dibaca. Silakan gunakan file PDF lain.");
      setAppState("error");
    }
  }, []);

  const detectSignatures = useCallback(async () => {
    if (!pdfData) return;
    setAppState("analyzing");

    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfData) });
      const pdf = await loadingTask.promise;

      const detected: TTEArea[] = [];
      const tteKeywords = [
        "tanda tangan", "ditandatangani", "elektronik",
        "digital signature", "signature", "tte", "qr",
      ];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const vp = page.getViewport({ scale: 1 });

        // Method 1: Check annotations for signature widgets
        try {
          const annots = await page.getAnnotations();
          for (const annot of annots) {
            const rect = getAnnotRect(annot);
            if (!rect) continue;

            const isSigWidget =
              annot.subtype === "Widget" && (annot as any).fieldType === "Sig";

            if (isSigWidget) {
              detected.push({
                id: `widget-${Date.now()}-${i}-${detected.length}`,
                page: i,
                x: Math.max(0, rect.left - 5),
                y: Math.max(0, rect.top - 5),
                width: Math.min(rect.width + 10, vp.width),
                height: Math.min(rect.height + 10, vp.height),
                type: "detected",
                confidence: "high",
                method: "widget",
                label: "Signature Widget",
                selected: true,
              });
            }
          }
        } catch {
          // skip annotation check
        }

        // Method 2: Text-based heuristic detection
        try {
          const textContent = await page.getTextContent();

          for (const item of textContent.items) {
            if (!("str" in item)) continue;
            const text = (item as { str: string }).str.toLowerCase().trim();
            if (!text) continue;

            const isTTERelated = tteKeywords.some((kw) => text.includes(kw));
            if (!isTTERelated) continue;

            const tx = (item as any).transform;
            if (!tx || !Array.isArray(tx)) continue;

            const textX = tx[4] || 0;
            const textY = tx[5] || 0;

            // Look for nearby annotations
            try {
              const annots2 = await page.getAnnotations();
              for (const annot of annots2) {
                const rect = getAnnotRect(annot);
                if (!rect) continue;

                const distX = Math.abs(rect.left - textX);
                const distY = Math.abs(rect.top - textY);

                if (distX < 200 && distY < 200) {
                  detected.push({
                    id: `visual-${Date.now()}-${i}-${detected.length}`,
                    page: i,
                    x: Math.max(0, rect.left - 10),
                    y: Math.max(0, rect.top - 10),
                    width: Math.min(rect.width + 20, vp.width - rect.left),
                    height: Math.min(rect.height + 20, vp.height - rect.top),
                    type: "detected",
                    confidence: "medium",
                    method: "visual",
                    label: "Kemungkinan TTE",
                    selected: true,
                  });
                }
              }
            } catch {
              // skip
            }
          }
        } catch {
          // skip text check
        }
      }

      pdf.destroy();

      const unique = deduplicateAreas(detected);
      setAreas(unique);
      setAppState("ready");
    } catch (err) {
      console.error("Detection error", err);
      setAppState("ready");
    }
  }, [pdfData]);

  const deduplicateAreas = (input: TTEArea[]): TTEArea[] => {
    const result: TTEArea[] = [];
    const used = new Set<string>();

    for (const area of input) {
      const key = `${area.page}-${Math.round(area.x)}-${Math.round(area.y)}-${Math.round(area.width)}-${Math.round(area.height)}`;
      if (!used.has(key)) {
        used.add(key);
        result.push(area);
      }
    }
    return result;
  };

  const handleProcess = async (areasToProcess: TTEArea[]) => {
    if (!pdfData) return;
    setAppState("processing");

    try {
      const formData = new FormData();
      const blob = new Blob([pdfData], { type: "application/pdf" });
      formData.append("pdf", blob, fileName || "document.pdf");
      formData.append(
        "areas",
        JSON.stringify({
          areas: areasToProcess.map((a) => ({
            page: a.page,
            x: Math.round(a.x),
            y: Math.round(a.y),
            width: Math.round(a.width),
            height: Math.round(a.height),
          })),
        })
      );

      const response = await fetch("/api/remove-tte", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errorMsg = "Processing failed";
        try {
          const errJson = await response.json();
          errorMsg = errJson.error || errorMsg;
        } catch {
          // response was not JSON
        }
        throw new Error(errorMsg);
      }

      const resultBlob = await response.blob();
      const url = URL.createObjectURL(resultBlob);

      if (resultBlobUrl) URL.revokeObjectURL(resultBlobUrl);

      setResultBlobUrl(url);

      const baseName = fileName.replace(/\.pdf$/i, "");
      setResultFileName(`${baseName}_TTE_dihapus.pdf`);

      setAppState("success");
    } catch (err: unknown) {
      console.error("Process error", err);
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat memproses PDF.";
      setErrorMessage(`${msg} Silakan coba lagi.`);
      setAppState("error");
    }
  };

  const handleRemoveSelected = () => {
    const selected = areas.filter((a) => a.selected);
    if (selected.length === 0) return;
    pushUndo(areas);
    setShowConfirmModal("selected");
  };

  const handleRemoveAll = () => {
    if (areas.length === 0) return;
    pushUndo(areas);
    setShowConfirmModal("all");
  };

  const confirmRemove = () => {
    const mode = showConfirmModal;
    setShowConfirmModal(null);
    if (mode === "selected") {
      const selected = areas.filter((a) => a.selected);
      if (selected.length > 0) handleProcess(selected);
    } else if (mode === "all") {
      handleProcess([...areas]);
    }
  };

  const handleNewPdf = () => {
    if (resultBlobUrl) URL.revokeObjectURL(resultBlobUrl);
    setPdfData(null);
    setFileName("");
    setTotalPages(0);
    setAreas([]);
    setCurrentPage(1);
    setIsSelectingManual(false);
    setShowConfirmModal(null);
    setResultBlobUrl(null);
    setResultFileName("");
    setErrorMessage("");
    setUndoStack([]);
    setRedoStack([]);
    setAppState("empty");
  };

  const handleRetry = () => {
    setErrorMessage("");
    setAppState("ready");
  };

  const handleDownload = () => {
    if (!resultBlobUrl) return;
    const a = document.createElement("a");
    a.href = resultBlobUrl;
    a.download = resultFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleRemoveArea = (id: string) => {
    pushUndo(areas);
    setAreas((prev) => prev.filter((a) => a.id !== id));
  };

  const handleAreasChange = (newAreas: TTEArea[]) => {
    pushUndo(areas);
    setAreas(newAreas);
  };

  const handleResetSelection = () => {
    pushUndo(areas);
    setAreas((prev) => prev.map((a) => ({ ...a, selected: false })));
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      {/* Header */}
      <header
        className="glass sticky top-0 z-40"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white"
              style={{ background: "var(--color-primary)" }}
              aria-hidden="true"
            >
              ✓
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">TTE Remover</p>
              <p className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>
                PDF Signature Cleaner
              </p>
            </div>
          </div>
          <div
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              background: "color-mix(in srgb, var(--color-success) 10%, transparent)",
              color: "var(--color-success)",
            }}
            role="status"
          >
            🔒 NO STORAGE
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Empty state / Upload */}
        {(appState === "empty" || appState === "uploading") && (
          <div className="mx-auto flex max-w-lg flex-col items-center gap-8 py-16">
            <div className="text-center animate-fade-in">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Hapus TTE dari PDF
              </h1>
              <p className="mt-3 text-base" style={{ color: "var(--color-text-secondary)" }}>
                Hapus area tanda tangan elektronik
                <br />
                dengan cepat dan mudah.
              </p>
            </div>
            <UploadZone onFileSelect={handleFileSelect} />
            <p className="text-center text-xs" style={{ color: "var(--color-text-secondary)" }}>
              File diproses sementara • Tanpa database
            </p>
          </div>
        )}

        {/* Analyzing */}
        {appState === "analyzing" && (
          <div className="flex flex-col items-center gap-6 py-20">
            <div className="relative">
              <div
                className="h-16 w-16 animate-spin rounded-full"
                style={{
                  border: "3px solid var(--color-border)",
                  borderTopColor: "var(--color-primary)",
                }}
              />
              <div
                className="absolute inset-0 flex items-center justify-center text-lg font-bold"
                style={{ color: "var(--color-primary)" }}
              >
                ✓
              </div>
            </div>
            <p className="text-lg font-semibold">Menganalisis PDF...</p>
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Mendeteksi area TTE
            </p>
          </div>
        )}

        {/* Ready / Selecting / Processing state */}
        {(appState === "ready" || appState === "selecting" || appState === "processing") &&
          pdfData && (
            <div className="flex flex-col gap-4">
              {areas.length === 0 && appState === "ready" && (
                <div
                  className="animate-fade-in rounded-xl p-4 text-center text-sm"
                  style={{
                    background: "color-mix(in srgb, var(--color-warning) 8%, transparent)",
                    color: "var(--color-text-secondary)",
                    border: "1px solid color-mix(in srgb, var(--color-warning) 20%, transparent)",
                  }}
                >
                  Tidak ditemukan TTE otomatis. Gunakan &quot;+ Pilih Area&quot; untuk menentukan
                  area yang ingin dihapus secara manual.
                </div>
              )}

              <div className="flex flex-col gap-4 lg:flex-row">
                <div className="flex-1 min-w-0">
                  <PdfViewer
                    pdfData={pdfData}
                    totalPages={totalPages}
                    areas={areas}
                    onAreasChange={handleAreasChange}
                    isSelectingManual={isSelectingManual}
                    onCancelManual={() => setIsSelectingManual(false)}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                  />
                </div>
                <div className="w-full shrink-0 lg:w-72">
                  <Toolbar
                    fileName={fileName}
                    totalPages={totalPages}
                    areas={areas}
                    isSelectingManual={isSelectingManual}
                    onStartManualSelect={() => setIsSelectingManual(true)}
                    onRemoveSelected={handleRemoveSelected}
                    onRemoveAll={handleRemoveAll}
                    onRedetect={detectSignatures}
                    onNewPdf={handleNewPdf}
                    onRemoveArea={handleRemoveArea}
                    onToggleSelect={(id) =>
                      handleAreasChange(
                        areas.map((a) =>
                          a.id === id ? { ...a, selected: !a.selected } : a
                        )
                      )
                    }
                    onResetSelection={handleResetSelection}
                    undoStack={undoStack}
                    redoStack={redoStack}
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                  />
                </div>
              </div>
            </div>
          )}

        {/* Processing */}
        <ProcessingModal isVisible={appState === "processing"} />

        {/* Error state */}
        {appState === "error" && (
          <div className="flex flex-col items-center gap-6 py-20">
            <div className="animate-scale-in flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white"
              style={{ background: "var(--color-danger)" }}>
              ✕
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">Tidak dapat memproses PDF.</p>
              <p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
                {errorMessage || "Terjadi kesalahan. Silakan coba lagi."}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRetry}
                className="rounded-xl px-6 py-3 text-sm font-bold text-white transition hover:opacity-90"
                style={{ background: "var(--color-primary)" }}
              >
                Coba Lagi
              </button>
              <button
                onClick={handleNewPdf}
                className="rounded-xl px-6 py-3 text-sm font-bold transition hover:bg-black/5"
                style={{ border: "1px solid var(--color-border)" }}
              >
                PDF Baru
              </button>
            </div>
          </div>
        )}

        {/* Success */}
        {appState === "success" && pdfData && (
          <div className="flex flex-col gap-6 py-8">
            <ResultPanel
              fileName={resultFileName}
              totalPages={totalPages}
              onDownload={handleDownload}
              onNewPdf={handleNewPdf}
            />
            {resultBlobUrl && (
              <BeforeAfterCompare
                originalData={pdfData}
                processedBlobUrl={resultBlobUrl}
                totalPages={totalPages}
              />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t py-6" style={{ borderColor: "var(--color-border)" }}>
        <div className="mx-auto max-w-6xl px-4 text-center">
          <div className="flex flex-col items-center gap-3">
            <p
              className="rounded-lg px-3 py-2 text-xs"
              style={{
                background: "color-mix(in srgb, var(--color-primary) 6%, transparent)",
                color: "var(--color-text-secondary)",
              }}
            >
              🔒 Privasi: PDF hanya diproses sementara untuk menghasilkan file baru dan tidak
              disimpan sebagai arsip. File asli tidak diubah.
            </p>
            <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
              Gunakan aplikasi ini hanya untuk dokumen yang Anda berwenang untuk edit.
            </p>
          </div>
        </div>
      </footer>

      {/* Confirm Modal */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowConfirmModal(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Konfirmasi hapus TTE"
        >
          <div
            className="animate-scale-in mx-4 w-full max-w-sm rounded-2xl p-6"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">
              {showConfirmModal === "selected" ? "Hapus TTE?" : "Hapus semua area TTE?"}
            </h3>
            <p className="mt-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
              {showConfirmModal === "selected"
                ? "Area TTE yang dipilih akan dihapus dari PDF hasil. PDF asli tidak akan diubah."
                : "Semua area TTE yang terdeteksi akan dihapus. Tindakan ini akan diterapkan pada PDF hasil."}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowConfirmModal(null)}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition hover:bg-black/5"
                style={{ border: "1px solid var(--color-border)" }}
              >
                Batal
              </button>
              <button
                onClick={confirmRemove}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
                style={{
                  background:
                    showConfirmModal === "selected"
                      ? "var(--color-primary)"
                      : "var(--color-danger)",
                }}
              >
                {showConfirmModal === "selected" ? "Hapus TTE" : "Hapus Semua"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
