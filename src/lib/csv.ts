export type CsvColumn<T> = { header: string; value: (row: T) => string | number };

function escapeCell(val: string | number): string {
  const s = String(val ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build a CSV string from rows + column definitions. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [
    columns.map((c) => c.header).join(","),
    ...rows.map((r) => columns.map((c) => escapeCell(c.value(r))).join(",")),
  ];
  return lines.join("\n");
}

/** Trigger a browser download of a CSV built from rows + columns. */
export function downloadCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]) {
  const blob = new Blob([toCsv(rows, columns)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
