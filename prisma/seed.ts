import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

// ----- helpers -----
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function randInt(min: number, max: number) {
  return Math.floor(rand(min, max + 1));
}
function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

// Texas operating region
const CITY_POINTS: Record<string, { lat: number; lng: number }> = {
  "IAH Depot - Houston": { lat: 29.9844, lng: -95.3414 },
  "AUS Hub - Austin": { lat: 30.2672, lng: -97.7431 },
  "HRL Yard - Harlingen": { lat: 26.1906, lng: -97.6961 },
  "LRD Stop - Laredo": { lat: 27.5036, lng: -99.5076 },
  "ACT Stop - Waco": { lat: 31.5493, lng: -97.1467 },
  "CLL Warehouse - College Station": { lat: 30.6280, lng: -96.3344 },
  "BPT Plant - Beaumont": { lat: 30.0802, lng: -94.1266 },
  "San Antonio Client": { lat: 29.4241, lng: -98.4936 },
};
const PLACE_NAMES = Object.keys(CITY_POINTS);

const FIRST = [
  "James", "Maria", "Robert", "Linda", "Michael", "Patricia", "David",
  "Jennifer", "Carlos", "Aisha", "Wei", "Sofia", "Omar", "Grace", "Hassan",
  "Elena", "Tyrone", "Nina", "Diego", "Priya",
];
const LAST = [
  "Smith", "Johnson", "Williams", "Brown", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Chen", "Khan", "Nguyen", "Okafor", "Patel",
  "Silva", "Kim", "Lopez", "Adams", "Ferreira", "Singh",
];

const STATIONS = ["AUS", "ACT", "IAH", "CLL", "BPT", "HRL", "LRD"] as const;
type StationCode = (typeof STATIONS)[number];

