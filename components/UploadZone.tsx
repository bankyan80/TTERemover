"use client";

import React, { useCallback, useRef, useState } from "react";

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
}

export default function UploadZone({ onFileSelect }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    if (file.type !== "application/pdf") return false;
    if (file.size > 50 * 1024 * 1024) return false;
    return true;
  };

  const handleFile = useCallback(
    (file: File) => {
      if (!validateFile(file)) {
        alert("File PDF tidak valid atau terlalu besar. Maksimal 50 MB.");
        return;
      }
      setSelectedFile(file);
      onFileSelect(file);
    },
    [onFileSelect]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onClick = () => inputRef.current?.click();

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="animate-fade-in">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={onClick}
        className="cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-200 hover:scale-[1.01]"
        style={{
          borderColor: isDragging ? "var(--color-primary)" : "var(--color-border)",
          background: isDragging
            ? "color-mix(in srgb, var(--color-primary) 5%, transparent)"
            : "var(--color-surface)",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={onChange}
          className="hidden"
        />

        {selectedFile ? (
          <div className="animate-scale-in flex flex-col items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold text-white"
              style={{ background: "var(--color-success)" }}
            >
              ✓
            </div>
            <p className="text-lg font-semibold">{selectedFile.name}</p>
            <div className="flex gap-4 text-sm" style={{ color: "var(--color-text-secondary)" }}>
              <span>{formatSize(selectedFile.size)}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
              style={{
                background: "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                color: "var(--color-primary)",
              }}
            >
              ↑
            </div>
            <div>
              <p className="text-lg font-semibold">Upload PDF</p>
              <p
                className="mt-1 text-sm"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Tarik dan lepas PDF di sini
                <br />
                atau klik untuk memilih file
              </p>
            </div>
            <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
              PDF maksimal 50 MB
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
