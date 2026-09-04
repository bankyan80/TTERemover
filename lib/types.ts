export type RemovalArea = {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence?: number;
  source: "automatic" | "manual";
  selected: boolean;
};

export type AppState =
  | "empty"
  | "uploading"
  | "analyzing"
  | "ready"
  | "processing"
  | "success"
  | "error";

export interface PdfPageInfo {
  pageNumber: number;
  width: number;
  height: number;
  rotation: number;
}

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
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
