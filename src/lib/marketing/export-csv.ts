/** Converts an array of objects to a CSV string and triggers a download. */
export function downloadCsv(rows: Record<string, unknown>[], filename: string, columns: { key: string; label: string }[]): void {
  const header = columns.map((c) => `"${c.label}"`).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          const v = row[c.key];
          if (v === null || v === undefined) return '""';
          const s = String(v).replace(/"/g, '""');
          return `"${s}"`;
        })
        .join(","),
    )
    .join("\n");
  const csv = `﻿${header}\n${body}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
