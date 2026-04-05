"use client";
import { useCallback, useState } from "react";
import { ImagePlus, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function ImageUpload({ onFileSelect, onClear, previewUrl, className }: { onFileSelect: (f: File) => void; onClear: () => void; previewUrl?: string; className?: string }) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleFile = useCallback((file: File) => {
    setError(null);
    if (file.size > 5 * 1024 * 1024) { setError("5MB以下の画像を選択してください。大きなファイルはギガファイル便をご利用ください。"); return; }
    if (!["image/jpeg","image/png","image/gif","image/webp"].includes(file.type)) { setError("画像ファイルのみ対応しています。"); return; }
    onFileSelect(file);
  }, [onFileSelect]);

  return (
    <div className={cn("relative", className)}>
      {previewUrl ? (
        <div className="relative inline-block">
          <img src={previewUrl} alt="Preview" className="max-h-32 rounded-lg border border-border" />
          <button onClick={onClear} className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-0.5"><X className="h-3 w-3" /></button>
        </div>
      ) : (
        <label className={cn("flex items-center gap-2 px-3 py-1.5 rounded-md border border-dashed border-border cursor-pointer hover:border-primary text-sm text-muted-foreground", dragOver && "border-primary")}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}>
          <ImagePlus className="h-4 w-4" /><span>画像を添付</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </label>
      )}
      {error && <div className="flex items-center gap-1 mt-1 text-xs text-destructive"><AlertTriangle className="h-3 w-3" />{error}</div>}
    </div>
  );
}
