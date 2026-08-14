// One-time TROVA data loader. Reads the WEX-style multi-sheet workbook and
// loads Vehicles / Fuel / Service / FareEye / Lease into the TROVA database.
// Run: DATABASE_URL="$TROVA_DATABASE_URL" node scripts/import-trova.mjs <file.xlsx>
import { PrismaClient } from "@prisma/client";
import XLSX from "xlsx";

const prisma = new PrismaClient();
const FILE = process.argv[2];
if (!FILE) { console.error("usage: node import-trova.mjs <file.xlsx>"); process.exit(1); }

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
function clock(v) {
  if (isDate(v)) return `${String(v.getHours()).padStart(2, "0")}:${String(v.getMinutes()).padStart(2, "0")}`;
  const s = S(v); if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})/); if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
  const n = Number(s); if (Number.isFinite(n) && n >= 0 && n < 1) { let t = Math.round(n * 1440); if (t >= 1440) t = 1439; return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; }
  return null;
}
function mins(v) { const s = S(v); if (!s) return 0; const hm = s.match(/(\d+)\s*hrs?\s*(\d+)?\s*min/i); if (hm) return parseInt(hm[1]) * 60 + parseInt(hm[2] || "0"); const c = s.match(/^(\d+):(\d+)/); if (c) return parseInt(c[1]) * 60 + parseInt(c[2]); return Math.round(num(v)); }
function pct(v) { const n = num(v); return n > 0 && n <= 1 ? Math.round(n * 10000) / 100 : n; }
const STATION = (s) => { const u = npl(s); return u === "ORF" || u === "RNH" ? u : null; };
const vehType = (t) => { const u = S(t).toUpperCase(); if (u.includes("VAN")) return "VAN"; if (u.includes("TRUCK")) return "TRUCK"; if (u.includes("CAR")) return "CAR"; return "TRUCK"; };
const fuelTypeFleet = (s) => { const u = S(s).toUpperCase(); if (u.includes("ELEC")) return "ELECTRIC"; if (u.includes("GAS")) return "GASOLINE"; return "DIESEL"; };
const vehStatus = (s) => { const u = S(s).toUpperCase(); if (u.includes("SIDELINE") || u.includes("DAMAGE") || u.includes("CRASH") || u.includes("NOT OPERAT")) return "OUT_OF_SERVICE"; return "ACTIVE"; };
const purchaseType = (s) => { const u = S(s).toUpperCase(); if (u.includes("DIESEL")) return "DIESEL"; if (u.includes("DEF")) return "DEF"; if (u.includes("UNLEAD") || u.includes("GAS") || u.includes("REG") || u.includes("E10")) return "UNLEADED"; return "UNLEADED"; };

const idKind = (id) => { const n = npl(id); if (!n) return "junk"; if (/^DX/.test(n)) return "vehicle"; if (/^\d{2}\d{3}[A-Z]{2}$/.test(n)) return "vehicle"; if (/^(RNH|ORF)/.test(n)) return "vehicle"; if (/JUNK|CARRYOUT|SPARETIRE|PENSKE/.test(n)) return "junk"; if (n.includes("SPARE")) return "spare"; if (/^[A-Z0-9]{5,8}$/.test(n) && /[A-Z]/.test(n) && /\d/.test(n)) return "vehicle"; return "junk"; };

