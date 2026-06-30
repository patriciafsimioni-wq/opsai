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
  const woTitles = {
    SCHEDULED_SERVICE: ["50k mile service", "Annual service", "Brake inspection"],
    REPAIR: ["Transmission repair", "AC compressor replacement", "Alternator replacement", "Suspension repair"],
    INSPECTION: ["DOT inspection", "Safety inspection", "Emissions test"],
    TIRE: ["Tire rotation", "Tire replacement (x4)", "Wheel alignment"],
    OIL_CHANGE: ["Oil & filter change"],
    RECALL: ["Manufacturer recall fix"],
  };
  for (const v of vehicles) {
    const count = randInt(1, 4);
    for (let j = 0; j < count; j++) {
      const type = pick(Object.keys(woTitles) as (keyof typeof woTitles)[]);
      const status = pick(["OPEN", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "COMPLETED"]) as
        "OPEN" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
      await prisma.workOrder.create({
        data: {
          vehicleId: v.id,
          type,
          title: pick(woTitles[type]),
          description: "Auto-generated work order from fleet maintenance system.",
          status,
          priority: pick(["LOW", "MEDIUM", "MEDIUM", "HIGH", "CRITICAL"]),
          cost: status === "COMPLETED" ? randInt(120, 4200) : randInt(0, 3000),
          odometerAt: v.odometer - randInt(0, 5000),
          vendor: pick(["FleetCare Service", "Bay Area Diesel", "QuickLube Pro", "In-house Shop"]),
          scheduledFor: status === "SCHEDULED" || status === "OPEN" ? daysFromNow(randInt(1, 30)) : null,
          completedAt: status === "COMPLETED" ? daysFromNow(-randInt(1, 120)) : null,
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
    `✅ Seeded: ${vehicles.length} vehicles, ${drivers.length} drivers, 40 trips, work orders, fuel logs, alerts, ${fenceDefs.length} geofences.`,
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
