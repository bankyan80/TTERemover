"use client";

import React from "react";

interface ProcessingModalProps {
  isVisible: boolean;
}

export default function ProcessingModal({ isVisible }: ProcessingModalProps) {
  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
    >
      <div className="animate-scale-in mx-4 flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl p-8"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
        <div className="relative">
          <div
            className="h-16 w-16 animate-spin rounded-full"
            style={{ border: "3px solid var(--color-border)", borderTopColor: "var(--color-primary)" }}
          />
          <div
            className="absolute inset-0 flex items-center justify-center text-lg font-bold"
            style={{ color: "var(--color-primary)" }}
          >
            ✓
          </div>
        </div>

        <div className="text-center">
          <p className="text-lg font-semibold">Memproses PDF...</p>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Menghapus area TTE
          </p>
        </div>

        <div className="w-full overflow-hidden rounded-full" style={{ background: "var(--color-border)", height: "6px" }}>
          <div className="animate-progress h-full rounded-full" style={{ background: "var(--color-primary)" }} />
        </div>
      </div>
    </div>
  );
}
