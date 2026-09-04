export function getPdfJs() {
  return import("pdfjs-dist");
}

export async function setupPdfJs() {
  const pdfjsLib = await getPdfJs();
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjsLib;
}
