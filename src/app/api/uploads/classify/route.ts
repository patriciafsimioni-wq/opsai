import { NextResponse } from "next/server";
import { requireApiUser, badRequest } from "@/lib/api";
import * as XLSX from "xlsx";

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

type Classification = {
  category: string;
  confidence: "high" | "medium" | "low";
  reason: string;
  preview: Record<string, unknown>[];
  columns: string[];
  rowCount: number;
};

/** Header keywords that identify each data category. */
const RULES: { category: string; keywords: string[]; minMatches: number }[] = [
  {
    category: "Fleet / Vehicles",
    keywords: ["vin", "plate", "dx#", "dx #", "vehicle", "make", "model", "year", "mileage", "lease", "samsara", "onboarded"],
    minMatches: 3,
  },
  {
    category: "Service History",
    keywords: ["service", "provider", "po #", "po#", "invoice", "cost", "odometer", "station", "vendor", "description"],
    minMatches: 3,
  },
  {
    category: "FareEye Routes",
    keywords: ["route", "travel distance", "stops", "utilization", "sporh", "planned hrs", "leave by", "end time", "pallets"],
    minMatches: 3,
  },
  {
    category: "PM Budget",
    keywords: ["budget", "brakes", "oil change", "tires", "transmission", "category", "jan", "feb", "mar", "annual"],
    minMatches: 3,
  },
  {
    category: "Fuel Log",
    keywords: ["fuel", "liters", "gallons", "price", "odometer", "pump", "gas"],
    minMatches: 2,
  },
  {
    category: "Driver Data",
    keywords: ["driver", "license", "first name", "last name", "hire date", "safety score", "rating"],
    minMatches: 3,
  },
];

function classifyByHeaders(headers: string[]): { category: string; confidence: "high" | "medium" | "low"; reason: string } {
  const lower = headers.map((h) => h.toLowerCase().trim());
  let best: { category: string; matches: number; keywords: string[] } | null = null;

  for (const rule of RULES) {
    const matched = rule.keywords.filter((kw) => lower.some((h) => h.includes(kw)));
    if (matched.length >= rule.minMatches) {
      if (!best || matched.length > best.matches) {
        best = { category: rule.category, matches: matched.length, keywords: matched };
      }
    }
  }

  if (best) {
    const confidence = best.matches >= 5 ? "high" : best.matches >= 3 ? "medium" : "low";
    return {
      category: best.category,
      confidence,
      reason: `Matched ${best.matches} header keywords: ${best.keywords.join(", ")}`,
    };
  }

  return { category: "Unknown", confidence: "low", reason: "No matching header patterns found" };
}

function classifyPdfByName(name: string): { category: string; confidence: "high" | "medium" | "low"; reason: string } {
  const lower = name.toLowerCase();
  if (lower.includes("pm") && (lower.includes("preventive") || lower.includes("maintenance") || lower.includes("budget"))) {
    return { category: "PM Budget", confidence: "medium", reason: `Filename contains PM/maintenance keywords: "${name}"` };
  }
  if (lower.includes("invoice")) {
    return { category: "Invoice", confidence: "medium", reason: `Filename contains "invoice": "${name}"` };
  }
  if (lower.includes("service") || lower.includes("history")) {
    return { category: "Service History", confidence: "medium", reason: `Filename contains service/history keywords: "${name}"` };
  }
  if (lower.includes("fleet") || lower.includes("vehicle")) {
    return { category: "Fleet / Vehicles", confidence: "medium", reason: `Filename contains fleet/vehicle keywords: "${name}"` };
  }
  if (lower.includes("fareye") || lower.includes("route")) {
    return { category: "FareEye Routes", confidence: "medium", reason: `Filename contains route keywords: "${name}"` };
  }
  return { category: "Document", confidence: "low", reason: `Could not classify PDF from filename: "${name}"` };
}

export async function POST(req: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) return badRequest("No file uploaded");
  if (file.size > MAX_BYTES) return badRequest("File exceeds the 20 MB limit");
  if (!ALLOWED.includes(file.type)) return badRequest(`Unsupported file type: ${file.type}`);

  const buffer = Buffer.from(await file.arrayBuffer());

  // PDF classification (by filename only since we can't parse PDF easily server-side)
  if (file.type === "application/pdf") {
    const cls = classifyPdfByName(file.name);
    return NextResponse.json({
      filename: file.name,
      size: file.size,
      type: file.type,
      category: cls.category,
      confidence: cls.confidence,
      reason: cls.reason,
      preview: [],
      columns: [],
      rowCount: 0,
    });
  }

  // Image classification
  if (file.type.startsWith("image/")) {
    return NextResponse.json({
      filename: file.name,
      size: file.size,
      type: file.type,
      category: "Photo / Document Scan",
      confidence: "medium" as const,
      reason: "Image file uploaded — may be a receipt, inspection photo, or document scan",
      preview: [],
      columns: [],
      rowCount: 0,
    });
  }

  // Excel / CSV classification
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    const headers = data.length > 0 ? Object.keys(data[0]) : [];
    const cls = classifyByHeaders(headers);

    const result: Classification = {
      category: cls.category,
      confidence: cls.confidence,
      reason: cls.reason,
      preview: data.slice(0, 5),
      columns: headers,
      rowCount: data.length,
    };

    return NextResponse.json({
      filename: file.name,
      size: file.size,
      type: file.type,
      sheetName,
      sheetCount: workbook.SheetNames.length,
      sheets: workbook.SheetNames,
      ...result,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to parse file", detail: String(e) },
      { status: 422 },
    );
  }
}
