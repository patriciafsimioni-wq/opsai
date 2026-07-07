import { NextResponse } from "next/server";
import { requireManager, badRequest } from "@/lib/api";
import { prisma } from "@/lib/db";
import * as XLSX from "xlsx";
import { Station } from "@prisma/client";
import { STATIONS, stationFromRouteId } from "@/lib/constants";

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

const VALID_STATIONS = new Set(Object.values(Station) as string[]);
const DEFAULT_STATION = STATIONS[0] as Station;

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

  if (cat === "FareEye Routes") {
    return importFareyeRoutes(rows);
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
    // Prefer the specific service named in one of the category columns
    // (e.g. "PM B – Oil Change", "Tire Replacement", "Engine Repair") — these
    // are readable and classify correctly. The generic "Service Category"
    // column often holds an opaque code (e.g. "CAT001"), so fall back to the
    // readable description before the code.
    const CATEGORY_COLUMNS = [
      "Preventive Maintenance",
      "Safety Compliance ",
      "Safety Compliance",
      "Mechanical Repair",
      "Engine Services",
      "Electrical Repairs",
      "A/C & Heating",
      "Cosmetic & Utility",
      "Admin / Accidents / Insurance Claims",
    ];
    const categoryTitle = CATEGORY_COLUMNS.map((c) => String(row[c] ?? "").trim()).find((v) => v !== "");
    const codeTitle = String(row["Service Category"] ?? row["Service"] ?? row["Title"] ?? "").trim();
    const descTitle = String(row["Service Description"] ?? row["Description"] ?? "").trim();
    const isCode = /^cat\d+$/i.test(codeTitle);
    const title = (categoryTitle || (isCode ? descTitle || codeTitle : codeTitle || descTitle)).trim();
    const costVal = parseNum(row["Total Cost"] ?? row["Cost"] ?? row["Amount"] ?? row["Total"] ?? 0);
    const odom = parseNum(row["Odometer - MANDATORY"] ?? row["Odometer"] ?? row["Mileage"] ?? 0);
    const vendor = String(row["Service Provider"] ?? row["Vendor"] ?? row["Provider"] ?? "").trim();
    const dateVal = parseDate(row["Date (service)"] ?? row["Date"] ?? row["Completed Date"] ?? row["Timestamp"] ?? row["Completed"]);
    const invoice = String(row["Invoice #"] ?? row["Invoice"] ?? row["InvoiceNumber"] ?? "").trim();
    const stationRaw = String(row["STATION"] ?? row["Station"] ?? row["station"] ?? "").trim().toUpperCase();

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

function parseMinutes(val: unknown): number {
  if (!val) return 0;
  const s = String(val).trim();
  // "2 hrs 30 mins" or "125 hrs 19 mins"
  const hm = s.match(/(\d+)\s*hrs?\s*(\d+)?\s*min/i);
  if (hm) return parseInt(hm[1]) * 60 + (parseInt(hm[2] || "0"));
  // "2:30" format
  const colon = s.match(/^(\d+):(\d+)/);
  if (colon) return parseInt(colon[1]) * 60 + parseInt(colon[2]);
  return Math.round(parseNum(val));
}

function parseMiles(val: unknown): number {
  if (!val) return 0;
  const s = String(val).trim().replace(/\s*miles?$/i, "").replace(/,/g, "");
  return parseNum(s);
}

// FareEye exports sometimes store clock times as an Excel day-fraction
// (e.g. 0.46944 = 11:16). Normalize any such value to an "HH:MM" string.
function parseClock(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (!s) return null;
  // Already a clock string ("13:01" or "13:01:00"): keep HH:MM.
  const clock = s.match(/^(\d{1,2}):(\d{2})/);
  if (clock) return `${clock[1].padStart(2, "0")}:${clock[2]}`;
  // Numeric day-fraction (0 <= n < 1) => time of day.
  const n = Number(s);
  if (Number.isFinite(n) && n >= 0 && n < 1) {
    let totalMin = Math.round(n * 24 * 60);
    if (totalMin >= 1440) totalMin = 1439;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  return s;
}

// Utilization columns arrive either as whole percents (75.83) or as
// fractions of 1 (0.9333). Normalize everything to a percent (0-100).
function parsePct(val: unknown): number {
  const n = parseNum(val);
  if (n > 0 && n <= 1) return Math.round(n * 100 * 100) / 100;
  return n;
}

async function importFareyeRoutes(rows: Record<string, unknown>[]) {
  const existing = await prisma.fareyeRoute.findMany({
    select: { routeId: true, date: true },
  });
  const dupeSet = new Set(
    existing.map((r) => `${r.routeId}|${r.date.toISOString().slice(0, 10)}`),
  );

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const routeId = String(row["Route"] ?? row["Routes"] ?? row["Route ID"] ?? row["RouteID"] ?? "").trim();
    const dateVal = parseDate(row["Date"] ?? "");
    const driverName = String(row["First User Name"] ?? row["Driver"] ?? "").trim() || null;
    const miles = parseMiles(row["Miles"] ?? row["Miles*"] ?? row["Travel Distance"] ?? 0);
    const travelMinutes = parseMinutes(row["Travel Time"] ?? 0);
    const routeDurationMinutes = parseMinutes(row["Route Duration"] ?? 0);
    const leaveByTime = parseClock(row["Vehicle Leave By Time"] ?? row["Leave By"] ?? "");
    const plannedEndTime = parseClock(row["Vehicle Planned End Time"] ?? row["Planned End Time"] ?? "");
    const stops = Math.round(parseNum(row["Stop Count"] ?? row["Stops"] ?? 0));
    const jobs = Math.round(parseNum(row["No. of jobs"] ?? row["Jobs"] ?? 0));
    const totalWeight = parseNum(row["Total weight"] ?? row["Total Weight"] ?? 0);
    const totalPallets = Math.round(parseNum(row["Total Pallets"] ?? row["Pallets"] ?? 0));
    const totalVolume = parseNum(row["Total Volume"] ?? 0);
    const vehicleCapacity = parseNum(row["Vehicle Capacity"] ?? 0);
    const weightCapacityUtil = parsePct(row["Weight Capacity Utilization"] ?? 0);
    const palletsCapacityUtil = parsePct(row["Pallets Capacity Utilization"] ?? 0);
    const volumetricCapacityUtil = parsePct(row["VolumetricCapacityUtilization"] ?? row["Volumetric Capacity Utilization"] ?? 0);
    const vehicleType = String(row["Vehicle Type"] ?? "VAN").trim();
    const vehicleTag = String(row["Vehicle Tag"] ?? "").trim() || null;
    const vehicleUtilization = parsePct(row["Vehicle Utilization"] ?? row["Vehicle U%"] ?? 0);
    const shiftUtilization = parsePct(row["Shift Utilization"] ?? 0);
    const sporh = parseNum(row["SPORH"] ?? 0);
    const plannedHours = parseNum(row["FE Planned Hrs"] ?? row["Planned Hrs"] ?? row["Planned Hours"] ?? 0);
    const breakDuration = parseMinutes(row["Break duration (Mins)"] ?? row["Break Duration"] ?? 0);
    const breakTime = String(row["Break Time"] ?? "").trim() || null;
    const waitingTime = parseMinutes(row["Waiting Time"] ?? 0);
    const totalLoadingTime = parseMinutes(row["Total Loading Time"] ?? 0);
    const totalRuns = Math.round(parseNum(row["Total Runs"] ?? 0));
    const cost = parseNum(row["Cost"] ?? 0);
    const co2Emit = parseNum(row["Co2 Emit"] ?? row["CO2 Emit"] ?? 0);
    const co2Saved = parseNum(row["Co2 Saved"] ?? row["CO2 Saved"] ?? 0);
    const serviceProvider = String(row["Service Provider"] ?? "").trim() || null;
    const lat = parseNum(row["Vehicle Start Location (Latitude)"] ?? 0) || null;
    const lng = parseNum(row["Vehicle Start Location (Longitude)"] ?? 0) || null;
    const stationRaw = String(row["STATION"] ?? row["Station"] ?? row["station"] ?? "").trim().toUpperCase();

    if (!routeId || !dateVal) { skipped++; continue; }

    // Skip summary/header rows
    const SUMMARY_LABELS = ["no. of gig shipments", "no. of jobs", "no. of routes", "overall", "route wise", "sporh", "spr", "total cost", "total travel time", "total waiting time", "total route duration", "total travel distance", "total weight", "unassigned jobs"];
    if (SUMMARY_LABELS.includes(routeId.toLowerCase())) { skipped++; continue; }

    const dupeKey = `${routeId}|${dateVal.toISOString().slice(0, 10)}`;
    if (dupeSet.has(dupeKey)) { skipped++; continue; }
    dupeSet.add(dupeKey);

    // The route ID prefix is authoritative for the origin station; fall back to
    // the STATION column, then the default only if neither resolves.
    const routeStation = stationFromRouteId(routeId);
    const station = (routeStation ?? (VALID_STATIONS.has(stationRaw) ? stationRaw : DEFAULT_STATION)) as Station;

    await prisma.fareyeRoute.create({
      data: {
        date: dateVal,
        routeId,
        driverName,
        miles,
        travelMinutes: travelMinutes || Math.round(miles / 40 * 60),
        routeDurationMinutes: routeDurationMinutes || Math.round(miles / 40 * 60),
        leaveByTime,
        plannedEndTime,
        stops,
        jobs,
        totalWeight,
        totalPallets,
        totalVolume,
        vehicleCapacity,
        weightCapacityUtil,
        palletsCapacityUtil,
        volumetricCapacityUtil,
        vehicleType: vehicleType || "VAN",
        vehicleTag,
        vehicleUtilization,
        shiftUtilization,
        sporh,
        plannedHours,
        breakDuration,
        breakTime,
        waitingTime,
        totalLoadingTime,
        totalRuns,
        cost,
        co2Emit,
        co2Saved,
        serviceProvider,
        lat,
        lng,
        station,
      },
    });
    imported++;
  }

  return NextResponse.json({
    success: true,
    imported,
    skipped,
    unmatched: 0,
    total: rows.length,
    errors: errors.slice(0, 20),
  });
}
