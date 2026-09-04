"use client";

import React from "react";
import { RemovalArea } from "@/lib/types";

interface ToolbarProps {
  fileName: string;
  totalPages: number;
  areas: RemovalArea[];
  isSelectingManual: boolean;
  onStartManualSelect: () => void;
  onRemoveSelected: () => void;
  onRedetect: () => void;
  onNewPdf: () => void;
  onRemoveArea: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onResetSelection: () => void;
}

export default function Toolbar({
  fileName,
  totalPages,
  areas,
  isSelectingManual,
  onStartManualSelect,
  onRemoveSelected,
  onRedetect,
  onNewPdf,
  onRemoveArea,
  onToggleSelect,
  onResetSelection,
}: ToolbarProps) {
  const selectedCount = areas.filter((a) => a.selected).length;

  return (
    <div className="animate-slide-up flex flex-col gap-3 rounded-xl p-4"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
      {/* File info */}
      <div className="flex items-center justify-between">
        <button
          onClick={onNewPdf}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition hover:bg-black/5"
        >
          ← PDF Baru
        </button>
        <div className="text-right">
          <p className="text-sm font-semibold truncate max-w-[200px]">{fileName}</p>
          <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
            {totalPages} halaman
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onRedetect}
          className="rounded-lg border px-3 py-2 text-sm font-medium transition hover:bg-black/5"
          style={{ borderColor: "var(--color-border)" }}
        >
          Deteksi Ulang
        </button>
        <button
          onClick={isSelectingManual ? undefined : onStartManualSelect}
          className="rounded-lg border px-3 py-2 text-sm font-medium transition hover:bg-black/5"
          style={{
            borderColor: isSelectingManual ? "var(--color-primary)" : "var(--color-border)",
            color: isSelectingManual ? "var(--color-primary)" : undefined,
          }}
        >
          + Pilih Area
        </button>
        <button
          onClick={onResetSelection}
          className="rounded-lg border px-3 py-2 text-sm font-medium transition hover:bg-black/5"
          style={{ borderColor: "var(--color-border)" }}
        >
          Reset
        </button>
      </div>

      {/* Area list */}
      {areas.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>
            Area TTE ({areas.length})
          </p>
          {areas.map((area) => (
            <div
              key={area.id}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm transition"
              style={{
                background: area.selected
                  ? "color-mix(in srgb, var(--color-success) 8%, transparent)"
                  : "transparent",
              }}
            >
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={area.selected}
                  onChange={() => onToggleSelect(area.id)}
                  className="accent-[var(--color-success)]"
                />
                <div className="flex flex-col">
                  <span>
                    Halaman {area.page} — {area.source === "automatic" ? "Otomatis" : "Manual"}
                  </span>
                  {area.confidence != null && (
                    <span className="text-[10px]" style={{ color: "var(--color-success)" }}>
                      {Math.round(area.confidence * 100)}%
                    </span>
                  )}
                </div>
              </label>
              <button
                onClick={() => onRemoveArea(area.id)}
                className="text-xs opacity-50 transition hover:opacity-100"
                aria-label="Hapus area"
                style={{ color: "var(--color-danger)" }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Remove button */}
      {selectedCount > 0 && (
        <div className="pt-2" style={{ borderTop: "1px solid var(--color-border)" }}>
          <button
            onClick={onRemoveSelected}
            className="w-full rounded-xl px-4 py-3 text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: "var(--color-primary)" }}
          >
            Hapus TTE ({selectedCount})
          </button>
        </div>
      )}
    </div>
  );
}
