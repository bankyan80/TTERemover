export interface TTEArea {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: "detected" | "manual";
  label: string;
  selected: boolean;
  confidence?: "high" | "medium" | "low";
  confidenceScore?: number;
  method?: "digital" | "visual" | "widget";
  evidence?: string[];
  candidateType?: string;
}

export interface PdfPageInfo {
  pageNumber: number;
  width: number;
  height: number;
  rotation: number;
}

export interface DetectedSignature {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: "high" | "medium" | "low";
  method: "digital" | "visual" | "widget";
  label: string;
}

export interface DetectionCandidate {
  id: string;
  page: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  type: string;
  confidence: number;
  evidence: string[];
  selected: boolean;
}

export interface DetectionDebug {
  page: number;
  textBlocks: number;
  sigTexts: number;
  images: number;
  qrCandidates: number;
  drawings: number;
  annotations: number;
  hasSigWidget: boolean;
}

export interface ProcessResult {
  success: boolean;
  error?: string;
  filename?: string;
}

export type AppState =
  | "empty"
  | "uploading"
  | "analyzing"
  | "ready"
  | "selecting"
  | "processing"
  | "success"
  | "error";

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
