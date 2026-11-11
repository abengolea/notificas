"use client";

import { useRef, useState } from "react";
import { unzip } from "fflate";
import { FileArchive, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { normalizeAttachmentName } from "@/lib/campaign-attachment-name";

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function isNoise(path: string): boolean {
  const base = path.split(/[\\/]/).pop() || "";
  return !base || base.startsWith(".") || /(^|\/)__MACOSX\//.test(path) || base.toLowerCase() === "thumbs.db";
}

function unzipAsync(bytes: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    unzip(bytes, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

/** Archivos sueltos y/o ZIPs → lista plana de File, sin carpetas ni basura del sistema. */
async function expandToFiles(input: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const f of input) {
    if (!f.name.toLowerCase().endsWith(".zip")) {
      if (!isNoise(f.name)) out.push(f);
      continue;
    }
    const entries = await unzipAsync(new Uint8Array(await f.arrayBuffer()));
    for (const [path, data] of Object.entries(entries)) {
      if (path.endsWith("/") || isNoise(path)) continue;
      const name = path.split(/[\\/]/).pop() as string;
      const ext = name.split(".").pop()?.toLowerCase() || "";
      out.push(new File([data as BlobPart], name, { type: MIME_BY_EXT[ext] || "application/octet-stream" }));
    }
  }
  return out;
}

export interface BulkPickResult {
  files: File[];
  /** Archivos que se descartaron y por qué, para mostrarlo. */
  rejected: string[];
}

/** Junta lo ya elegido con lo nuevo: mismo nombre (sin mayúsculas ni carpetas) → gana el último. */
export function mergeBulkFiles(current: File[], added: File[], maxBytes: number): BulkPickResult {
  const rejected: string[] = [];
  const byKey = new Map<string, File>();
  for (const f of current) byKey.set(normalizeAttachmentName(f.name), f);
  for (const f of added) {
    if (f.size <= 0) {
      rejected.push(`${f.name}: está vacío`);
      continue;
    }
    if (f.size > maxBytes) {
      rejected.push(`${f.name}: pesa más de ${Math.round(maxBytes / (1024 * 1024))} MB`);
      continue;
    }
    byKey.set(normalizeAttachmentName(f.name), f);
  }
  return { files: Array.from(byKey.values()), rejected };
}

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BulkAttachmentPicker({
  files,
  onChange,
  maxSizeMB,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  maxSizeMB: number;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function addFiles(list: FileList | File[]) {
    setBusy(true);
    setError(null);
    try {
      const expanded = await expandToFiles(Array.from(list));
      const merged = mergeBulkFiles(files, expanded, maxSizeMB * 1024 * 1024);
      setRejected(merged.rejected);
      onChange(merged.files);
    } catch {
      setError("No se pudo leer el ZIP. Revisá que no esté dañado ni protegido con contraseña.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const totalBytes = files.reduce((n, f) => n + f.size, 0);

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled && e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center gap-2 rounded-md border-2 border-dashed p-6 text-center transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-border"
        } ${disabled ? "opacity-60" : ""}`}
      >
        {busy ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <FileArchive className="h-6 w-6 text-muted-foreground" />}
        <p className="text-sm font-medium">Arrastrá acá un ZIP o todos los archivos</p>
        <p className="text-xs text-muted-foreground">
          El ZIP se abre en tu navegador. Hasta {maxSizeMB} MB por archivo. Los nombres tienen que ser los de la columna «adjunto».
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".zip,.pdf,.png,.jpg,.jpeg,.gif,.doc,.docx,.xls,.xlsx"
          className="hidden"
          onChange={(e) => e.target.files && void addFiles(e.target.files)}
        />
        <Button type="button" variant="outline" size="sm" disabled={disabled || busy} onClick={() => inputRef.current?.click()}>
          <Upload className="mr-2 h-4 w-4" />
          Elegir archivos
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {files.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 p-3 text-sm">
          <span>
            <strong>{files.length.toLocaleString("es-AR")}</strong> {files.length === 1 ? "archivo" : "archivos"} · {formatMb(totalBytes)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive h-8 px-2"
            disabled={disabled}
            onClick={() => {
              setRejected([]);
              onChange([]);
            }}
          >
            Quitar todos
          </Button>
        </div>
      ) : null}

      {rejected.length > 0 ? (
        <div className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
          <p className="font-medium">
            {rejected.length === 1 ? "1 archivo no se agregó:" : `${rejected.length} archivos no se agregaron:`}
          </p>
          <ul className="list-disc pl-4 text-muted-foreground">
            {rejected.slice(0, 10).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {rejected.length > 10 ? <p className="text-muted-foreground">…y {rejected.length - 10} más.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
