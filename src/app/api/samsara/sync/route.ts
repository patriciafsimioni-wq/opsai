import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/api";
import {
  getSamsaraVehicleStats,
  metersToMiles,
  extractDxNumber,
  isConfigured,
} from "@/lib/samsara";

export async function POST() {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;

  if (!isConfigured()) {
    return NextResponse.json(
      { error: "SAMSARA_API_KEY not configured" },
      { status: 500 },
    );
  }

  const stats = await getSamsaraVehicleStats();
  const vehicles = await prisma.vehicle.findMany({
    select: { id: true, dxNumber: true, samsaraId: true },
  });

  // Build lookup maps
  const byDx = new Map(vehicles.map((v) => [v.dxNumber?.toUpperCase(), v]));
  const bySamsaraId = new Map(
    vehicles.filter((v) => v.samsaraId).map((v) => [v.samsaraId!, v]),
  );

  let matched = 0;
  let updated = 0;
  const results: { name: string; dxNumber: string | null; odometer: number; source: string }[] = [];

  for (const s of stats) {
    // Match by samsaraId first, then DX number
    let vehicle = bySamsaraId.get(s.id);
    if (!vehicle) {
      const dx = extractDxNumber(s.name);
      if (dx) vehicle = byDx.get(dx);
    }
    if (!vehicle) continue;
    matched++;

    // Get best odometer reading (prefer OBD over GPS)
    const obdMeters = s.obdOdometerMeters?.value;
    const gpsMeters = s.gpsOdometerMeters?.value;
    const meters = obdMeters || gpsMeters;
    if (!meters) continue;

    const miles = metersToMiles(meters);
    const source = obdMeters ? "obd" : "gps";

    // Update vehicle
    const updateData: Record<string, unknown> = {
      odometer: miles,
      samsaraId: s.id,
      lastSeen: new Date(),
    };

    // Update GPS location if available
    if (s.gps) {
      updateData.lat = s.gps.latitude;
      updateData.lng = s.gps.longitude;
      updateData.heading = s.gps.headingDegrees;
      updateData.speed = s.gps.speedMilesPerHour;
    }

    // Update engine state
    if (s.engineStates?.value) {
      updateData.engineOn = s.engineStates.value === "On";
    }

    await prisma.vehicle.update({ where: { id: vehicle.id }, data: updateData });
    updated++;
    results.push({
      name: s.name,
      dxNumber: extractDxNumber(s.name),
      odometer: miles,
      source,
    });
  }

  return NextResponse.json({
    samsaraVehicles: stats.length,
    matched,
    updated,
    results: results.slice(0, 20),
  });
}
