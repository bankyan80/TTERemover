"use client";

import React, { useRef, useState, useCallback } from "react";
import { PdfPageInfo, SelectionRect } from "@/lib/types";

interface ManualSelectionProps {
  pageInfo: PdfPageInfo;
  displayWidth: number;
  onComplete: (rect: SelectionRect) => void;
  onCancel: () => void;
}

export default function ManualSelection({
  pageInfo,
  displayWidth,
  onComplete,
  onCancel,
}: ManualSelectionProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<SelectionRect | null>(null);

  const getPos = (e: React.MouseEvent) => {
    if (!overlayRef.current) return { x: 0, y: 0 };
    const rect = overlayRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    const pos = getPos(e);
    setStartPos(pos);
    setCurrentRect(null);
  };

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!startPos) return;
      const pos = getPos(e);
      const x = Math.min(startPos.x, pos.x);
      const y = Math.min(startPos.y, pos.y);
      const width = Math.abs(pos.x - startPos.x);
      const height = Math.abs(pos.y - startPos.y);
      setCurrentRect({ x, y, width, height });
    },
    [startPos]
  );

  const onMouseUp = () => {
    if (currentRect && currentRect.width > 10 && currentRect.height > 10) {
      onComplete(currentRect);
    }
    setStartPos(null);
    setCurrentRect(null);
  };

  const pdfScale = displayWidth / pageInfo.width;
  const displayHeight = pageInfo.height * pdfScale;

  return (
    <>
      <div
        ref={overlayRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        className="absolute inset-0 z-20"
        style={{
          cursor: "crosshair",
          width: `${displayWidth}px`,
          height: `${displayHeight}px`,
        }}
      >
        {currentRect && (
          <div
            style={{
              position: "absolute",
              left: currentRect.x,
              top: currentRect.y,
              width: currentRect.width,
              height: currentRect.height,
              border: "2px dashed var(--color-primary)",
              background: "color-mix(in srgb, var(--color-primary) 10%, transparent)",
              borderRadius: "4px",
              pointerEvents: "none",
            }}
          >
            <div
              className="absolute left-0 top-0 rounded-br rounded-tl px-1.5 py-0.5 text-[10px] font-bold text-white"
              style={{ background: "var(--color-primary)" }}
            >
              {Math.round(currentRect.width / pdfScale)} × {Math.round(currentRect.height / pdfScale)}
            </div>
          </div>
        )}
      </div>
      {/* Cancel button outside overlay to avoid z-index/positioning issues */}
      <div
        className="fixed bottom-5 right-5 z-50 flex gap-2"
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white shadow-lg transition hover:opacity-90"
          style={{ background: "var(--color-danger)" }}
        >
          Batal
        </button>
      </div>
    </>
  );
}
