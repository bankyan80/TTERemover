"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { RemovalArea, AppState, DetectionCandidate } from "@/lib/types";
import UploadZone from "@/components/UploadZone";
import PdfViewer from "@/components/PdfViewer";
import Toolbar from "@/components/Toolbar";
import ProcessingStatus from "@/components/ProcessingStatus";
import ResultPanel from "@/components/ResultPanel";
import BeforeAfterCompare from "@/components/BeforeAfterCompare";

export default function Home() {
  const [appState, setAppState] = useState<AppState>("empty");
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState("");
  const [totalPages, setTotalPages] = useState(0);
  const [areas, setAreas] = useState<RemovalArea[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSelectingManual, setIsSelectingManual] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [resultBlobUrl, setResultBlobUrl] = useState<string | null>(null);
  const [resultFileName, setResultFileName] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const detectionRanRef = useRef(false);

  const handleFileSelect = useCallback(async (file: File) => {
    setAppState("uploading");
    setStatusMessage("UPLOADING");
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
      setStatusMessage("");
    } catch {
      setErrorMessage("PDF tidak dapat dibaca. Silakan gunakan file PDF lain.");
      setAppState("error");
    }
  }, []);

  const detectSignatures = useCallback(async () => {
    if (!pdfData) return;
    setAppState("analyzing");
    setStatusMessage("ANALYZING DOCUMENT");

    try {
      const formData = new FormData();
      const blob = new Blob([pdfData], { type: "application/pdf" });
      formData.append("pdf", blob, fileName || "document.pdf");

      let data: { success: boolean; pages: number; candidates: DetectionCandidate[]; error?: string };

      try {
        const res = await fetch("/api/detect-tte", { method: "POST", body: formData });
        if (!res.ok) throw new Error(`Detection API returned ${res.status}`);
        data = await res.json();
      } catch {
        data = { success: true, pages: totalPages || 0, candidates: [] };
      }

      if (!data.success) {
        throw new Error(data.error || "Detection failed");
      }

      const detected: RemovalArea[] = data.candidates.map((c) => ({
        id: c.id,
        page: c.page,
        x: c.x0,
        y: c.y0,
        width: c.x1 - c.x0,
        height: c.y1 - c.y0,
        confidence: c.confidence,
        source: "automatic" as const,
        selected: c.selected,
      }));

      setAreas(detected);
      setStatusMessage("");
      setAppState("ready");
    } catch (err) {
      console.error("Detection error", err);
      setStatusMessage("");
      setAppState("ready");
    }
  }, [pdfData, fileName, totalPages]);

  useEffect(() => {
    if (appState === "ready" && pdfData && !detectionRanRef.current && areas.length === 0) {
      detectionRanRef.current = true;
      detectSignatures();
    }
  }, [appState, pdfData, areas.length, detectSignatures]);

  useEffect(() => {
    if (appState === "empty") {
      detectionRanRef.current = false;
    }
  }, [appState]);

  const handleProcess = async (areasToProcess: RemovalArea[]) => {
    if (!pdfData) return;
    setAppState("processing");
    setStatusMessage("REMOVING QR / TTE");

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
        } catch {}
        throw new Error(errorMsg);
      }

      const resultBlob = await response.blob();
      const url = URL.createObjectURL(resultBlob);

      if (resultBlobUrl) URL.revokeObjectURL(resultBlobUrl);

      setResultBlobUrl(url);
      const baseName = fileName.replace(/\.pdf$/i, "");
      setResultFileName(`${baseName}_TTE_dihapus.pdf`);
      setStatusMessage("COMPLETED");
      setAppState("success");
    } catch (err: unknown) {
      console.error("Process error", err);
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat memproses PDF.";
      setErrorMessage(`${msg} Silakan coba lagi.`);
      setStatusMessage("");
      setAppState("error");
    }
  };

  const handleRemoveSelected = () => {
    const selected = areas.filter((a) => a.selected);
    if (selected.length === 0) return;
    setShowConfirmModal(true);
  };

  const confirmRemove = () => {
    setShowConfirmModal(false);
    const selected = areas.filter((a) => a.selected);
    if (selected.length > 0) handleProcess(selected);
  };

  const handleNewPdf = () => {
    if (resultBlobUrl) URL.revokeObjectURL(resultBlobUrl);
    setPdfData(null);
    setFileName("");
    setTotalPages(0);
    setAreas([]);
    setCurrentPage(1);
    setIsSelectingManual(false);
    setShowConfirmModal(false);
    setResultBlobUrl(null);
    setResultFileName("");
    setErrorMessage("");
    setStatusMessage("");
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
    setAreas((prev) => prev.filter((a) => a.id !== id));
  };

  const handleToggleSelect = (id: string) => {
    setAreas((prev) => prev.map((a) => (a.id === id ? { ...a, selected: !a.selected } : a)));
  };

  const handleResetSelection = () => {
    setAreas((prev) => prev.map((a) => ({ ...a, selected: false })));
  };

  const selectedCount = areas.filter((a) => a.selected).length;

  const showBusy =
    appState === "uploading" ||
    appState === "analyzing" ||
    appState === "processing";

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
              <p className="text-sm font-bold leading-tight">Hapus TTE PDF</p>
              <p className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>
                QR / Tanda Tangan Elektronik Remover
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
            🔒 No Storage
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Empty / Upload */}
        {appState === "empty" && (
          <div className="mx-auto flex max-w-lg flex-col items-center gap-8 py-16">
            <div className="text-center animate-fade-in">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Hapus TTE dari PDF
              </h1>
              <p className="mt-3 text-base" style={{ color: "var(--color-text-secondary)" }}>
                Upload dokumen PDF, deteksi QR / Tanda Tangan Elektronik,
                <br />
                lalu hapus dengan mudah.
              </p>
            </div>
            <UploadZone onFileSelect={handleFileSelect} />
            <p className="text-center text-xs" style={{ color: "var(--color-text-secondary)" }}>
              File diproses sementara • Tanpa database
            </p>
          </div>
        )}

        {/* Busy (uploading / analyzing / processing) */}
        {showBusy && <ProcessingStatus message={statusMessage} />}

        {/* Ready */}
        {appState === "ready" && pdfData && (
          <div className="flex flex-col gap-4">
            {/* Status banner */}
            {areas.length === 0 && (
              <div
                className="animate-fade-in rounded-xl p-4 text-center text-sm"
                style={{
                  background: "color-mix(in srgb, var(--color-warning) 8%, transparent)",
                  color: "var(--color-text-secondary)",
                  border: "1px solid color-mix(in srgb, var(--color-warning) 20%, transparent)",
                }}
              >
                No QR/TTE terdeteksi secara otomatis.
                <br />
                Gunakan &quot;+ Select Area&quot; untuk memilih area QR/TTE yang ingin dihapus.
              </div>
            )}

            {areas.length > 0 && (
              <div
                className="animate-fade-in rounded-xl p-4"
                style={{
                  background: "color-mix(in srgb, var(--color-success) 8%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--color-success) 20%, transparent)",
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: "var(--color-success)" }}
                  >
                    ✓
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: "var(--color-success)" }}>
                      QR / TTE terdeteksi
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                      Ditemukan pada{" "}
                      {[...new Set(areas.map((a) => a.page))].sort((a, b) => a - b).map((p) => `halaman ${p}`).join(", ")}.
                      Tinjau area lalu hapus.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-4 lg:flex-row">
              <div className="flex-1 min-w-0">
                <PdfViewer
                  pdfData={pdfData}
                  totalPages={totalPages}
                  areas={areas}
                  onAreasChange={setAreas}
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
                  onRedetect={detectSignatures}
                  onNewPdf={handleNewPdf}
                  onRemoveArea={handleRemoveArea}
                  onToggleSelect={handleToggleSelect}
                  onResetSelection={handleResetSelection}
                />
              </div>
            </div>
          </div>
        )}

        {/* Error */}
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
        </div>
      </footer>

      {/* Confirm Modal */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowConfirmModal(false)}
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
            <h3 className="text-lg font-semibold">Hapus QR / TTE?</h3>
            <p className="mt-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
              {selectedCount} area QR/TTE yang dipilih akan dihapus dari PDF hasil. PDF asli tidak akan diubah.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition hover:bg-black/5"
                style={{ border: "1px solid var(--color-border)" }}
              >
                Cancel
              </button>
              <button
                onClick={confirmRemove}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
                style={{ background: "var(--color-primary)" }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
