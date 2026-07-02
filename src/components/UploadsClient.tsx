"use client";

import { useCallback, useState } from "react";
import { Upload, FileSpreadsheet, FileText, ImageIcon, CheckCircle2, AlertCircle, Loader2, X, Trash2, Download } from "lucide-react";

type ClassifiedFile = {
  id: string;
  filename: string;
  size: number;
  type: string;
  category: string;
  confidence: "high" | "medium" | "low";
  reason: string;
  columns: string[];
  rowCount: number;
  preview: Record<string, unknown>[];
  sheetName?: string;
  sheetCount?: number;
  sheets?: string[];
  status: "classifying" | "classified" | "error" | "importing" | "imported";
  error?: string;
  file?: File;
  importResult?: { imported: number; skipped: number; unmatched: number; total: number; errors: string[] };
};

const CONFIDENCE_STYLE = {
  high: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", label: "High confidence" },
  medium: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", label: "Medium confidence" },
  low: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", label: "Low confidence" },
};

const CATEGORY_ICON: Record<string, string> = {
  "Fleet / Vehicles": "🚛",
  "Service History": "🔧",
  "FareEye Routes": "🗺️",
  "PM Budget": "💰",
  "Fuel Log": "⛽",
  "Driver Data": "👤",
  "Invoice": "🧾",
  "Document": "📄",
  "Photo / Document Scan": "📷",
  "Unknown": "❓",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function FileIcon({ type }: { type: string }) {
  if (type.includes("spreadsheet") || type.includes("excel") || type.includes("csv")) {
    return <FileSpreadsheet size={24} className="text-green-600" />;
  }
  if (type.includes("pdf")) {
    return <FileText size={24} className="text-red-500" />;
  }
  if (type.startsWith("image/")) {
    return <ImageIcon size={24} className="text-blue-500" />;
  }
  return <FileText size={24} className="text-slate-400" />;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function UploadsClient({ canManage }: { canManage: boolean }) {
  const [files, setFiles] = useState<ClassifiedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const classifyFile = useCallback(async (file: File) => {
    const id = crypto.randomUUID();
    const entry: ClassifiedFile = {
      id,
      filename: file.name,
      size: file.size,
      type: file.type,
      category: "",
      confidence: "low",
      reason: "",
      columns: [],
      rowCount: 0,
      preview: [],
      status: "classifying",
    };

    setFiles((prev) => [entry, ...prev]);

    try {
      const formData = new FormData();
      formData.append("file", file as File);
      const res = await fetch("/api/uploads/classify", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, status: "error" as const, error: data.error ?? "Classification failed" } : f)),
        );
        return;
      }

      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                status: "classified" as const,
                category: data.category,
                confidence: data.confidence,
                reason: data.reason,
                columns: data.columns ?? [],
                rowCount: data.rowCount ?? 0,
                preview: data.preview ?? [],
                sheetName: data.sheetName,
                sheetCount: data.sheetCount,
                sheets: data.sheets,
                file,
              }
            : f,
        ),
      );
    } catch (err) {
      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status: "error" as const, error: String(err) } : f)),
      );
    }
  }, []);

  const handleFiles = useCallback(
    (fileList: FileList | File[]) => {
      Array.from(fileList).forEach((file) => classifyFile(file));
    },
    [classifyFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const importFile = useCallback(async (entry: ClassifiedFile) => {
    if (!entry.file) return;
    setFiles((prev) => prev.map((f) => (f.id === entry.id ? { ...f, status: "importing" as const } : f)));
    try {
      const formData = new FormData();
      formData.append("file", entry.file);
      formData.append("category", entry.category);
      if (entry.sheetName) formData.append("sheetName", entry.sheetName);
      const res = await fetch("/api/uploads/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setFiles((prev) => prev.map((f) => (f.id === entry.id ? { ...f, status: "error" as const, error: data.error ?? "Import failed" } : f)));
        return;
      }
      setFiles((prev) => prev.map((f) => (f.id === entry.id ? { ...f, status: "imported" as const, importResult: data } : f)));
    } catch (err) {
      setFiles((prev) => prev.map((f) => (f.id === entry.id ? { ...f, status: "error" as const, error: String(err) } : f)));
    }
  }, []);

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Template download + deduplication note */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <p className="text-sm font-medium text-slate-700">Upload Template</p>
          <p className="text-xs text-slate-500">Download the Excel template with tabs for each report type (Fuel, Service, FareEye, Fleet, Lease). Fill in new data and re-upload.</p>
          <p className="mt-1 text-xs text-blue-600">⚠️ Duplicate records are automatically detected and skipped on upload.</p>
        </div>
        <a
          href="/api/templates"
          download="LiveFleetAI_Upload_Template.xlsx"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 whitespace-nowrap"
        >
          <Download size={16} /> Download Template
        </a>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 transition-colors ${
          dragOver
            ? "border-blue-400 bg-blue-50"
            : "border-slate-300 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/50"
        }`}
      >
        <Upload size={40} className={`mb-3 ${dragOver ? "text-blue-500" : "text-slate-400"}`} />
        <p className="text-lg font-medium text-slate-700">
          Drop files here or{" "}
          <label className="cursor-pointer text-blue-600 hover:text-blue-700 underline">
            browse
            <input
              type="file"
              multiple
              accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
          </label>
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Excel (.xlsx), CSV, PDF, or images — max 20 MB per file
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {Object.entries(CATEGORY_ICON).filter(([k]) => k !== "Unknown").map(([cat, icon]) => (
            <span key={cat} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 border border-slate-200">
              {icon} {cat}
            </span>
          ))}
        </div>
      </div>

      {/* File results */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">{files.length} file{files.length !== 1 ? "s" : ""} uploaded</h2>
            {files.length > 1 && (
              <button
                onClick={() => setFiles([])}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
              >
                <Trash2 size={14} /> Clear all
              </button>
            )}
          </div>

          {files.map((f) => (
            <div
              key={f.id}
              className={`rounded-xl border bg-white p-4 shadow-sm transition-all ${
                f.status === "classifying" ? "border-blue-200 animate-pulse" : "border-[var(--color-border)]"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {f.status === "classifying" ? (
                    <Loader2 size={24} className="animate-spin text-blue-500" />
                  ) : (
                    <FileIcon type={f.type} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900 truncate">{f.filename}</p>
                    <span className="shrink-0 text-xs text-slate-400">{formatBytes(f.size)}</span>
                    <button
                      onClick={() => removeFile(f.id)}
                      className="ml-auto shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {f.status === "classifying" && (
                    <p className="mt-1 text-sm text-blue-600">Analyzing file structure...</p>
                  )}

                  {f.status === "error" && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                      <AlertCircle size={16} />
                      {f.error}
                    </div>
                  )}

                  {f.status === "classified" && (
                    <div className="mt-2 space-y-2">
                      {/* Category badge */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-800">
                          {CATEGORY_ICON[f.category] ?? "📁"} {f.category}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium ${
                            CONFIDENCE_STYLE[f.confidence].bg
                          } ${CONFIDENCE_STYLE[f.confidence].text} border ${CONFIDENCE_STYLE[f.confidence].border}`}
                        >
                          {f.confidence === "high" ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                          {CONFIDENCE_STYLE[f.confidence].label}
                        </span>
                        {f.rowCount > 0 && (
                          <span className="text-xs text-slate-500">
                            {f.rowCount} row{f.rowCount !== 1 ? "s" : ""} &middot; {f.columns.length} column{f.columns.length !== 1 ? "s" : ""}
                          </span>
                        )}
                        {f.sheetCount && f.sheetCount > 1 && (
                          <span className="text-xs text-slate-500">
                            {f.sheetCount} sheets
                          </span>
                        )}
                      </div>

                      {/* Reason */}
                      <p className="text-xs text-slate-500">{f.reason}</p>

                      {/* Column preview */}
                      {f.columns.length > 0 && (
                        <div className="mt-1">
                          <p className="text-xs font-medium text-slate-600 mb-1">Detected columns:</p>
                          <div className="flex flex-wrap gap-1">
                            {f.columns.slice(0, 20).map((col) => (
                              <span key={col} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                {col}
                              </span>
                            ))}
                            {f.columns.length > 20 && (
                              <span className="text-xs text-slate-400">+{f.columns.length - 20} more</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Import button for supported categories */}
                      {f.category === "Service History" && f.rowCount > 0 && (
                        <button
                          onClick={() => importFile(f)}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
                        >
                          <Upload size={14} /> Import {f.rowCount} records
                        </button>
                      )}

                      {/* Data preview table */}
                      {f.preview.length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs font-medium text-blue-600 hover:text-blue-700">
                            Preview first {f.preview.length} rows
                          </summary>
                          <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                  {f.columns.slice(0, 10).map((col) => (
                                    <th key={col} className="whitespace-nowrap px-2 py-1.5 text-left font-medium text-slate-600">
                                      {col}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {f.preview.map((row, i) => (
                                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                                    {f.columns.slice(0, 10).map((col) => (
                                      <td key={col} className="whitespace-nowrap px-2 py-1 text-slate-700">
                                        {String(row[col] ?? "")}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      )}
                    </div>
                  )}

                  {f.status === "importing" && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-blue-600">
                      <Loader2 size={16} className="animate-spin" /> Importing records...
                    </div>
                  )}

                  {f.status === "imported" && f.importResult && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                        <CheckCircle2 size={16} />
                        Imported {f.importResult.imported} of {f.importResult.total} records
                        {f.importResult.skipped > 0 && ` (${f.importResult.skipped} duplicates skipped)`}
                        {f.importResult.unmatched > 0 && ` (${f.importResult.unmatched} unmatched)`}
                      </div>
                      {f.importResult.errors.length > 0 && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs text-amber-600">View {f.importResult.errors.length} issue(s)</summary>
                          <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                            {f.importResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                          </ul>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
