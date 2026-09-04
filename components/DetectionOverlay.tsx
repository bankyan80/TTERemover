"use client";

import React from "react";
import { RemovalArea, PdfPageInfo } from "@/lib/types";

interface DetectionOverlayProps {
  areas: RemovalArea[];
  pageInfo: PdfPageInfo;
  canvasDisplayWidth: number;
  onToggleSelect: (id: string) => void;
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

        const color = area.selected ? "var(--color-primary)" : "var(--color-danger)";
        const pct = area.confidence != null ? `${Math.round(area.confidence * 100)}%` : "";

        return (
          <div
            key={area.id}
            style={{
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
            }}
            onClick={() => onToggleSelect(area.id)}
            title={`Halaman ${area.page} — ${pct || "Manual"}`}
            role="checkbox"
            aria-checked={area.selected}
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
              Hal. {area.page}
              {pct && <span className="opacity-80">({pct})</span>}
            </div>
          </div>
        );
      })}
    </>
  );
}
