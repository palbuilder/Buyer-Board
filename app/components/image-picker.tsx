"use client";

import { useEffect, useMemo } from "react";

type ImagePickerProps = {
  label: string;
  helperText: string;
  files: File[];
  onFilesChange: (files: File[]) => void;
  maxFiles?: number;
};

function formatFileSize(size: number) {
  const mb = size / (1024 * 1024);

  if (mb >= 1) {
    return `${mb.toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

export function ImagePicker({ label, helperText, files, onFilesChange, maxFiles = 6 }: ImagePickerProps) {
  const previews = useMemo(
    () =>
      files.map((file) => ({
        key: `${file.name}-${file.size}-${file.lastModified}`,
        url: URL.createObjectURL(file),
        name: file.name,
        sizeLabel: formatFileSize(file.size),
      })),
    [files],
  );

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [previews]);

  return (
    <div className="grid gap-3">
      <label className="field-label">
        {label}
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => onFilesChange(Array.from(event.target.files ?? []).slice(0, maxFiles))}
          className="field-input"
        />
      </label>
      <p className="field-help">{helperText}</p>
      {previews.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {previews.map((preview, index) => (
            <div key={preview.key} className="data-card overflow-hidden rounded-[1rem]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={preview.name} src={preview.url} className="h-36 w-full object-cover" />
              <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-stone-600">
                <span className="truncate">{preview.sizeLabel}</span>
                <button
                  type="button"
                  className="secondary-button rounded-full px-2 py-1 font-medium"
                  onClick={() => onFilesChange(files.filter((_, fileIndex) => fileIndex !== index))}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