async function main() {
  // ---------- Vehicles: Fleet List ----------
  const fleet = sheet("Fleet List").slice(1).filter((r) => S(r[4]) || S(r[5]));
  const byDx = new Map();   // normalized DX -> vehicle id
  const byVin = new Map();
  const byPlate = new Map();
  let vehCreated = 0;

  async function makeVehicle({ name, dx, vin, plate, station, type, make, model, year, fuel, status, lifecycle, offboard }) {
    const data = {
      name: name || dx || plate || vin || "UNKNOWN",
      dxNumber: dx || null,
      make: make || "UNKNOWN", model: model || "UNKNOWN", year: year || 0,
      vin: vin || `NO-VIN-${name || dx || plate}-${Math.random().toString(36).slice(2, 8)}`,
      licensePlate: plate || "",
      type: type || "VAN", status: status || "ACTIVE", fuelType: fuel || "GASOLINE",
      station: station || "RNH",
      lifecycleStatus: lifecycle || "ACTIVE",
      ...(offboard ? { offboardStatus: "COMPLETED", offboardReason: offboard, offboardedDate: new Date() } : {}),
    };
    // dxNumber & vin are unique — guard against collisions
    if (data.dxNumber && byDx.has(npl(data.dxNumber))) return byDx.get(npl(data.dxNumber));
    const v = await prisma.vehicle.create({ data });
    if (v.dxNumber) byDx.set(npl(v.dxNumber), v.id);
    if (v.vin) byVin.set(v.vin.toUpperCase(), v.id);
    if (v.licensePlate) byPlate.set(npl(v.licensePlate), v.id);
    return v.id;
  }

  for (const r of fleet) {
    const id = await makeVehicle({
      name: S(r[4]) || S(r[8]), dx: S(r[4]), vin: S(r[5]), plate: S(r[8]),
      station: STATION(r[2]), type: vehType(r[10]), make: S(r[11]), model: S(r[12]),
      year: parseInt(num(r[13])) || 0, fuel: fuelTypeFleet(r[14]), status: vehStatus(r[7]),
    });
    vehCreated++;
    // extra plate key (fleet plate may differ in dash form)
    if (S(r[8])) byPlate.set(npl(r[8]), id);
  }

  // ---------- Lease enrichment (Mike Albert) ----------
  const lease = sheet("Lease - Mike Albert").slice(1).filter((r) => S(r[5]));
  let leaseUpdated = 0, leaseNew = 0;
  for (const r of lease) {
    const vin = S(r[5]).toUpperCase();
    const leaseData = {
      leasingCompany: "Mike Albert", leaseType: "OPEN_END",
      leaseStartDate: toDate(r[21]), leaseEndDate: toDate(r[22]),
      monthsInService: parseInt(num(r[25])) || null, leaseTerm: parseInt(num(r[30])) || null,
      leaseChargePerMonth: num(r[31]) || null, totalRentPerMonth: num(r[31]) || null,
      registrationExpiry: toDate(r[43]),
    };
    if (byVin.has(vin)) {
      await prisma.vehicle.update({ where: { id: byVin.get(vin) }, data: leaseData });
      leaseUpdated++;
    } else {
      const plate = S(r[41]);
      await makeVehicle({
        name: plate || vin, vin, plate, station: "RNH", type: vehType(r[4]),
        make: S(r[1]), model: S(r[4]), year: parseInt(num(r[0])) || 0, fuel: "GASOLINE",
        status: "OUT_OF_SERVICE", lifecycle: "ARCHIVED",
        offboard: "On lease (Mike Albert) but not in current fleet list",
      });
      // apply lease fields
      await prisma.vehicle.update({ where: { id: byVin.get(vin) }, data: leaseData });
      leaseNew++;
    }
  }

  // resolve identifier -> vehicle id, auto-creating when needed
  async function resolve(id, vin, station, { active }) {
    const n = npl(id); const v = S(vin).toUpperCase();
    if (n && byDx.has(n)) return byDx.get(n);
    if (v && byVin.has(v)) return byVin.get(v);
    if (n && byPlate.has(n)) return byPlate.get(n);
    const kind = idKind(id);
    if (kind === "junk") return null;
    // auto-create
    const dxLike = /^DX/.test(n) || /^(RNH|ORF)/.test(n) || (/[A-Z]/.test(n) && /\d/.test(n) && !/^\d{2}\d{3}[A-Z]{2}$/.test(n));
    const plateLike = /^\d{2}\d{3}[A-Z]{2}$/.test(n);
    const newId = await makeVehicle({
      name: S(id).trim(), dx: dxLike ? S(id).trim() : null, vin: v || null,
      plate: plateLike ? S(id).trim() : null, station: STATION(station) || "RNH",
      type: "VAN", make: "UNKNOWN", model: "NEEDS REVIEW", year: 0, fuel: "GASOLINE",
      status: active ? "ACTIVE" : "OUT_OF_SERVICE",
      lifecycle: active ? "ACTIVE" : "ARCHIVED",
      offboard: active ? null : "Not in current fleet list — auto-created from imported fuel/service history",
    });
    vehCreated++;
    return newId;
  }

  // ---------- Fuel ----------
  const fuel = sheet("Fuel Report").slice(1).filter((r) => S(r[4]));
  let fuelIns = 0, fuelSkip = 0;
  const poolByStation = new Map();
  async function pool(station) {
    const st = STATION(station) || "RNH";
    if (poolByStation.has(st)) return poolByStation.get(st);
    const id = await makeVehicle({ name: `SPARE POOL — ${st}`, station: st, type: "VAN", make: "SPARE", model: "FUEL CARD POOL", year: 0, fuel: "GASOLINE", status: "OUT_OF_SERVICE", lifecycle: "ARCHIVED", offboard: "Spare / pool fuel cards" });
    vehCreated++; poolByStation.set(st, id); return id;
  }
  for (const r of fuel) {
    const date = toDate(r[15]) || toDate(r[17]); if (!date) { fuelSkip++; continue; }
    const gallons = num(r[20]); const cost = num(r[19]);
    let vid = await resolve(r[4], r[48], r[38], { active: false });
    if (!vid) vid = await pool(r[38]);
    const loc = [S(r[7]), S(r[10]), S(r[11])].filter(Boolean).join(", ") || null;
    await prisma.fuelLog.create({ data: {
      vehicleId: vid, driverName: S(r[3]) || null, date,
      liters: gallons, pricePerLiter: num(r[50]) || (gallons ? cost / gallons : 0), totalCost: cost,
      location: loc, transactionTime: clock(r[18]), purchaseType: purchaseType(r[26]),
    } });
    fuelIns++;
  }

  // ---------- Service History ----------
  const svc = sheet("Service History").slice(1);
  let svcIns = 0, svcSkip = 0, svcOther = 0;
  for (const r of svc) {
    let idRaw = S(r[1]);
    // "ALL VEHICLE ..." rows are aggregate rollups — skip to avoid double-counting.
    if (idRaw.toUpperCase().startsWith("ALL VEHICLE")) { svcSkip++; continue; }
    const title = S(r[3]) || S(r[11]); if (!title) { svcSkip++; continue; }
    if (!idRaw || idRaw === "0") idRaw = ""; // fleet-wide / unassigned purchase
    const date = toDate(r[6]) || toDate(r[0]) || new Date();
    const cost = num(r[10]) || num(r[9]) + num(r[8]);
    const station = STATION(r[13]);
    let vid = await resolve(r[1], r[2], r[13], { active: false });
    const data = {
      title, description: S(r[11]) || title, cost, materialCost: num(r[8]), laborCost: num(r[9]),
      odometerAt: num(r[4]) || null, vendor: S(r[5]) || null, performedBy: S(r[5]) || null,
      invoiceNumber: S(r[7]) || null, vin: S(r[2]) || null, poNumber: S(r[14]) || null,
      station: station || "RNH", status: "COMPLETED", type: "SCHEDULED_SERVICE", priority: "MEDIUM", completedAt: date,
    };
    if (vid) { data.vehicleId = vid; } else { data.vehicleOther = idRaw || "Fleet-wide / unassigned"; svcOther++; }
    await prisma.workOrder.create({ data });
    svcIns++;
  }

  // ---------- FareEye Routes ----------
  const fe = sheet("FareEye Routes").slice(1);
  let feIns = 0, feSkip = 0;
  for (const r of fe) {
    const routeId = S(r[2]); const date = toDate(r[0]);
    if (!routeId || !date) { feSkip++; continue; }
    const miles = num(r[35]) || num(r[36]);
    await prisma.fareyeRoute.create({ data: {
      date, routeId, driverName: S(r[38]) || null, miles,
      travelMinutes: mins(r[5]) || Math.round((miles / 40) * 60),
      routeDurationMinutes: mins(r[9]) || Math.round((miles / 40) * 60),
      leaveByTime: clock(r[6]), plannedEndTime: clock(r[43]) || clock(r[25]),
      stops: Math.round(num(r[16])), jobs: Math.round(num(r[7])),
      totalWeight: num(r[8]), totalPallets: Math.round(num(r[12])), totalVolume: num(r[13]),
      vehicleCapacity: num(r[10]), weightCapacityUtil: pct(r[11]), palletsCapacityUtil: pct(r[19]),
      volumetricCapacityUtil: pct(r[20]), vehicleType: S(r[18]) || "VAN", vehicleTag: S(r[17]) || null,
      vehicleUtilization: pct(r[22]), shiftUtilization: pct(r[21]), sporh: num(r[24]),
      plannedHours: num(r[34]), breakDuration: mins(r[14]), waitingTime: mins(r[15]),
      totalLoadingTime: mins(r[23]), totalRuns: Math.round(num(r[30])), cost: num(r[31]),
      co2Emit: num(r[29]), serviceProvider: S(r[32]) || null, station: STATION(r[1]) || "RNH",
    } });
    feIns++;
  }

  console.log(JSON.stringify({
    vehicles: { fleet: fleet.length, leaseUpdated, leaseNew, totalCreated: vehCreated },
    fuel: { inserted: fuelIns, skipped: fuelSkip },
    service: { inserted: svcIns, skipped: svcSkip, unmatchedToVehicleOther: svcOther },
    fareye: { inserted: feIns, skipped: feSkip },
  }, null, 2));
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
