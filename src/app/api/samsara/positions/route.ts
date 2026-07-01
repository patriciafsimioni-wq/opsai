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
    select: {
      id: true,
      dxNumber: true,
      name: true,
      make: true,
      model: true,
      type: true,
      status: true,
      fuelLevel: true,
      samsaraId: true,
      assignedDriver: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  const byDx = new Map(vehicles.map((v) => [v.dxNumber?.toUpperCase(), v]));
  const bySamsaraId = new Map(
    vehicles.filter((v) => v.samsaraId).map((v) => [v.samsaraId!, v]),
  );

  const positions = [];
  for (const s of stats) {
    if (!s.gps?.latitude || !s.gps?.longitude) continue;

    // Match to our fleet
    let vehicle = bySamsaraId.get(s.id);
    if (!vehicle) {
      const dx = extractDxNumber(s.name);
      if (dx) vehicle = byDx.get(dx);
    }
    if (!vehicle) continue;

    const engineOn = s.engineStates?.value === "On";
    positions.push({
      id: vehicle.id,
      vehicleId: vehicle.id,
      name: vehicle.name || vehicle.dxNumber || s.name,
      make: vehicle.make,
      model: vehicle.model,
      type: vehicle.type,
      status: engineOn ? "ACTIVE" : vehicle.status,
      lat: s.gps.latitude,
      lng: s.gps.longitude,
      heading: s.gps.headingDegrees || 0,
      speed: s.gps.speedMilesPerHour || 0,
      fuelLevel: vehicle.fuelLevel,
      assignedDriver: vehicle.assignedDriver,
      timestamp: s.gps.time,
    });
  }

  return NextResponse.json({ positions });
}
