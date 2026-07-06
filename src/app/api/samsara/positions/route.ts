import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api";
import { getSamsaraGpsPositions, extractDxNumber, isConfigured } from "@/lib/samsara";
import { prisma } from "@/lib/db";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  if (!isConfigured()) {
    return NextResponse.json(
      { error: "SAMSARA_API_KEY not configured" },
      { status: 500 },
    );
  }

  const stats = await getSamsaraGpsPositions();
  const vehicles = await prisma.vehicle.findMany({
    where: {
      OR: [
        { offboardStatus: null },
        { offboardStatus: { notIn: ["IN_PROGRESS", "COMPLETED"] } },
      ],
    },
    select: {
      id: true,
      dxNumber: true,
      name: true,
      make: true,
      model: true,
      type: true,
      status: true,
      station: true,
      fuelLevel: true,
      samsaraId: true,
      assignedDriver: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  const byDx = new Map(vehicles.map((v) => [v.dxNumber?.toUpperCase(), v]));
  const bySamsaraId = new Map(
    vehicles.filter((v) => v.samsaraId).map((v) => [v.samsaraId!, v]),
  );

  // Keyed by our vehicle id so multiple Samsara devices resolving to the same
  // vehicle collapse into one marker (keep the freshest GPS reading).
  const byVehicle = new Map<string, { timestamp: string; pos: Record<string, unknown> }>();
  for (const s of stats) {
    if (!s.gps?.latitude || !s.gps?.longitude) continue;

    // Match to our fleet
    let vehicle = bySamsaraId.get(s.id);
    if (!vehicle) {
      const dx = extractDxNumber(s.name);
      if (dx) vehicle = byDx.get(dx);
    }
    if (!vehicle) continue;

    const existing = byVehicle.get(vehicle.id);
    if (existing && existing.timestamp >= s.gps.time) continue;

    const engineOn = s.engineStates?.value === "On";
    byVehicle.set(vehicle.id, {
      timestamp: s.gps.time,
      pos: {
        id: vehicle.id,
        vehicleId: vehicle.id,
        name: vehicle.name || vehicle.dxNumber || s.name,
        make: vehicle.make,
        model: vehicle.model,
        type: vehicle.type,
        station: vehicle.station,
        status: engineOn ? "ACTIVE" : vehicle.status,
        lat: s.gps.latitude,
        lng: s.gps.longitude,
        heading: s.gps.headingDegrees || 0,
        speed: s.gps.speedMilesPerHour || 0,
        fuelLevel: vehicle.fuelLevel,
        assignedDriver: vehicle.assignedDriver,
        timestamp: s.gps.time,
      },
    });
  }
  const positions = [...byVehicle.values()].map((e) => e.pos);

  return NextResponse.json({ positions });
}
