export function getPdfJs() {
  return import("pdfjs-dist");
}

export async function setupPdfJs() {
  const pdfjsLib = await getPdfJs();
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjsLib;
}

/**
 * PDF.js transfers the underlying ArrayBuffer to the worker when a
 * Uint8Array is passed to getDocument(), detaching the original buffer.
 * Always pass a fresh copy so the shared state buffer stays intact.
 */
export function copyPdfData(data: ArrayBuffer): Uint8Array {
  return new Uint8Array(data.slice(0));
}
