"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui";

type Row = Record<string, string | number | null | undefined>;

export function ExportButton({
  rows,
  filename,
  label = "Export CSV",
}: {
  rows: Row[];
  filename: string;
  label?: string;
}) {
  function exportCsv() {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        headers
          .map((h) => {
            const v = r[h] ?? "";
            const s = String(v).replace(/"/g, '""');
            return /[",\n]/.test(s) ? `"${s}"` : s;
          })
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="secondary" onClick={exportCsv}>
      <Download size={16} /> {label}
    </Button>
  );
}
