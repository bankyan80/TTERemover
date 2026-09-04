"use client";

import React from "react";
import { TTEArea, PdfPageInfo } from "@/lib/types";

interface DetectionOverlayProps {
  areas: TTEArea[];
  pageInfo: PdfPageInfo;
  canvasDisplayWidth: number;
  onToggleSelect: (id: string) => void;
}

function confidenceColor(confidence?: "high" | "medium" | "low"): string {
  if (confidence === "high") return "var(--color-success)";
  if (confidence === "medium") return "var(--color-warning)";
  return "var(--color-danger)";
}

function confidencePercent(score?: number): string {
  if (score == null) return "";
  return `${Math.round(score * 100)}%`;
}

export default function DetectionOverlay({
  areas,
  pageInfo,
  canvasDisplayWidth,
  onToggleSelect,
}: DetectionOverlayProps) {
  if (!pageInfo || canvasDisplayWidth === 0) return null;

  const scale = canvasDisplayWidth / pageInfo.width;

  return (
    <>
      {areas.map((area) => {
        const left = area.x * scale;
        const top = area.y * scale;
        const w = area.width * scale;
        const h = area.height * scale;

        const color = confidenceColor(area.confidence);
        const pct = confidencePercent(area.confidenceScore);

        const style: React.CSSProperties = {
          position: "absolute",
          left: `${left}px`,
          top: `${top}px`,
          width: `${w}px`,
          height: `${h}px`,
          border: area.selected
            ? `2px solid ${color}`
            : "2px dashed var(--color-danger)",
          background: area.selected
            ? `color-mix(in srgb, ${color} 15%, transparent)`
            : "color-mix(in srgb, var(--color-danger) 12%, transparent)",
          cursor: "pointer",
          borderRadius: "4px",
          transition: "all 0.15s ease",
          zIndex: 10,
        };

        const evidenceText = area.evidence?.length
          ? area.evidence.join(" • ")
          : area.label;

        return (
          <div
            key={area.id}
            style={style}
            onClick={() => onToggleSelect(area.id)}
            title={`${area.label}${pct ? ` (${pct})` : ""} — ${evidenceText}`}
            role="checkbox"
            aria-checked={area.selected}
            aria-label={`${area.label} ${pct}`}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggleSelect(area.id);
              }
            }}
          >
            <div
              className="absolute left-0 top-0 flex items-center gap-1 truncate rounded-br rounded-tl px-1.5 py-0.5 text-[10px] font-bold text-white"
              style={{ background: color }}
            >
              {area.selected ? "✓ " : ""}
              {area.label}
              {pct && <span className="opacity-80">({pct})</span>}
            </div>
          </div>
        );
      })}
    </>
  );
}