// Service catalog: each service tracks a default Material Cost + Labor cost.
type ServiceDef = {
  name: string;
  category: "PREVENTIVE" | "CORRECTIVE";
  group: string;
  material: number;
  labor: number;
};
const SERVICE_CATALOG: ServiceDef[] = [
  // ----- Preventive -----
  { name: "Brake Pad Replacement", category: "PREVENTIVE", group: "Brakes & Tires", material: 180, labor: 150 },
  { name: "Brake Rotor Replacement", category: "PREVENTIVE", group: "Brakes & Tires", material: 320, labor: 200 },
  { name: "Air Brake Cleaning", category: "PREVENTIVE", group: "Brakes & Tires", material: 40, labor: 120 },
  { name: "Tire Rotation", category: "PREVENTIVE", group: "Brakes & Tires", material: 0, labor: 80 },
  { name: "Tire Pressure Check / Fill", category: "PREVENTIVE", group: "Brakes & Tires", material: 0, labor: 25 },
  { name: "Tire Replacement", category: "PREVENTIVE", group: "Brakes & Tires", material: 1200, labor: 200 },
  { name: "PM A – Basic Oil Change & Inspection", category: "PREVENTIVE", group: "PM Packages", material: 90, labor: 110 },
  { name: "PM B – Oil Change + Filters + Tire Rotation", category: "PREVENTIVE", group: "PM Packages", material: 160, labor: 180 },
  { name: "PM C – Full Preventive Maintenance", category: "PREVENTIVE", group: "PM Packages", material: 380, labor: 400 },
  { name: "Brake Caliper Replacement", category: "PREVENTIVE", group: "Brakes & Tires", material: 260, labor: 180 },
  { name: "Drivetrain Overhaul PM", category: "PREVENTIVE", group: "Drivetrain & Engine", material: 1500, labor: 1200 },
  { name: "Transmission Fluid PM", category: "PREVENTIVE", group: "Drivetrain & Engine", material: 180, labor: 150 },
  { name: "Coolant + Spark Plugs PM", category: "PREVENTIVE", group: "Drivetrain & Engine", material: 160, labor: 180 },
  { name: "Timing Belt PM", category: "PREVENTIVE", group: "Drivetrain & Engine", material: 320, labor: 450 },
  { name: "Diesel Filter Cleaning PM", category: "PREVENTIVE", group: "Drivetrain & Engine", material: 120, labor: 130 },
  { name: "Engine Air Filter PM", category: "PREVENTIVE", group: "Drivetrain & Engine", material: 60, labor: 50 },
  { name: "Battery Test", category: "PREVENTIVE", group: "Electrical", material: 0, labor: 40 },
  { name: "Battery Replacement", category: "PREVENTIVE", group: "Electrical", material: 220, labor: 80 },
  { name: "Fluid Check / Fill up", category: "PREVENTIVE", group: "General", material: 40, labor: 50 },
  { name: "Wiper Blades", category: "PREVENTIVE", group: "General", material: 35, labor: 25 },
  { name: "Turbocharger Inspection PM", category: "PREVENTIVE", group: "Drivetrain & Engine", material: 0, labor: 160 },
  // ----- Corrective: Mechanical Repairs -----
  { name: "Suspension Repair", category: "CORRECTIVE", group: "Mechanical Repairs", material: 620, labor: 480 },
  { name: "Steering Repair", category: "CORRECTIVE", group: "Mechanical Repairs", material: 540, labor: 420 },
  { name: "Radiator / Cooling System Repair", category: "CORRECTIVE", group: "Mechanical Repairs", material: 480, labor: 360 },
  { name: "Fuel System Repair", category: "CORRECTIVE", group: "Mechanical Repairs", material: 560, labor: 440 },
  { name: "Transmission Service", category: "CORRECTIVE", group: "Mechanical Repairs", material: 900, labor: 700 },
  { name: "Exhaust System Repair", category: "CORRECTIVE", group: "Mechanical Repairs", material: 420, labor: 300 },
  { name: "Alternator Replacement", category: "CORRECTIVE", group: "Mechanical Repairs", material: 380, labor: 220 },
  { name: "Starter Replacement", category: "CORRECTIVE", group: "Mechanical Repairs", material: 340, labor: 200 },
  // ----- Corrective: Engine Services -----
  { name: "Engine Oil & Filter Change", category: "CORRECTIVE", group: "Engine Services", material: 90, labor: 90 },
  { name: "Spark Plug Replacement", category: "CORRECTIVE", group: "Engine Services", material: 120, labor: 150 },
  { name: "Timing Belt / Chain Replacement", category: "CORRECTIVE", group: "Engine Services", material: 360, labor: 520 },
  { name: "Engine Diagnostics (Check Engine Light)", category: "CORRECTIVE", group: "Engine Services", material: 0, labor: 140 },
  { name: "Air Intake Cleaning", category: "CORRECTIVE", group: "Engine Services", material: 60, labor: 110 },
  { name: "Purge Valve", category: "CORRECTIVE", group: "Engine Services", material: 140, labor: 120 },
  { name: "Throttle Body Service", category: "CORRECTIVE", group: "Engine Services", material: 160, labor: 160 },
  { name: "Engine Repair", category: "CORRECTIVE", group: "Engine Services", material: 2200, labor: 1800 },
  { name: "New Engine", category: "CORRECTIVE", group: "Engine Services", material: 9500, labor: 3500 },
  { name: "DEF System", category: "CORRECTIVE", group: "Engine Services", material: 680, labor: 420 },
  { name: "DEF Tank Repair", category: "CORRECTIVE", group: "Engine Services", material: 520, labor: 360 },
  { name: "Turbo / Actuator", category: "CORRECTIVE", group: "Engine Services", material: 1400, labor: 700 },
  { name: "Catalytic Converter", category: "CORRECTIVE", group: "Engine Services", material: 1300, labor: 400 },
  { name: "Muffler", category: "CORRECTIVE", group: "Engine Services", material: 320, labor: 220 },
  // ----- Corrective: Electrical Repairs -----
  { name: "Headlight / Taillight Replacement", category: "CORRECTIVE", group: "Electrical Repairs", material: 140, labor: 80 },
  { name: "Interior Light Repair", category: "CORRECTIVE", group: "Electrical Repairs", material: 40, labor: 60 },
  { name: "Power Door Locks / Windows Repair", category: "CORRECTIVE", group: "Electrical Repairs", material: 220, labor: 180 },
  { name: "ECU / Module Diagnostics", category: "CORRECTIVE", group: "Electrical Repairs", material: 0, labor: 180 },
  { name: "Wiring Inspection", category: "CORRECTIVE", group: "Electrical Repairs", material: 0, labor: 150 },
  // ----- Corrective: A/C & Heating -----
  { name: "A/C System Check", category: "CORRECTIVE", group: "A/C & Heating", material: 0, labor: 90 },
  { name: "A/C Recharge", category: "CORRECTIVE", group: "A/C & Heating", material: 120, labor: 110 },
  { name: "Heater Repair", category: "CORRECTIVE", group: "A/C & Heating", material: 280, labor: 240 },
  { name: "Cabin Air Filter Replacement", category: "CORRECTIVE", group: "A/C & Heating", material: 45, labor: 50 },
  { name: "A/C Full repair", category: "CORRECTIVE", group: "A/C & Heating", material: 620, labor: 480 },
  // ----- Corrective: Cosmetic / Utility -----
  { name: "Vehicle Wash", category: "CORRECTIVE", group: "Cosmetic / Utility", material: 0, labor: 40 },
  { name: "Interior Detail", category: "CORRECTIVE", group: "Cosmetic / Utility", material: 30, labor: 120 },
  { name: "Decal / Sticker Application", category: "CORRECTIVE", group: "Cosmetic / Utility", material: 180, labor: 140 },
  { name: "Samsara Device Install / Uninstall", category: "CORRECTIVE", group: "Cosmetic / Utility", material: 250, labor: 150 },
  { name: "Key Replacement or Programming", category: "CORRECTIVE", group: "Cosmetic / Utility", material: 220, labor: 130 },
  { name: "Body service - Fix Damage, Dent and Paint", category: "CORRECTIVE", group: "Cosmetic / Utility", material: 700, labor: 900 },
  { name: "Doors - Panel and Latch", category: "CORRECTIVE", group: "Cosmetic / Utility", material: 380, labor: 320 },
  { name: "Rollers - Fix Roller Bed", category: "CORRECTIVE", group: "Cosmetic / Utility", material: 460, labor: 380 },
  { name: "Windshield Replacement", category: "CORRECTIVE", group: "Cosmetic / Utility", material: 420, labor: 220 },
  { name: "Replace Part - Bumper, headlight, Trims, etc", category: "CORRECTIVE", group: "Cosmetic / Utility", material: 540, labor: 300 },
  // ----- Corrective: Admin, Accidents & Insurance Claim -----
  { name: "Registration Renewal", category: "CORRECTIVE", group: "Admin, Accidents & Insurance Claim", material: 0, labor: 60 },
  { name: "Emissions / Smog Test", category: "CORRECTIVE", group: "Admin, Accidents & Insurance Claim", material: 0, labor: 70 },
  { name: "Insurance Photo Inspection", category: "CORRECTIVE", group: "Admin, Accidents & Insurance Claim", material: 0, labor: 50 },
  { name: "Accident Claim Inspection", category: "CORRECTIVE", group: "Admin, Accidents & Insurance Claim", material: 0, labor: 120 },
  { name: "Vehicle Turn-in Inspection", category: "CORRECTIVE", group: "Admin, Accidents & Insurance Claim", material: 0, labor: 140 },
  // ----- Corrective: Safety & Compliance -----
  { name: "DOT Annual Inspection", category: "CORRECTIVE", group: "Safety & Compliance", material: 0, labor: 220 },
  { name: "Monthly Safety Inspection", category: "CORRECTIVE", group: "Safety & Compliance", material: 0, labor: 90 },
  { name: "Brake Inspection", category: "CORRECTIVE", group: "Safety & Compliance", material: 0, labor: 110 },
  { name: "Light & Signal Inspection", category: "CORRECTIVE", group: "Safety & Compliance", material: 0, labor: 70 },
  { name: "Windshield Wiper Replacement", category: "CORRECTIVE", group: "Safety & Compliance", material: 35, labor: 30 },
  { name: "First Aid / Fire Extinguisher Check", category: "CORRECTIVE", group: "Safety & Compliance", material: 25, labor: 40 },
];

