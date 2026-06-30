import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

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

// San Francisco Bay Area as the operating region
const CENTER = { lat: 37.7749, lng: -122.4194 };
const CITY_POINTS: Record<string, { lat: number; lng: number }> = {
  "Downtown SF Depot": { lat: 37.7793, lng: -122.4193 },
  "Oakland Hub": { lat: 37.8044, lng: -122.2712 },
  "San Jose Yard": { lat: 37.3382, lng: -121.8863 },
  "Daly City Stop": { lat: 37.6879, lng: -122.4702 },
  "Berkeley Stop": { lat: 37.8715, lng: -122.273 },
  "Fremont Warehouse": { lat: 37.5485, lng: -121.9886 },
  "Palo Alto Client": { lat: 37.4419, lng: -122.143 },
  "Richmond Plant": { lat: 37.9358, lng: -122.3477 },
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

const VEHICLE_MODELS: Array<{
  make: string;
  model: string;
  type: "TRUCK" | "VAN" | "CAR" | "BUS" | "PICKUP" | "TRAILER";
  fuel: "DIESEL" | "GASOLINE" | "ELECTRIC" | "HYBRID" | "CNG";
  tank: number;
}> = [
  { make: "Freightliner", model: "Cascadia", type: "TRUCK", fuel: "DIESEL", tank: 380 },
  { make: "Volvo", model: "VNL 760", type: "TRUCK", fuel: "DIESEL", tank: 400 },
  { make: "Ford", model: "Transit", type: "VAN", fuel: "GASOLINE", tank: 90 },
  { make: "Mercedes-Benz", model: "Sprinter", type: "VAN", fuel: "DIESEL", tank: 93 },
  { make: "Tesla", model: "Semi", type: "TRUCK", fuel: "ELECTRIC", tank: 0 },
  { make: "Rivian", model: "EDV 700", type: "VAN", fuel: "ELECTRIC", tank: 0 },
  { make: "Ford", model: "F-150 Lightning", type: "PICKUP", fuel: "ELECTRIC", tank: 0 },
  { make: "Toyota", model: "Prius", type: "CAR", fuel: "HYBRID", tank: 43 },
  { make: "Chevrolet", model: "Silverado", type: "PICKUP", fuel: "GASOLINE", tank: 98 },
  { make: "RAM", model: "ProMaster", type: "VAN", fuel: "GASOLINE", tank: 90 },
  { make: "Kenworth", model: "T680", type: "TRUCK", fuel: "DIESEL", tank: 450 },
  { make: "Blue Bird", model: "Vision", type: "BUS", fuel: "CNG", tank: 150 },
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

function vin() {
  const chars = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
  let v = "";
  for (let i = 0; i < 17; i++) v += chars[randInt(0, chars.length - 1)];
  return v;
}
function plate() {
  const n = randInt(0, 9);
  const l = "ABCDEFGHJKLMNPRSTUVWXYZ";
  return `${randInt(1, 9)}${l[randInt(0, 22)]}${l[randInt(0, 22)]}${l[randInt(0, 22)]}${randInt(100, 999)}${n}`;
}

async function main() {
  console.log("🌱 Seeding fleet database...");

  // wipe (order matters for FKs)
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
    { name: "Downtown SF Depot", type: "DEPOT", key: "Downtown SF Depot", radius: 700, color: "#2563eb" },
    { name: "Oakland Hub", type: "DEPOT", key: "Oakland Hub", radius: 650, color: "#7c3aed" },
    { name: "San Jose Yard", type: "SERVICE", key: "San Jose Yard", radius: 800, color: "#0891b2" },
    { name: "Palo Alto Client Site", type: "CUSTOMER", key: "Palo Alto Client", radius: 400, color: "#16a34a" },
    { name: "Richmond Restricted Zone", type: "RESTRICTED", key: "Richmond Plant", radius: 500, color: "#dc2626" },
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

  // ----- vehicles -----
  const vehicles = [];
  const VEHICLE_COUNT = 24;
  for (let i = 0; i < VEHICLE_COUNT; i++) {
    const m = pick(VEHICLE_MODELS);
    const status = pick([
      "ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE", "IDLE", "IDLE", "MAINTENANCE", "OUT_OF_SERVICE",
    ]) as "ACTIVE" | "IDLE" | "MAINTENANCE" | "OUT_OF_SERVICE";
    const assigned = status === "OUT_OF_SERVICE" ? null : pick(drivers);
    const isMoving = status === "ACTIVE";
    const v = await prisma.vehicle.create({
      data: {
        name: `Unit ${String(i + 1).padStart(3, "0")}`,
        make: m.make,
        model: m.model,
        year: randInt(2017, 2025),
        vin: vin(),
        licensePlate: plate(),
        type: m.type,
        status,
        fuelType: m.fuel,
        odometer: randInt(5000, 320000),
        fuelLevel: m.fuel === "ELECTRIC" ? randInt(15, 100) : randInt(8, 100),
        tankCapacity: m.tank || 100,
        station: STATIONS[i % STATIONS.length] as StationCode,
        registrationExpiry: daysFromNow(randInt(-15, 700)),
        insuranceExpiry: daysFromNow(randInt(-10, 500)),
        purchaseDate: daysFromNow(-randInt(200, 2800)),
        purchasePrice: randInt(35000, 185000),
        lat: CENTER.lat + rand(-0.18, 0.18),
        lng: CENTER.lng + rand(-0.22, 0.22),
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

  // ----- work orders + schedules -----
  // Map a service group to a MaintenanceType for the legacy filter.
  function typeForService(s: (typeof services)[number]): "SCHEDULED_SERVICE" | "REPAIR" | "INSPECTION" | "TIRE" | "OIL_CHANGE" | "RECALL" {
    const n = s.name.toLowerCase();
    if (n.includes("tire")) return "TIRE";
    if (n.includes("oil")) return "OIL_CHANGE";
    if (n.includes("inspection") || n.includes("test") || n.includes("diagnostic")) return "INSPECTION";
    if (s.category === "PREVENTIVE") return "SCHEDULED_SERVICE";
    return "REPAIR";
  }
  const vendors = ["FleetCare Service", "Lone Star Diesel", "QuickLube Pro", "In-house Shop", "Gulf Coast Truck"];
  const techNames = ["Miguel Torres", "Sam Patel", "Jordan Lee", "Chris Nguyen", "Andre Bell"];
  const LABOR_RATE = 95;
  // Spread completed work orders across the last 6 months for per-month/per-station reporting.
  for (const v of vehicles) {
    for (let monthsAgo = 0; monthsAgo < 6; monthsAgo++) {
      const count = randInt(0, 3);
      for (let j = 0; j < count; j++) {
        const s = pick(services);
        const material = Math.round(s.materialCost * rand(0.8, 1.25));
        const laborRate = LABOR_RATE;
        const labor = Math.round(s.laborCost * rand(0.85, 1.2));
        const laborHours = Math.round((labor / laborRate) * 10) / 10;
        const day = new Date();
        day.setMonth(day.getMonth() - monthsAgo);
        day.setDate(randInt(1, 28));
        await prisma.workOrder.create({
          data: {
            vehicleId: v.id,
            serviceId: s.id,
            station: v.station,
            type: typeForService(s),
            title: s.name,
            description: `${s.category === "PREVENTIVE" ? "Preventive" : "Corrective"} — ${s.group}`,
            status: "COMPLETED",
            priority: pick(["LOW", "MEDIUM", "MEDIUM", "HIGH"]),
            materialCost: material,
            laborHours,
            laborRate,
            laborCost: laborHours * laborRate,
            cost: material + laborHours * laborRate,
            performedBy: pick(techNames),
            odometerAt: v.odometer - randInt(0, 5000),
            vendor: pick(vendors),
            completedAt: day,
            createdAt: day,
          },
        });
      }
    }
    // a few currently-open / scheduled work orders for the maintenance board
    const openCount = randInt(0, 2);
    for (let j = 0; j < openCount; j++) {
      const s = pick(services);
      const material = Math.round(s.materialCost * rand(0.8, 1.25));
      const laborRate = LABOR_RATE;
      const labor = Math.round(s.laborCost * rand(0.85, 1.2));
      const laborHours = Math.round((labor / laborRate) * 10) / 10;
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
          priority: pick(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
          materialCost: material,
          laborHours,
          laborRate,
          laborCost: laborHours * laborRate,
          cost: material + laborHours * laborRate,
          odometerAt: v.odometer - randInt(0, 5000),
          vendor: pick(vendors),
          scheduledFor: daysFromNow(randInt(1, 30)),
        },
      });
    }
    // a couple of recurring schedules
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

  // ----- fuel logs -----
  for (const v of vehicles) {
    if (v.fuelType === "ELECTRIC") continue;
    const count = randInt(3, 9);
    for (let j = 0; j < count; j++) {
      const liters = randInt(30, Math.max(40, Math.round(v.tankCapacity * 0.8)));
      const price = Math.round(rand(0.95, 1.65) * 100) / 100;
      await prisma.fuelLog.create({
        data: {
          vehicleId: v.id,
          driverId: v.assignedDriverId,
          date: daysFromNow(-randInt(1, 120)),
          liters,
          pricePerLiter: price,
          totalCost: Math.round(liters * price * 100) / 100,
          odometer: v.odometer - randInt(0, 8000),
          location: pick(["Shell - Market St", "Chevron - Oakland", "BP - San Jose", "Costco Fuel", "76 - Berkeley"]),
        },
      });
    }
  }

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
      GEOFENCE_ENTER: `${v.name} entered geofence "Downtown SF Depot"`,
      GEOFENCE_EXIT: `${v.name} left geofence "Oakland Hub"`,
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

  console.log(
    `✅ Seeded: ${vehicles.length} vehicles, ${drivers.length} drivers, ${services.length} services, 40 trips, work orders, fuel logs, alerts, ${fenceDefs.length} geofences.`,
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
