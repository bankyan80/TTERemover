"use client";

import React from "react";

interface ProcessingStatusProps {
  message: string;
}

export default function ProcessingStatus({ message }: ProcessingStatusProps) {
  const label = message || "Processing...";

  return (
    <div className="flex flex-col items-center gap-6 py-20">
      <div className="relative">
        <div
          className="h-16 w-16 animate-spin rounded-full"
          style={{
            border: "3px solid var(--color-border)",
            borderTopColor: "var(--color-primary)",
          }}
        />
        <div
          className="absolute inset-0 flex items-center justify-center text-lg font-bold"
          style={{ color: "var(--color-primary)" }}
        >
          ✓
        </div>
      </div>
      <p className="text-lg font-semibold">{label}</p>
      <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
        Mohon tunggu sebentar
      </p>
    </div>
  );
}