async function main() {
  console.log("🌱 Seeding fleet database...");

  // wipe (order matters for FKs)
  await prisma.fareyeRoute.deleteMany();
  await prisma.pmBudget.deleteMany();
  await prisma.workOrderRequest.deleteMany();
  await prisma.telemetryLog.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.fuelLog.deleteMany();
  await prisma.maintenanceSchedule.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.service.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.user.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.geofence.deleteMany();

  // ----- geofences -----
  const fenceDefs: Array<{ name: string; type: "DEPOT" | "CUSTOMER" | "SERVICE" | "RESTRICTED"; key: string; radius: number; color: string }> = [
    { name: "IAH Depot - Houston", type: "DEPOT", key: "IAH Depot - Houston", radius: 700, color: "#2563eb" },
    { name: "AUS Hub - Austin", type: "DEPOT", key: "AUS Hub - Austin", radius: 650, color: "#7c3aed" },
    { name: "HRL Yard - Harlingen", type: "SERVICE", key: "HRL Yard - Harlingen", radius: 800, color: "#0891b2" },
    { name: "San Antonio Client", type: "CUSTOMER", key: "San Antonio Client", radius: 400, color: "#16a34a" },
    { name: "BPT Plant - Beaumont", type: "RESTRICTED", key: "BPT Plant - Beaumont", radius: 500, color: "#dc2626" },
  ];
  for (const f of fenceDefs) {
    const p = CITY_POINTS[f.key];
    await prisma.geofence.create({
      data: {
        name: f.name,
        type: f.type,
        centerLat: p.lat,
        centerLng: p.lng,
        radiusM: f.radius,
        color: f.color,
      },
    });
  }

  // ----- service catalog -----
  const services: Awaited<ReturnType<typeof prisma.service.create>>[] = [];
  for (const s of SERVICE_CATALOG) {
    const svc = await prisma.service.create({
      data: {
        name: s.name,
        category: s.category,
        group: s.group,
        materialCost: s.material,
        laborCost: s.labor,
      },
    });
    services.push(svc);
  }

  // ----- drivers -----
  const driverColors = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#65a30d"];
  const drivers = [];
  const DRIVER_COUNT = 14;
  for (let i = 0; i < DRIVER_COUNT; i++) {
    const first = FIRST[i % FIRST.length];
    const last = LAST[i % LAST.length];
    const d = await prisma.driver.create({
      data: {
        firstName: first,
        lastName: last,
        email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@livefleet.ai`,
        phone: `+1 (415) 555-0${randInt(100, 999)}`,
        licenseNumber: `CA-${randInt(100000, 999999)}`,
        licenseClass: pick(["A", "B", "C"]),
        licenseExpiry: daysFromNow(randInt(-20, 900)),
        status: pick(["ACTIVE", "ACTIVE", "ACTIVE", "ON_TRIP", "OFF_DUTY", "INACTIVE"]),
        hireDate: daysFromNow(-randInt(60, 2200)),
        rating: Math.round(rand(3.2, 5) * 10) / 10,
        safetyScore: randInt(58, 99),
        avatarColor: driverColors[i % driverColors.length],
      },
    });
    drivers.push(d);
  }

  // ----- users -----
  const adminPass = await bcrypt.hash("admin123", 10);
  const mgrPass = await bcrypt.hash("manager123", 10);
  const drvPass = await bcrypt.hash("driver123", 10);
  await prisma.user.create({
    data: { email: "admin@livefleet.ai", name: "Alex Admin", role: "ADMIN", passwordHash: adminPass },
  });
  await prisma.user.create({
    data: { email: "manager@livefleet.ai", name: "Morgan Manager", role: "MANAGER", passwordHash: mgrPass },
  });
  await prisma.user.create({
    data: {
      email: "driver@livefleet.ai",
      name: `${drivers[0].firstName} ${drivers[0].lastName}`,
      role: "DRIVER",
      passwordHash: drvPass,
      driverId: drivers[0].id,
    },
  });

  // ----- vehicles (from real fleet data) -----
  type FleetRow = {
    dxNumber: string;
    licensePlate: string;
    vin: string;
    status: string;
    year: number;
    make: string;
    model: string;
    station: string;
    type: string;
    leasingCompany: string | null;
    samsaraId: string | null;
    tollEnabled: boolean;
    odometer: number;
    onboardedDate: string | null;
    leaseEndDate: string | null;
    registrationMonth: string | null;
  };
  const fleetData: FleetRow[] = JSON.parse(
    readFileSync(join(__dirname, "fleet-data.json"), "utf-8"),
  );

  // Station center coordinates for telemetry scatter
  const STATION_COORDS: Record<string, { lat: number; lng: number }> = {
    IAH: { lat: 29.9844, lng: -95.3414 },
    AUS: { lat: 30.2672, lng: -97.7431 },
    HRL: { lat: 26.1906, lng: -97.6961 },
    LRD: { lat: 27.5036, lng: -99.5076 },
    ACT: { lat: 31.5493, lng: -97.1467 },
    CLL: { lat: 30.6280, lng: -96.3344 },
    BPT: { lat: 30.0802, lng: -94.1266 },
  };

  // Fuel type heuristic from make/model
  function guessFuel(make: string, model: string): "DIESEL" | "GASOLINE" | "ELECTRIC" | "HYBRID" | "CNG" {
    const m = `${make} ${model}`.toLowerCase();
    if (m.includes("freightliner") || m.includes("international") || m.includes("peterbilt") || m.includes("f650") || m.includes("f-650")) return "DIESEL";
    return "GASOLINE";
  }

  // Tank capacity heuristic
  function guessTank(type: string, fuel: string): number {
    if (fuel === "ELECTRIC") return 0;
    if (type === "TRUCK") return 380;
    return 90; // Van
  }

  const vehicles = [];
  for (const row of fleetData) {
    const stationKey = STATIONS.includes(row.station as StationCode) ? row.station : "IAH";
    const statusVal = (row.status === "ACTIVE" ? "ACTIVE" : "OUT_OF_SERVICE") as "ACTIVE" | "IDLE" | "MAINTENANCE" | "OUT_OF_SERVICE";
    const vType = (row.type === "TRUCK" ? "TRUCK" : "VAN") as "TRUCK" | "VAN";
    const fuel = guessFuel(row.make, row.model);
    const tank = guessTank(row.type, fuel);
    const isMoving = statusVal === "ACTIVE" && Math.random() > 0.5;
    const coords = STATION_COORDS[stationKey] ?? STATION_COORDS.IAH;
    const assigned = statusVal === "OUT_OF_SERVICE" ? null : pick(drivers);

    const v = await prisma.vehicle.create({
      data: {
        name: row.dxNumber,
        dxNumber: row.dxNumber,
        make: row.make,
        model: row.model,
        year: row.year,
        vin: row.vin,
        licensePlate: row.licensePlate,
        type: vType,
        status: statusVal,
        fuelType: fuel,
        odometer: row.odometer,
        fuelLevel: fuel === "ELECTRIC" ? randInt(15, 100) : randInt(8, 100),
        tankCapacity: tank,
        station: stationKey as StationCode,
        leasingCompany: row.leasingCompany,
        samsaraId: row.samsaraId,
        onboardedDate: row.onboardedDate ? new Date(row.onboardedDate) : null,
        leaseEndDate: row.leaseEndDate ? new Date(row.leaseEndDate) : null,
        registrationMonth: row.registrationMonth,
        registrationExpiry: row.registrationMonth
          ? (() => {
              const monthMap: Record<string, number> = { January: 0, February: 1, March: 2, April: 3, May: 4, June: 5, July: 6, August: 7, September: 8, October: 9, November: 10, December: 11 };
              const m = monthMap[row.registrationMonth];
              // Registration month = issue date; expires 12 months later
              return m !== undefined ? new Date(2027, m, 28) : null;
            })()
          : null,
        insuranceExpiry: new Date("2026-10-31"),
        lat: coords.lat + rand(-0.05, 0.05),
        lng: coords.lng + rand(-0.05, 0.05),
        heading: rand(0, 360),
        speed: isMoving ? randInt(15, 75) : 0,
        engineOn: isMoving,
        lastSeen: new Date(Date.now() - randInt(0, 600) * 1000),
        assignedDriverId: assigned?.id ?? null,
      },
    });
    vehicles.push(v);
  }

  // ----- trips -----
  const cargoTypes = ["Electronics", "Groceries", "Furniture", "Auto parts", "Medical supplies", "Apparel", "Construction materials", "Beverages"];
  for (let i = 0; i < 40; i++) {
    const v = pick(vehicles);
    const oKey = pick(PLACE_NAMES);
    let dKey = pick(PLACE_NAMES);
    while (dKey === oKey) dKey = pick(PLACE_NAMES);
    const o = CITY_POINTS[oKey];
    const d = CITY_POINTS[dKey];
    const status = pick(["SCHEDULED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "COMPLETED", "COMPLETED", "CANCELLED"]) as
      "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    const scheduledStart =
      status === "SCHEDULED" ? daysFromNow(rand(0, 10)) : daysFromNow(-rand(0, 30));
    await prisma.trip.create({
      data: {
        vehicleId: v.id,
        driverId: v.assignedDriverId ?? pick(drivers).id,
        origin: oKey,
        destination: dKey,
        originLat: o.lat,
        originLng: o.lng,
        destLat: d.lat,
        destLng: d.lng,
        status,
        scheduledStart,
        startedAt: status === "SCHEDULED" ? null : scheduledStart,
        endedAt: status === "COMPLETED" ? new Date(scheduledStart.getTime() + randInt(1, 6) * 3600 * 1000) : null,
        distanceKm: Math.round(rand(8, 120)),
        cargo: pick(cargoTypes),
      },
    });
  }

  // ----- work orders from real service history -----
  type SvcRow = {
    dxNumber: string;
    vin: string | null;
    serviceType: string | null;
    odometer: number;
    provider: string | null;
    date: string | null;
    invoiceNumber: string | null;
    materialCost: number;
    serviceCost: number;
    totalCost: number;
    description: string | null;
    station: string | null;
    poNumber: string | null;
    category: string | null;
    subcategory: string | null;
  };
  const svcHistory: SvcRow[] = JSON.parse(
    readFileSync(join(__dirname, "services-history.json"), "utf-8"),
  );
  const vehicleByDx = new Map(vehicles.map((v) => [v.dxNumber, v]));
  const serviceByName = new Map(services.map((s) => [s.name, s]));

  function typeForService(s: (typeof services)[number]): "SCHEDULED_SERVICE" | "REPAIR" | "INSPECTION" | "TIRE" | "OIL_CHANGE" | "RECALL" {
    const n = s.name.toLowerCase();
    if (n.includes("tire")) return "TIRE";
    if (n.includes("oil")) return "OIL_CHANGE";
    if (n.includes("inspection") || n.includes("test") || n.includes("diagnostic")) return "INSPECTION";
    if (s.category === "PREVENTIVE") return "SCHEDULED_SERVICE";
    return "REPAIR";
  }

  let woImported = 0;
  for (const row of svcHistory) {
    const vehicle = vehicleByDx.get(row.dxNumber);
    if (!vehicle) continue;
    const svc = row.subcategory ? serviceByName.get(row.subcategory) : null;
    const stationKey = row.station ?? vehicle.station;
    const validStations = ["IAH", "AUS", "HRL", "LRD", "CLL", "BPT", "ACT"];
    const station = validStations.includes(stationKey) ? stationKey : vehicle.station;
    const completedAt = row.date ? new Date(row.date) : new Date();

    await prisma.workOrder.create({
      data: {
        vehicleId: vehicle.id,
        serviceId: svc?.id ?? null,
        station: station as StationCode,
        type: svc ? typeForService(svc) : "OIL_CHANGE",
        title: row.subcategory ?? row.serviceType ?? "Service",
        description: row.description ?? null,
        status: "COMPLETED",
        priority: "MEDIUM",
        materialCost: row.materialCost,
        laborHours: 0,
        laborRate: 0,
        laborCost: row.serviceCost,
        cost: row.totalCost,
        performedBy: null,
        odometerAt: row.odometer,
        vendor: row.provider,
        vin: row.vin ?? vehicle.vin,
        poNumber: row.poNumber,
        invoiceNumber: row.invoiceNumber,
        completedAt,
        createdAt: completedAt,
      },
    });
    woImported++;
  }

  // Add a few currently-open/scheduled work orders for the maintenance board
  for (const v of vehicles.slice(0, 40)) {
    const s = pick(services);
    const status = pick(["OPEN", "SCHEDULED", "IN_PROGRESS"]) as "OPEN" | "SCHEDULED" | "IN_PROGRESS";
    await prisma.workOrder.create({
      data: {
        vehicleId: v.id,
        serviceId: s.id,
        station: v.station,
        type: typeForService(s),
        title: s.name,
        description: `${s.category === "PREVENTIVE" ? "Preventive" : "Corrective"} — ${s.group}`,
        status,
        priority: pick(["LOW", "MEDIUM", "HIGH"]),
        materialCost: Math.round(s.materialCost * rand(0.8, 1.25)),
        odometerAt: v.odometer,
        vendor: "Take5",
        scheduledFor: daysFromNow(randInt(1, 30)),
      },
    });
  }

  // Recurring maintenance schedules
  for (const v of vehicles) {
    await prisma.maintenanceSchedule.create({
      data: {
        vehicleId: v.id,
        taskName: "Oil change",
        intervalKm: 12000,
        intervalDays: 180,
        lastServiceOdo: v.odometer - randInt(2000, 11000),
        lastServiceDate: daysFromNow(-randInt(10, 170)),
        nextDueOdo: v.odometer + randInt(500, 4000),
        nextDueDate: daysFromNow(randInt(-5, 90)),
      },
    });
  }

  console.log(`  Imported ${woImported} real service history work orders`);

  // ----- fuel logs (real data from Fuel.xlsx) -----
  type FuelRow = {
    dxNumber: string;
    date: string | null;
    gallons: number;
    pricePerGallon: number;
    totalCost: number;
    location: string | null;
    station: string;
    purchaseType: "UNLEADED" | "DIESEL" | "DEF" | "NON_FUEL";
    driverName: string | null;
    productDesc: string | null;
  };
  const fuelRows: FuelRow[] = JSON.parse(
    readFileSync(join(__dirname, "data", "fuel-data.json"), "utf-8"),
  );
  let fuelImported = 0;
  const vehicleByDxFuel = new Map(vehicles.map((v) => [v.dxNumber, v]));
  for (const f of fuelRows) {
    const vehicle = vehicleByDxFuel.get(f.dxNumber);
    if (!vehicle || !f.date) continue;
    await prisma.fuelLog.create({
      data: {
        vehicleId: vehicle.id,
        driverId: vehicle.assignedDriverId,
        date: new Date(f.date),
        liters: f.gallons,
        pricePerLiter: f.pricePerGallon,
        totalCost: f.totalCost,
        odometer: vehicle.odometer - randInt(0, 3000),
        location: f.location,
        purchaseType: f.purchaseType,
      },
    });
    fuelImported++;
  }
  console.log(`  Imported ${fuelImported} real fuel logs (of ${fuelRows.length} total)`);

  // ----- alerts -----
  const now = Date.now();
  for (let i = 0; i < 22; i++) {
    const v = pick(vehicles);
    const type = pick([
      "SPEEDING", "GEOFENCE_ENTER", "GEOFENCE_EXIT", "MAINTENANCE_DUE",
      "DOCUMENT_EXPIRY", "LOW_FUEL", "IDLE", "HARSH_DRIVING",
    ]) as "SPEEDING" | "GEOFENCE_ENTER" | "GEOFENCE_EXIT" | "MAINTENANCE_DUE" | "DOCUMENT_EXPIRY" | "LOW_FUEL" | "IDLE" | "HARSH_DRIVING";
    const messages: Record<string, string> = {
      SPEEDING: `${v.name} exceeded speed limit (${randInt(78, 96)} mph in a 65 zone)`,
      GEOFENCE_ENTER: `${v.name} entered geofence "IAH Depot - Houston"`,
      GEOFENCE_EXIT: `${v.name} left geofence "AUS Hub - Austin"`,
      MAINTENANCE_DUE: `${v.name} is due for scheduled service`,
      DOCUMENT_EXPIRY: `${v.name} registration expires soon`,
      LOW_FUEL: `${v.name} fuel level below 15%`,
      IDLE: `${v.name} idling for over 20 minutes`,
      HARSH_DRIVING: `${v.name} harsh braking event detected`,
    };
    const severity = (
      type === "SPEEDING" || type === "HARSH_DRIVING" || type === "DOCUMENT_EXPIRY"
    ) ? "CRITICAL" : type === "IDLE" || type === "GEOFENCE_ENTER" || type === "GEOFENCE_EXIT" ? "INFO" : "WARNING";
    await prisma.alert.create({
      data: {
        type,
        severity: severity as "INFO" | "WARNING" | "CRITICAL",
        message: messages[type],
        vehicleId: v.id,
        driverId: v.assignedDriverId,
        read: Math.random() > 0.6,
        createdAt: new Date(now - randInt(0, 72) * 3600 * 1000),
      },
    });
  }

  // ----- work order requests (approval workflow demo) -----
  await prisma.workOrderRequest.deleteMany();
  const allUsers = await prisma.user.findMany();
  const driverUser = allUsers.find((u) => u.role === "DRIVER");
  const managerUser = allUsers.find((u) => u.role === "MANAGER");
  const adminUser = allUsers.find((u) => u.role === "ADMIN");
  const requesters = [driverUser, managerUser, adminUser].filter(Boolean) as typeof allUsers;
  const partsPool = [
    "Brake pads", "Oil filter", "Air filter", "Spark plugs", "Wiper blades",
    "Cabin filter", "Timing belt", "Serpentine belt", "Battery", "Coolant",
    "Transmission fluid", "Brake rotors", "Alternator", "Starter motor",
  ];
  // PO number prefix mapping and starting sequences (numbers below start are "already used")
  const PO_PREFIX: Record<string, string> = { IAH: "IA", AUS: "AU", HRL: "HR", ACT: "AC", LRD: "LR", CLL: "CL", BPT: "BP" };
  const poCounters: Record<string, number> = { IAH: 265, AUS: 286, HRL: 174, ACT: 34, LRD: 11, CLL: 31, BPT: 7 };
  for (let i = 0; i < 8; i++) {
    const v = pick(vehicles);
    const s = pick(services);
    const requester = pick(requesters);
    const partCount = randInt(1, 3);
    const parts: string[] = [];
    for (let p = 0; p < partCount; p++) {
      const part = pick(partsPool);
      if (!parts.includes(part)) parts.push(part);
    }
    const status = i < 5 ? "PENDING" : pick(["APPROVED", "REJECTED"]) as "APPROVED" | "REJECTED";
    const reviewer = status !== "PENDING" ? (adminUser ?? managerUser) : null;
    const stationKey = v.station as string;
    const prefix = PO_PREFIX[stationKey] ?? stationKey.slice(0, 2);
    const seq = (poCounters[stationKey] ?? 1);
    poCounters[stationKey] = seq + 1;
    const poNumber = `${prefix}${String(seq).padStart(3, "0")}`;
    await prisma.workOrderRequest.create({
      data: {
        poNumber,
        station: v.station,
        vehicleId: v.id,
        odometer: v.odometer - randInt(0, 2000),
        serviceId: s.id,
        partsNeeded: parts.join(", "),
        requestedDate: daysFromNow(randInt(1, 14)),
        expectedCompletion: daysFromNow(randInt(7, 30)),
        comments: `Request for ${s.name} on ${v.name}`,
        serviceHours: Math.round(rand(1, 8) * 10) / 10,
        vendorEstimate: Math.round(rand(100, 3000)),
        status,
        requestedById: requester.id,
        reviewedById: reviewer?.id ?? null,
        reviewNote: status === "REJECTED" ? "Budget constraints — defer to next quarter." : status === "APPROVED" ? "Approved. Proceed." : null,
        reviewedAt: status !== "PENDING" ? daysFromNow(-randInt(0, 3)) : null,
      },
    });
  }

  // ----- PM budgets -----
  type BudgetRow = { year: number; month: number; station: string; category: string; amount: number };
  const budgetRows: BudgetRow[] = JSON.parse(
    readFileSync(join(__dirname, "pm-budgets.json"), "utf-8"),
  );
  for (const b of budgetRows) {
    await prisma.pmBudget.create({
      data: {
        year: b.year,
        month: b.month,
        station: b.station as "IAH" | "AUS" | "HRL" | "LRD" | "ACT" | "CLL" | "BPT",
        category: b.category,
        amount: b.amount,
      },
    });
  }
  console.log(`  Imported ${budgetRows.length} PM budget records`);

  // ----- FareEye routes -----
  type FareyeRow = { date: string; routeId: string; miles: number; travelMinutes: number; routeDurationMinutes: number; leaveByTime: string | null; plannedEndTime: string | null; stops: number; totalWeight: number; totalPallets: number; vehicleType: string; vehicleTag: string | null; vehicleUtilization: number; sporh: number; plannedHours: number; lat: number | null; lng: number | null; station: string };
  const fareyeRows: FareyeRow[] = JSON.parse(
    readFileSync(join(__dirname, "fareye-routes.json"), "utf-8"),
  );
  for (const r of fareyeRows) {
    await prisma.fareyeRoute.create({
      data: {
        date: new Date(r.date),
        routeId: r.routeId,
        miles: r.miles,
        travelMinutes: r.travelMinutes,
        routeDurationMinutes: r.routeDurationMinutes,
        leaveByTime: r.leaveByTime,
        plannedEndTime: r.plannedEndTime,
        stops: r.stops,
        totalWeight: r.totalWeight,
        totalPallets: r.totalPallets,
        vehicleType: r.vehicleType,
        vehicleTag: r.vehicleTag,
        vehicleUtilization: r.vehicleUtilization,
        sporh: r.sporh,
        plannedHours: r.plannedHours,
        lat: r.lat,
        lng: r.lng,
        station: r.station as "IAH" | "AUS" | "HRL" | "LRD" | "ACT" | "CLL" | "BPT",
      },
    });
  }
  console.log(`  Imported ${fareyeRows.length} FareEye route records`);

  console.log(
    `✅ Seeded: ${vehicles.length} vehicles, ${drivers.length} drivers, ${services.length} services, 40 trips, work orders, fuel logs, alerts, ${fenceDefs.length} geofences, 8 WO requests.`,
  );
  console.log("👤 Logins: admin@livefleet.ai / admin123 · manager@livefleet.ai / manager123 · driver@livefleet.ai / driver123");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
