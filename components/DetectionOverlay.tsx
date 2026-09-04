"use client";

import React from "react";
import { TTEArea, PdfPageInfo } from "@/lib/types";

interface DetectionOverlayProps {
  areas: TTEArea[];
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
  const canvasDisplayHeight = pageInfo.height * scale;

  return (
    <>
      {areas.map((area) => {
        const left = area.x * scale;
        const top = area.y * scale;
        const w = area.width * scale;
        const h = area.height * scale;

        const style: React.CSSProperties = {
          position: "absolute",
          left: `${left}px`,
          top: `${top}px`,
          width: `${w}px`,
          height: `${h}px`,
          border: area.selected
            ? "2px solid var(--color-success)"
            : "2px solid var(--color-danger)",
          background: area.selected
            ? "color-mix(in srgb, var(--color-success) 15%, transparent)"
            : "color-mix(in srgb, var(--color-danger) 12%, transparent)",
          cursor: "pointer",
          borderRadius: "4px",
          transition: "all 0.15s ease",
          zIndex: 10,
        };

        return (
          <div
            key={area.id}
            style={style}
            onClick={() => onToggleSelect(area.id)}
            title={`${area.label} (${area.type === "detected" ? "Terdeteksi" : "Manual"})`}
            role="checkbox"
            aria-checked={area.selected}
            aria-label={area.label}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggleSelect(area.id);
              }
            }}
          >
            <div
              className="absolute left-0 top-0 truncate rounded-br rounded-tl px-1.5 py-0.5 text-[10px] font-bold text-white"
              style={{
                background: area.selected
                  ? "var(--color-success)"
                  : "var(--color-danger)",
              }}
            >
              {area.selected ? "✓ " : ""}
              {area.label}
            </div>
          </div>
        );
      })}
    </>
  );
}
