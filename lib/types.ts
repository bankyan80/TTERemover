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
  method?: "digital" | "visual" | "widget";
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
