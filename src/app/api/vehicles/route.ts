import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser, requireManager, badRequest, stationWhere, fleetGroupWhere } from "@/lib/api";
import { logActivity } from "@/lib/activity";

export async function GET(req: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  // fleet=1 restricts to the active uploaded fleet (excludes off-boarded /
  // "not in current fleet list" units) — used by vehicle pickers so only real
  // fleet vehicles are selectable.
  const fleetOnly = searchParams.get("fleet") === "1";
  // allFleets=1 bypasses the Regular/Tractors fleet filter — used by data-entry
  // pickers (log service, work-order request, DOT compliance) so any vehicle,
  // including tractors/trailers, is always selectable regardless of the view.
  const allFleets = searchParams.get("allFleets") === "1";

  const sw = stationWhere(auth.user);
  const where: Record<string, unknown> = { ...(sw ?? {}) };
  if (fleetOnly) where.offboardStatus = null;
  if (!allFleets) {
    const fg = await fleetGroupWhere();
    if (fg) where.fleetGroup = fg;
  }

  const vehicles = await prisma.vehicle.findMany({
    where,
    orderBy: { name: "asc" },
    include: { assignedDriver: true },
  });
  return NextResponse.json(vehicles);
}

const createSchema = z.object({
  name: z.string().min(1),
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.coerce.number().int().min(1950).max(2100),
  vin: z.string().min(1),
  licensePlate: z.string().min(1),
  type: z.enum(["TRUCK", "VAN", "CAR", "BUS", "PICKUP", "TRAILER"]),
  fleetGroup: z.enum(["REGULAR", "TRACTOR_TRAILER"]).optional(),
  status: z.enum(["ACTIVE", "IDLE", "MAINTENANCE", "OUT_OF_SERVICE"]),
  station: z.enum(["IAH", "AUS", "HRL", "LRD", "ACT", "CLL", "BPT", "ORF", "RNH"]).optional(),
  fuelType: z.enum(["DIESEL", "GASOLINE", "ELECTRIC", "HYBRID", "CNG"]),
  odometer: z.coerce.number().min(0),
  fuelLevel: z.coerce.number().min(0).max(100),
  tankCapacity: z.coerce.number().min(0),
  assignedDriverId: z.string().optional().nullable(),
  garageAddress: z.string().optional().nullable(),
  onboardedDate: z.string().optional().nullable(),
  registrationExpiry: z.string().optional().nullable(),
  insuranceExpiry: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");

  const d = parsed.data;
  const vehicle = await prisma.vehicle.create({
    data: {
      name: d.name,
      make: d.make,
      model: d.model,
      year: d.year,
      vin: d.vin,
      licensePlate: d.licensePlate,
      type: d.type,
      fleetGroup: d.fleetGroup ?? "REGULAR",
      status: d.status,
      ...(d.station ? { station: d.station } : {}),
      fuelType: d.fuelType,
      odometer: d.odometer,
      fuelLevel: d.fuelLevel,
      tankCapacity: d.tankCapacity,
      assignedDriverId: d.assignedDriverId || null,
      garageAddress: d.garageAddress?.trim() || null,
      // Adding a vehicle is its onboarding, so date it today unless told
      // otherwise — the fleet turnover report counts by this date.
      onboardedDate: d.onboardedDate ? new Date(d.onboardedDate) : new Date(),
      registrationExpiry: d.registrationExpiry ? new Date(d.registrationExpiry) : null,
      insuranceExpiry: d.insuranceExpiry ? new Date(d.insuranceExpiry) : null,
      lat: 37.7749 + (Math.random() - 0.5) * 0.2,
      lng: -122.4194 + (Math.random() - 0.5) * 0.25,
      lastSeen: new Date(),
    },
  });
  await logActivity(auth.user, {
    action: "created",
    entity: "Vehicle",
    entityLabel: vehicle.name,
    station: vehicle.station,
  });
  return NextResponse.json(vehicle, { status: 201 });
}
