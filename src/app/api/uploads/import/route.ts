import { NextResponse } from "next/server";
import { requireManager, badRequest } from "@/lib/api";
import { prisma } from "@/lib/db";
import * as XLSX from "xlsx";
import { Station } from "@prisma/client";

const MAX_BYTES = 20 * 1024 * 1024;

function parseDate(val: unknown): Date | null {
  if (!val) return null;
  if (typeof val === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d));
  }
  const s = String(val).trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function parseNum(val: unknown): number {
  if (typeof val === "number") return val;
  const n = parseFloat(String(val).replace(/[$,]/g, ""));
  return isNaN(n) ? 0 : n;
}

const VALID_STATIONS = new Set(["IAH", "ACT", "AUS", "HRL", "LRD", "CLL", "BPT"]);

export async function POST(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  const category = formData?.get("category");
  const sheetName = formData?.get("sheetName");

  if (!file || !(file instanceof File)) return badRequest("No file");
  if (file.size > MAX_BYTES) return badRequest("File too large");

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const targetSheet = sheetName ? String(sheetName) : workbook.SheetNames[0];
  const sheet = workbook.Sheets[targetSheet];
  if (!sheet) return badRequest(`Sheet "${targetSheet}" not found`);

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (rows.length === 0) return badRequest("No data rows found");

  const cat = String(category || "");

  if (cat === "Service History") {
    return importServiceHistory(rows);
  }

  return badRequest(`Import not supported for category: ${cat}`);
}

async function importServiceHistory(rows: Record<string, unknown>[]) {
  // Load vehicles for matching
  const vehicles = await prisma.vehicle.findMany({
    select: { id: true, name: true, vin: true, station: true, dxNumber: true },
  });
  const byDx = new Map(vehicles.map((v) => [v.dxNumber?.toUpperCase(), v]));
  const byVin = new Map(vehicles.filter((v) => v.vin).map((v) => [v.vin!.toUpperCase(), v]));
  const byName = new Map(vehicles.map((v) => [v.name.toUpperCase(), v]));

  // Load existing work orders to detect duplicates
  const existing = await prisma.workOrder.findMany({
    select: { title: true, vehicleId: true, completedAt: true, cost: true },
  });
  const dupeSet = new Set(
    existing.map((w) => `${w.vehicleId}|${w.title}|${w.completedAt?.toISOString().slice(0, 10) ?? ""}|${w.cost}`),
  );

  let imported = 0;
  let skipped = 0;
  let unmatched = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    // Flexible column name matching
    const dxRaw = String(row["DX NUMBER OR License Plate"] ?? row["DX#"] ?? row["DX Number"] ?? row["Vehicle"] ?? "").trim().toUpperCase();
    const vinRaw = String(row["VIN NUMBER - Mandatory"] ?? row["VIN"] ?? row["VIN NUMBER"] ?? "").trim().toUpperCase();
    const title = String(row["Service Category"] ?? row["Description"] ?? row["Service"] ?? row["Title"] ?? "").trim();
    const costVal = parseNum(row["Total Cost"] ?? row["Cost"] ?? row["Amount"] ?? row["Total"] ?? 0);
    const odom = parseNum(row["Odometer - MANDATORY"] ?? row["Odometer"] ?? row["Mileage"] ?? 0);
    const vendor = String(row["Service Provider"] ?? row["Vendor"] ?? row["Provider"] ?? "").trim();
    const dateVal = parseDate(row["Date"] ?? row["Completed Date"] ?? row["Timestamp"] ?? row["Completed"]);
    const invoice = String(row["Invoice #"] ?? row["Invoice"] ?? row["InvoiceNumber"] ?? "").trim();
    const stationRaw = String(row["Station"] ?? "").trim().toUpperCase();

    if (!title) { skipped++; continue; }

    // Match vehicle
    let vehicle = byDx.get(dxRaw) ?? null;
    if (!vehicle && vinRaw) vehicle = byVin.get(vinRaw) ?? null;
    if (!vehicle && dxRaw) vehicle = byName.get(dxRaw) ?? null;
    // Try partial DX match
    if (!vehicle && dxRaw) {
      for (const [dx, v] of byDx) {
        if (dx && dxRaw.includes(dx)) { vehicle = v; break; }
      }
    }

    if (!vehicle) {
      unmatched++;
      errors.push(`Row ${i + 2}: No vehicle match for "${dxRaw}" / VIN "${vinRaw}"`);
      continue;
    }

    const station = (VALID_STATIONS.has(stationRaw) ? stationRaw : vehicle.station) as Station;
    const completedAt = dateVal ?? new Date();

    // Duplicate check
    const dupeKey = `${vehicle.id}|${title}|${completedAt.toISOString().slice(0, 10)}|${costVal}`;
    if (dupeSet.has(dupeKey)) { skipped++; continue; }
    dupeSet.add(dupeKey);

    await prisma.workOrder.create({
      data: {
        vehicleId: vehicle.id,
        title,
        description: title,
        cost: costVal,
        materialCost: costVal,
        odometerAt: odom || null,
        performedBy: vendor || null,
        vendor: vendor || null,
        invoiceNumber: invoice || null,
        vin: vinRaw || vehicle.vin || null,
        station,
        status: "COMPLETED",
        type: "SCHEDULED_SERVICE",
        priority: "MEDIUM",
        completedAt,
      },
    });
    imported++;
  }

  return NextResponse.json({
    success: true,
    imported,
    skipped,
    unmatched,
    total: rows.length,
    errors: errors.slice(0, 20),
  });
}
