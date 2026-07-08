import { NextResponse } from "next/server";
import { requireManager, badRequest } from "@/lib/api";
import { prisma } from "@/lib/db";
import * as XLSX from "xlsx";
import { Station, VehicleType, FuelType } from "@prisma/client";
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

  if (cat === "Fleet / Vehicles") {
    return importVehicles(rows);
  }

  return badRequest(`Import not supported for category: ${cat}`);
}

/** First non-empty value across a set of candidate column names. */
function pick(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function inferType(text: string): "VAN" | "TRUCK" {
  const t = text.toLowerCase();
  if (/\b(van|cargo|transit|express|savana|sprinter|promaster)\b/.test(t)) return "VAN";
  if (/\b(truck|tractor|international|freightliner|box)\b/.test(t)) return "TRUCK";
  return "VAN";
}

function inferFuel(text: string): "ELECTRIC" | "DIESEL" | "GASOLINE" {
  const t = text.toLowerCase();
  if (/\b(e-transit|etransit|electric|ev|bev)\b/.test(t)) return "ELECTRIC";
  if (/\b(diesel|international|freightliner|mv607)\b/.test(t)) return "DIESEL";
  return "GASOLINE";
}

// Import the "Fleet List" / "Lease" template tabs as vehicles. Rows are upserted
// by VIN (then DX, then plate) so re-uploads and the separate Fleet/Lease tabs
// enrich the same record instead of creating duplicates. On an existing vehicle
// only lease/financial/odometer fields are enriched — station, name, plate and
// type are never overwritten.
async function importVehicles(rows: Record<string, unknown>[]) {
  const existing = await prisma.vehicle.findMany({
    select: { id: true, name: true, vin: true, dxNumber: true, licensePlate: true },
  });
  const byVin = new Map(existing.filter((v) => v.vin).map((v) => [v.vin.toUpperCase(), v]));
  const byDx = new Map(existing.filter((v) => v.dxNumber).map((v) => [v.dxNumber!.toUpperCase(), v]));
  const byPlate = new Map(existing.map((v) => [v.licensePlate.toUpperCase().replace(/[\s-]/g, ""), v]));

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const vin = pick(row, ["VIN #", "VIN", "VIN NUMBER", "VIN Number", "Vin"]).toUpperCase();
    const dxRaw = pick(row, ["DX #", "DX#", "DX Number", "DX NUMBER"]).toUpperCase();
    const plateRaw = pick(row, ["Plate #", "License Plate Number", "Plate", "License Plate", "Plate Number"]);
    const plateKey = plateRaw.toUpperCase().replace(/[\s-]/g, "");

    // Need at least one identifier to key on.
    if (!vin && !dxRaw && !plateRaw) { skipped++; continue; }

    const year = Math.round(parseNum(pick(row, ["Year"])));
    const make = pick(row, ["Make"]);
    const model = pick(row, ["Model", "Model Description", "Vehicle Model", "Model Code"]);
    const vehicleText = pick(row, ["Vehicle", "Contract Description"]) + " " + make + " " + model;
    const leasingCompany = pick(row, ["Leasing Company", "Tier 2 Account Name"]) || null;
    const stationRaw = pick(row, ["Location", "STATION", "Station", "Cost Center"]).toUpperCase();
    const station = ((STATIONS as readonly string[]).includes(stationRaw) ? stationRaw : DEFAULT_STATION) as Station;
    const odometer = parseNum(pick(row, ["Current Mileage", "Last Odo Reading", "Odometer", "In Service Miles"]));

    // Lease / financial fields (present on the Lease tabs, optional on Fleet List).
    const leaseType = pick(row, ["Lease Type", "Contract Description"]) || null;
    const leaseTerm = Math.round(parseNum(pick(row, ["Term", "Term in Months", "Projected Months"]))) || null;
    const leaseStartDate = parseDate(pick(row, ["Start Date", "Contract Start Date", "In Service Date"]));
    const leaseEndDate = parseDate(pick(row, ["Lease End Date", "End Date", "Contract End Date"]));
    const contractMileage = parseNum(pick(row, ["Contract Mileage", "Permitted Mileage"])) || null;
    const totalRentPerMonth = parseNum(pick(row, ["Total Rent Per Month", "Base Lease Rate"])) || null;
    const leaseChargePerMonth = parseNum(pick(row, ["Lease Charge Per Month"])) || null;
    const serviceChargePerMonth = parseNum(pick(row, ["Service Charge Per Month", "Services Amount"])) || null;
    const currentBookValue = parseNum(pick(row, ["Current Book Value", "Open End Net Book Value"])) || null;
    const openEndCapCost = parseNum(pick(row, ["Open End Cap Cost", "Delivered Price"])) || null;
    const openEndNetBookValue = parseNum(pick(row, ["Open End Net Book Value"])) || null;
    const currentMarketValue = parseNum(pick(row, ["Current Market Value Open End Contracts and Owned Units", "Current Market Value"])) || null;
    const excessMileageRate = parseNum(pick(row, ["Excess Mileage Rate"])) || null;
    const monthsLeftPayoff = Math.round(parseNum(pick(row, ["Months left for Pay off", "Months In Service"]))) || null;
    const registrationMonth = pick(row, ["Registration Month"]) || null;

    // Fields to enrich on an existing vehicle (never clobber identity/station).
    const leaseData = {
      leasingCompany, leaseType, leaseTerm, leaseStartDate, leaseEndDate,
      contractMileage, totalRentPerMonth, leaseChargePerMonth, serviceChargePerMonth,
      currentBookValue, openEndCapCost, openEndNetBookValue, currentMarketValue,
      excessMileageRate, monthsLeftPayoff, registrationMonth,
    };
    // Drop null/empty so we only overwrite when the sheet actually has a value.
    const enrich: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(leaseData)) if (v !== null && v !== "") enrich[k] = v;

    const match =
      (vin && byVin.get(vin)) ||
      (dxRaw && byDx.get(dxRaw)) ||
      (plateKey && byPlate.get(plateKey)) ||
      null;

    try {
      if (match) {
        if (odometer > 0) enrich.odometer = odometer;
        if (dxRaw && !match.dxNumber) enrich.dxNumber = dxRaw;
        await prisma.vehicle.update({ where: { id: match.id }, data: enrich });
        updated++;
        continue;
      }

      // New vehicle — VIN is required by the schema (unique). Without one we
      // can't safely create, so record it and move on.
      if (!vin) {
        skipped++;
        errors.push(`Row ${i + 2}: no VIN — cannot create "${dxRaw || plateRaw}" (VIN required for new vehicles)`);
        continue;
      }

      const name = dxRaw || plateRaw || vin;
      const created = await prisma.vehicle.create({
        data: {
          name,
          dxNumber: dxRaw || null,
          make: make || "Unknown",
          model: model || "Unknown",
          year: year || new Date().getFullYear(),
          vin,
          licensePlate: plateRaw || name,
          type: inferType(vehicleText) as VehicleType,
          fuelType: inferFuel(vehicleText) as FuelType,
          station,
          odometer: odometer || 0,
          ...enrich,
        },
        select: { id: true, name: true, vin: true, dxNumber: true, licensePlate: true },
      });
      // Track so later rows in the same file don't duplicate it.
      byVin.set(vin, created);
      if (dxRaw) byDx.set(dxRaw, created);
      if (plateKey) byPlate.set(plateKey, created);
      existing.push(created);
      imported++;
    } catch (e) {
      skipped++;
      errors.push(`Row ${i + 2}: ${String(e instanceof Error ? e.message : e).slice(0, 140)}`);
    }
  }

  return NextResponse.json({
    success: true,
    imported,
    updated,
    skipped,
    unmatched: 0,
    total: rows.length,
    errors: errors.slice(0, 20),
  });
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
