// Corrects TROVA service history: rebuilds the imported service work orders
// with proper titles taken from the readable category columns (Preventive
// Maintenance / Mechanical Repair / Engine Services / ...) instead of the
// opaque "Service Category" code (CAT001), and sets the STATION from the file.
// Vehicles are NOT re-created — existing ones are matched.
// Run: DATABASE_URL="$TROVA_DATABASE_URL" node scripts/reimport-trova-services.mjs <file.xlsx>
import { PrismaClient } from "@prisma/client";
import XLSX from "xlsx";

const prisma = new PrismaClient();
const FILE = process.argv[2];
if (!FILE) { console.error("usage: node reimport-trova-services.mjs <file.xlsx>"); process.exit(1); }

const wb = XLSX.readFile(FILE, { cellDates: true });
const sheet = (name) => XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: true });
const npl = (s) => (s == null ? "" : String(s).toUpperCase().replace(/[^A-Z0-9]/g, ""));
const S = (s) => (s == null ? "" : String(s).trim());
const num = (v) => { if (v == null || v === "") return 0; const n = parseFloat(String(v).replace(/[$,]/g, "")); return isNaN(n) ? 0 : n; };
const isDate = (v) => v instanceof Date && !isNaN(v.getTime());
function toDate(v) {
  if (isDate(v)) return v;
  if (typeof v === "number") { const d = XLSX.SSF.parse_date_code(v); if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, Math.floor(d.S || 0))); }
  const s = S(v); if (!s) return null; const d = new Date(s); return isNaN(d.getTime()) ? null : d;
}
const STATION = (s) => { const u = npl(s); return u === "ORF" || u === "RNH" ? u : null; };

// Readable service columns, in priority order. The first non-empty one names
// the actual service (e.g. "PM B – Oil Change", "Tire Replacement").
const CAT_COLS = [16, 17, 18, 19, 20, 21, 22, 23];

async function main() {
  // Build lookup maps from the vehicles already in the DB.
  const vehicles = await prisma.vehicle.findMany({ select: { id: true, dxNumber: true, vin: true, licensePlate: true } });
  const byDx = new Map(), byVin = new Map(), byPlate = new Map();
  for (const v of vehicles) {
    if (v.dxNumber) byDx.set(npl(v.dxNumber), v.id);
    if (v.vin) byVin.set(v.vin.toUpperCase(), v.id);
    if (v.licensePlate) byPlate.set(npl(v.licensePlate), v.id);
  }
  const resolve = (id, vin) => {
    const n = npl(id), v = S(vin).toUpperCase();
    if (n && byDx.has(n)) return byDx.get(n);
    if (v && byVin.has(v)) return byVin.get(v);
    if (n && byPlate.has(n)) return byPlate.get(n);
    return null;
  };

  // Remove the previously imported service work orders (fresh, script-loaded).
  const del = await prisma.workOrder.deleteMany({ where: { status: "COMPLETED", type: "SCHEDULED_SERVICE" } });

  const svc = sheet("Service History").slice(1);
  let ins = 0, skip = 0, other = 0;
  const titleCounts = {};
  for (const r of svc) {
    const idRaw = S(r[1]);
    if (idRaw.toUpperCase().startsWith("ALL VEHICLE")) { skip++; continue; }
    const categoryTitle = CAT_COLS.map((c) => S(r[c])).find((x) => x !== "");
    const code = S(r[3]);
    const desc = S(r[11]);
    const isCode = /^cat\d+$/i.test(code);
    const title = (categoryTitle || (isCode ? desc || code : code || desc)).trim();
    if (!title) { skip++; continue; }
    const date = toDate(r[6]) || toDate(r[0]) || new Date();
    const cost = num(r[10]) || (num(r[9]) + num(r[8]));
    const station = STATION(r[13]) || "RNH";
    const vid = resolve(r[1], r[2]);
    const data = {
      title, description: desc || title, cost, materialCost: num(r[8]), laborCost: num(r[9]),
      odometerAt: num(r[4]) || null, vendor: S(r[5]) || null, performedBy: S(r[5]) || null,
      invoiceNumber: S(r[7]) || null, vin: S(r[2]) || null, poNumber: S(r[14]) || null,
      station, status: "COMPLETED", type: "SCHEDULED_SERVICE", priority: "MEDIUM", completedAt: date,
    };
    if (vid) data.vehicleId = vid; else { data.vehicleOther = idRaw || "Fleet-wide / unassigned"; other++; }
    await prisma.workOrder.create({ data });
    titleCounts[title] = (titleCounts[title] || 0) + 1;
    ins++;
  }
  const top = Object.entries(titleCounts).sort((a, b) => b[1] - a[1]).slice(0, 20);
  console.log(JSON.stringify({ deleted: del.count, inserted: ins, skipped: skip, unmatchedVehicle: other, distinctTitles: Object.keys(titleCounts).length, topTitles: top }, null, 2));
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
